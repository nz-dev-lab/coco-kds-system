import { useCallback, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Order } from '@/types/order.type';
import { PrintOrderTemplate } from '../components/orders/PrintOrderTemplate';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedPrinterName } from '../store/slices/uiSlice';

export const usePrintOrder = () => {
  const [isPrinting, setIsPrinting] = useState(false);

  const dispatch = useAppDispatch();
  const restaurantName = useAppSelector((s) => s.auth.restaurant?.name);
  const printerSettings = useAppSelector((s) => s.ui.settings.printer);

  // Expose selected printer name from Redux (persisted across reloads)
  const selectedPrinter = printerSettings?.selectedPrinterName ?? null;
  const paperWidth = printerSettings?.paperWidth ?? 80;

  const setSelectedPrinter = useCallback((name: string | null) => {
    dispatch(setSelectedPrinterName(name));
  }, [dispatch]);

  /**
   * Get list of available printers (all registered in OS)
   */
  const getPrinters = useCallback(async () => {
    try {
      if (!window.electron?.printer) {
        console.warn('⚠️ Printer API not available (not running in Electron)');
        return [];
      }
      return await window.electron.printer.getPrinters();
    } catch (error) {
      console.error('❌ Failed to get printers:', error);
      toast.error('Failed to get printer list');
      return [];
    }
  }, []);

  /**
   * Get the default printer and persist it to settings
   */
  const getDefaultPrinter = useCallback(async () => {
    try {
      if (!window.electron?.printer) return null;
      const defaultPrinter = await window.electron.printer.getDefaultPrinter();
      if (defaultPrinter) {
        dispatch(setSelectedPrinterName(defaultPrinter.name));
      }
      return defaultPrinter;
    } catch (error) {
      console.error('❌ Failed to get default printer:', error);
      return null;
    }
  }, [dispatch]);

  /**
   * Print an order.
   * Checks printer status before submitting to avoid false-success on offline printers.
   */
  const printOrder = useCallback(
    async (order: Order, printerName?: string) => {
      if (!window.electron?.printer) {
        toast.error('Print function only available in desktop app');
        return { success: false, error: 'Not in Electron' };
      }

      const targetPrinterName = printerName || selectedPrinter || undefined;

      // ── Offline check ────────────────────────────────────────────────────
      // CUPS (Linux/macOS): status 3=idle, 4=processing, 5=stopped/offline
      // Windows (Win32):    status is a bitmask; bit 7 (0x80) = PRINTER_STATUS_OFFLINE
      if (targetPrinterName) {
        try {
          const printers = await window.electron.printer.getPrinters();
          const target = printers.find((p: any) => p.name === targetPrinterName);
          const platform = window.electron?.platform ?? '';
          const isOffline = !!target && (
            platform === 'win32'
              ? (target.status & 0x80) !== 0
              : target.status === 5
          );
          if (isOffline) {
            toast.error(`Printer "${targetPrinterName}" is offline or stopped. Please check the connection.`);
            console.error('❌ Printer offline:', targetPrinterName, '| status:', target.status, '| platform:', platform);
            return { success: false, error: 'Printer offline' };
          }
        } catch {
          // Non-fatal — proceed and let the OS handle it
        }
      }

      setIsPrinting(true);

      try {
        console.log('🖨️ Printing order:', order.id, '| Printer:', targetPrinterName || 'Default', '| Width:', paperWidth + 'mm');

        // ── ESC/POS path: use direct TCP when printer is IP, or when Windows can resolve the IP ──
        const hasEscpos = typeof window.electron?.printer?.printOrderEscpos === 'function';
        let escposPrinterAddress: string | null = null;
        if (hasEscpos && targetPrinterName) {
          const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(targetPrinterName);
          if (looksLikeIp) {
            escposPrinterAddress = targetPrinterName;
          } else if (window.electron?.printer?.getPrinterIp) {
            // Windows: resolve printer IP from its name via WMI
            const res = await window.electron.printer.getPrinterIp(targetPrinterName);
            if (res.success && res.ip) {
              console.log(`🖨️ Resolved "${targetPrinterName}" → ${res.ip} (ESC/POS mode)`);
              escposPrinterAddress = res.ip;
            }
          }
        }
        console.log('[ESC/POS] escposPrinterAddress:', escposPrinterAddress);
        if (escposPrinterAddress && hasEscpos) {
          const escposData = {
            orderNumber:    order.id,
            restaurantName: restaurantName ?? '',
            orderType:      order.order_type,
            customerName:   order.customer_name ?? '',
            scheduleAt:     order.schedule_at ?? undefined,
            orderNote:      order.order_note ?? undefined,
            paymentMethod:  order.payment_method ?? undefined,
            deliveryAddress: order.delivery_address ? {
              name:    order.delivery_address.contact_person_name ?? '',
              phone:   order.delivery_address.contact_person_number ?? undefined,
              address: order.delivery_address.address ?? undefined,
            } : undefined,
            items: order.items.map(item => ({
              name:       item.name,
              quantity:   item.quantity,
              price:      item.price,
              variations: item.variations?.map(v => ({ type: (v as any).type ?? '', name: v.name })),
              addOns:     item.add_ons?.map(a => ({ name: a.name, quantity: a.quantity, price: a.price })),
            })),
            totalAmount:        order.order_amount,
            deliveryCharge:     order.delivery_charge,
            dmTips:             order.dm_tips,
            additionalCharge:   order.additional_charge,
            extraPackaging:     order.extra_packaging_amount,
            couponDiscount:     order.coupon_discount_amount,
            restaurantDiscount: order.restaurant_discount_amount,
            refBonus:           order.ref_bonus_amount,
            totalTax:           order.total_tax_amount,
            taxStatus:          order.tax_status,
            partiallyPaid:      order.partially_paid_amount,
            createdAt:          order.created_at,
            paperWidth:         paperWidth as 58 | 80,
          };
          const result = await window.electron.printer.printOrderEscpos(escposData, escposPrinterAddress!);
          if (result.success) {
            toast.success(`Sent to ${escposPrinterAddress}`);
          } else {
            toast.error(`ESC/POS print failed: ${result.error}`);
          }
          return result;
        }

        const printHtml = renderToStaticMarkup(
          <html>
            <head>
              <meta charSet="utf-8" />
              <title>{`Order #${order.id}`}</title>
              <style>{`
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { margin: 0; padding: 0; }
                @media print {
                  body { margin: 0; }
                  @page { margin: 0; size: ${paperWidth}mm auto; }
                }
              `}</style>
            </head>
            <body>
              <PrintOrderTemplate order={order} restaurantName={restaurantName ?? undefined} paperWidth={paperWidth as 58 | 80} />
            </body>
          </html>
        );

        // Debug log receipt calculation
        const orderAmount        = parseFloat(order.order_amount || '0');
        const deliveryCharge     = parseFloat(order.delivery_charge || '0');
        const dmTips             = parseFloat(order.dm_tips || '0');
        const additionalCharge   = parseFloat(order.additional_charge || '0');
        const extraPackaging     = parseFloat(order.extra_packaging_amount || '0');
        const couponDiscount     = parseFloat(order.coupon_discount_amount || '0');
        const restaurantDiscount = parseFloat(order.restaurant_discount_amount || '0');
        const refBonus           = parseFloat(order.ref_bonus_amount || '0');
        const totalTax           = parseFloat(order.total_tax_amount || '0');
        const taxExcluded        = order.tax_status === 'excluded';
        const itemsSubtotal      = orderAmount - deliveryCharge - dmTips - additionalCharge - extraPackaging
          - (taxExcluded ? totalTax : 0) + couponDiscount + restaurantDiscount + refBonus;
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📄 RECEIPT CALCULATION FOR ORDER #' + order.id);
        console.log('  → Items Subtotal: £' + itemsSubtotal.toFixed(2), '| TOTAL: £' + orderAmount.toFixed(2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const result = await window.electron.printer.printOrder(
          printHtml,
          targetPrinterName,
          paperWidth as 58 | 80,
        );

        if (result.success) {
          console.log('✅ Print job sent to queue');
          toast.success(`Sent to ${targetPrinterName || 'printer'} — check it printed correctly`);
        } else {
          console.error('❌ Print failed:', result.error);
          toast.error(`Print failed: ${result.error}`);
        }

        return result;
      } catch (error) {
        console.error('❌ Print error:', error);
        toast.error('Failed to print order');
        return { success: false, error: String(error) };
      } finally {
        setIsPrinting(false);
      }
    },
    [selectedPrinter, paperWidth, restaurantName]
  );

  /**
   * Print using the persisted selected printer (or auto-select if only one available).
   */
  const printWithSelection = useCallback(
    async (order: Order) => {
      try {
        if (!window.electron?.printer) {
          toast.error('Print function only available in desktop app');
          return { success: false, error: 'Not in Electron' };
        }

        const printers = await getPrinters();

        if (printers.length === 0) {
          toast.error('No printers found. Please configure a printer in your system.');
          return { success: false, error: 'No printers' };
        }

        if (printers.length === 1) {
          return await printOrder(order, printers[0].name);
        }

        // Use persisted selection, then OS default, then first available
        const defaultPrinter = printers.find((p: any) => p.isDefault);
        const printerToUse = selectedPrinter || defaultPrinter?.name || printers[0].name;

        return await printOrder(order, printerToUse);
      } catch (error) {
        console.error('❌ Print with selection error:', error);
        return { success: false, error: String(error) };
      }
    },
    [getPrinters, printOrder, selectedPrinter]
  );

  return {
    isPrinting,
    selectedPrinter,
    paperWidth,
    setSelectedPrinter,
    getPrinters,
    getDefaultPrinter,
    printOrder,
    printWithSelection,
  };
};
