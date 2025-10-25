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