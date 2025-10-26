import { useCallback, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Order } from '@/types/order.type'; 
import { PrintOrderTemplate } from '../components/orders/PrintOrderTemplate';
import { toast } from 'react-toastify'; // Assuming you use react-toastify

export const usePrintOrder = () => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);

  /**
   * Get list of available printers
   */
  const getPrinters = useCallback(async () => {
    try {
      if (!window.electron?.printer) {
        console.warn('⚠️ Printer API not available (not running in Electron)');
        return [];
      }

      const printers = await window.electron.printer.getPrinters();
      return printers;
    } catch (error) {
      console.error('❌ Failed to get printers:', error);
      toast.error('Failed to get printer list');
      return [];
    }
  }, []);

  /**
   * Get the default printer
   */
  const getDefaultPrinter = useCallback(async () => {
    try {
      if (!window.electron?.printer) {
        return null;
      }

      const defaultPrinter = await window.electron.printer.getDefaultPrinter();
      if (defaultPrinter) {
        setSelectedPrinter(defaultPrinter.name);
      }
      return defaultPrinter;
    } catch (error) {
      console.error('❌ Failed to get default printer:', error);
      return null;
    }
  }, []);

  /**
   * Print an order
   */
  const printOrder = useCallback(
    async (order: Order, printerName?: string) => {
      if (!window.electron?.printer) {
        toast.error('Print function only available in desktop app');
        return { success: false, error: 'Not in Electron' };
      }

      setIsPrinting(true);

      try {
        console.log('🖨️ Printing order:', order.id);

        // Render the print template to HTML
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
                  @page { margin: 0; size: 80mm auto; }
                }
              `}</style>
            </head>
            <body>
              <PrintOrderTemplate order={order} />
            </body>
          </html>
        );


      // ✅ ADD THIS: Log the receipt calculation
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📄 RECEIPT CALCULATION FOR ORDER #' + order.id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Calculate items subtotal (same logic as template)
      const orderAmount = parseFloat(order.order_amount || '0');
      const deliveryCharge = parseFloat(order.delivery_charge || '0');
      const dmTips = parseFloat(order.dm_tips || '0');
      const additionalCharge = parseFloat(order.additional_charge || '0');
      const extraPackaging = parseFloat(order.extra_packaging_amount || '0');
      const couponDiscount = parseFloat(order.coupon_discount_amount || '0');
      const restaurantDiscount = parseFloat(order.restaurant_discount_amount || '0');
      
      const itemsSubtotal = 
        orderAmount 
        - deliveryCharge 
        - dmTips 
        - additionalCharge 
        - extraPackaging 
        + couponDiscount 
        + restaurantDiscount;
      
      console.log('Raw Data:');
      console.log('  order_amount:', orderAmount);
      console.log('  delivery_charge:', deliveryCharge);
      console.log('  dm_tips:', dmTips);
      console.log('  additional_charge:', additionalCharge);
      console.log('  extra_packaging_amount:', extraPackaging);
      console.log('  coupon_discount_amount:', couponDiscount);
      console.log('  restaurant_discount_amount:', restaurantDiscount);
      console.log('  total_tax_amount:', order.total_tax_amount);
      console.log('');
      console.log('Calculated Breakdown:');
      console.log('  Items Subtotal: £' + itemsSubtotal.toFixed(2));
      console.log('  Tax (included): £' + parseFloat(order.total_tax_amount || '0').toFixed(2));
      
      if (restaurantDiscount > 0) {
        console.log('  Restaurant Discount: -£' + restaurantDiscount.toFixed(2));
      }
      if (couponDiscount > 0) {
        console.log('  Coupon Discount: -£' + couponDiscount.toFixed(2));
      }
      if (deliveryCharge > 0) {
        console.log('  Delivery Charge: +£' + deliveryCharge.toFixed(2));
      }
      if (dmTips > 0) {
        console.log('  DM Tips: +£' + dmTips.toFixed(2));
      }
      if (additionalCharge > 0) {
        console.log('  Service Charge: +£' + additionalCharge.toFixed(2));
      }
      if (extraPackaging > 0) {
        console.log('  Extra Packaging: +£' + extraPackaging.toFixed(2));
      }
      
      console.log('  ─────────────────────────────────');
      console.log('  TOTAL: £' + orderAmount.toFixed(2));
      console.log('');
      console.log('Verification:');
      const recalculated = itemsSubtotal - restaurantDiscount - couponDiscount + deliveryCharge + dmTips + additionalCharge + extraPackaging;
      console.log('  Recalculated Total: £' + recalculated.toFixed(2));
      console.log('  Matches order_amount: ' + (Math.abs(recalculated - orderAmount) < 0.01 ? '✅ YES' : '❌ NO'));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      // ✅ ADD THIS: Log a preview of the receipt HTML (first 1000 chars)
      console.log('📄 Receipt HTML Preview (first 1000 chars):');
      console.log(printHtml.substring(0, 1000) + '...');
      console.log('');

        // Send to printer
        const result = await window.electron.printer.printOrder(
          printHtml,
          printerName || selectedPrinter || undefined
        );

        if (result.success) {
          console.log('✅ Order printed successfully');
          toast.success('Order printed successfully');
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
    [selectedPrinter]
  );

  /**
   * Print with printer selection (shows printers if multiple available)
   */
  const printWithSelection = useCallback(
    async (order: Order) => {
      try {
        const printers = await getPrinters();

        if (printers.length === 0) {
          toast.error('No printers found. Please configure a printer in your system.');
          return { success: false, error: 'No printers' };
        }

        if (printers.length === 1) {
          // Only one printer, use it directly
          return await printOrder(order, printers[0].name);
        }

        // Multiple printers - use selected or default
        const defaultPrinter = printers.find(p => p.isDefault);
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
    setSelectedPrinter,
    getPrinters,
    getDefaultPrinter,
    printOrder,
    printWithSelection,
  };
};