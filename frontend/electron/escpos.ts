/**
 * escpos.ts — Direct TCP ESC/POS printing for Linux
 *
 * Sends ESC/POS commands straight to the printer socket (port 9100).
 * Used on Linux where CUPS sends PostScript that thermal printers cannot understand.
 */

import net from 'net';

// ESC/POS command bytes
const ESC = 0x1b;
const GS  = 0x1d;
const ALIGN_CENTER    = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_LEFT      = Buffer.from([ESC, 0x61, 0x00]);
const BOLD_ON         = Buffer.from([ESC, 0x45, 0x01]);
const BOLD_OFF        = Buffer.from([ESC, 0x45, 0x00]);
const DOUBLE_HEIGHT_ON  = Buffer.from([ESC, 0x21, 0x10]);
const DOUBLE_HEIGHT_OFF = Buffer.from([ESC, 0x21, 0x00]);
// GS V A n — feed n lines then full cut
const FEED_AND_CUT = Buffer.from([GS, 0x56, 0x41, 0x03]);

function line(text: string): Buffer {
  return Buffer.from(text + '\n', 'utf8');
}

function dashed(width: number): Buffer {
  return line('-'.repeat(width));
}

function solid(width: number): Buffer {
  return line('='.repeat(width));
}

/** Right-align value against label across full column width */
function row(label: string, value: string, cols: number): Buffer {
  const pad = Math.max(1, cols - label.length - value.length);
  return line(`${label}${' '.repeat(pad)}${value}`);
}

function fmt(amount: string | undefined | null): string {
  return `£${parseFloat(amount || '0').toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatOrderType(type: string): string {
  switch (type) {
    case 'delivery':  return 'DELIVERY';
    case 'take_away': return 'TAKEAWAY';
    case 'dine_in':   return 'DINE-IN';
    default:          return type.replace(/_/g, ' ').toUpperCase();
  }
}

function formatPayment(method: string | undefined, partiallyPaid: string | undefined): string {
  switch (method) {
    case 'cash_on_delivery': return 'CASH ON DELIVERY (Unpaid)';
    case 'digital_payment':  return 'PAID (Online)';
    case 'wallet':           return 'PAID (Wallet)';
    case 'offline_payment':  return 'CASH / OFFLINE';
    case 'partial_payment':  return `PARTIAL - Cash: £${parseFloat(partiallyPaid || '0').toFixed(2)}`;
    default:                 return (method || 'N/A').toUpperCase();
  }
}

export interface EscPosOrder {
  orderNumber:    string;
  restaurantName: string;
  orderType:      string;
  customerName:   string;
  tableNumber?:   string;
  scheduleAt?:    string;
  orderNote?:     string | null;
  paymentMethod?: string;
  deliveryAddress?: {
    name:     string;
    phone?:   string;
    address?: string;
  };
  items: {
    name:       string;
    quantity:   number;
    price:      string;
    variations?: { type: string; name: string }[];
    addOns?:    { name: string; quantity: number; price: string }[];
  }[];
  // Financial
  totalAmount:          string;
  deliveryCharge?:      string;
  dmTips?:              string;
  additionalCharge?:    string;
  extraPackaging?:      string;
  couponDiscount?:      string;
  restaurantDiscount?:  string;
  refBonus?:            string;
  totalTax?:            string;
  taxStatus?:           string | null;
  partiallyPaid?:       string;
  createdAt:  string;
  paperWidth: 58 | 80;
}

/**
 * Format a full detailed order receipt as ESC/POS byte buffer.
 */
export function buildEscPosReceipt(order: EscPosOrder): Buffer {
  const cols = order.paperWidth === 58 ? 32 : 48;
  const parts: Buffer[] = [];
  const push = (...bufs: Buffer[]) => parts.push(...bufs);

  // No ESC @ (INIT) — some printers advance paper on reset; set state explicitly
  push(ALIGN_LEFT, BOLD_OFF, DOUBLE_HEIGHT_OFF);

  // ── Header ────────────────────────────────────────────────────────────────
  push(ALIGN_CENTER);
  push(DOUBLE_HEIGHT_ON, BOLD_ON);
  push(line('CocoEats UK'));
  push(DOUBLE_HEIGHT_OFF, BOLD_OFF);
  if (order.restaurantName) push(line(order.restaurantName));
  push(BOLD_ON, line(`#${order.orderNumber}`), BOLD_OFF);
  push(dashed(cols));

  // ── Order info ────────────────────────────────────────────────────────────
  push(ALIGN_LEFT);
  push(row('Type:', formatOrderType(order.orderType), cols));
  push(row('Time:', fmtTime(order.createdAt), cols));
  if (order.scheduleAt) push(row('Scheduled:', fmtDate(order.scheduleAt), cols));

  // ── Customer info (delivery only) ─────────────────────────────────────────
  if (order.orderType === 'delivery' && order.deliveryAddress) {
    push(dashed(cols));
    push(BOLD_ON, line('CUSTOMER:'), BOLD_OFF);
    push(line(order.deliveryAddress.name));
    if (order.deliveryAddress.phone) push(line(`Tel: ${order.deliveryAddress.phone}`));
    if (order.deliveryAddress.address) {
      // Wrap address to cols width
      const addr = order.deliveryAddress.address;
      for (let i = 0; i < addr.length; i += cols) {
        push(line(addr.substring(i, i + cols)));
      }
    }
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  push(solid(cols));
  push(BOLD_ON, line('ITEMS:'), BOLD_OFF);

  for (const item of order.items) {
    const price     = parseFloat(item.price || '0');
    const lineTotal = price * item.quantity;
    const qtyName   = `${item.quantity}x ${item.name}`;
    const totalStr  = `£${lineTotal.toFixed(2)}`;
    // Truncate name if needed to fit with price
    const maxName = cols - totalStr.length - 1;
    const nameTrunc = qtyName.length > maxName ? qtyName.substring(0, maxName - 1) + '…' : qtyName;
    push(BOLD_ON, row(nameTrunc, totalStr, cols), BOLD_OFF);
    if (price > 0) push(line(`  @ £${price.toFixed(2)} each`));

    if (item.variations && item.variations.length > 0) {
      for (const v of item.variations) {
        push(line(`  * ${v.type}: ${v.name}`.substring(0, cols)));
      }
    }
    if (item.addOns && item.addOns.length > 0) {
      for (const a of item.addOns) {
        const addonTotal = parseFloat(a.price || '0') * a.quantity;
        push(line(`  + ${a.name} x${a.quantity} (+£${addonTotal.toFixed(2)})`.substring(0, cols)));
      }
    }
  }

  push(solid(cols));

  // ── Special instructions ──────────────────────────────────────────────────
  if (order.orderNote) {
    push(BOLD_ON, line('NOTE:'), BOLD_OFF);
    push(line(order.orderNote.substring(0, cols * 3)));
    push(dashed(cols));
  }

  // ── Financial breakdown ───────────────────────────────────────────────────
  const orderAmount        = parseFloat(order.totalAmount        || '0');
  const deliveryCharge     = parseFloat(order.deliveryCharge     || '0');
  const dmTips             = parseFloat(order.dmTips             || '0');
  const additionalCharge   = parseFloat(order.additionalCharge   || '0');
  const extraPackaging     = parseFloat(order.extraPackaging     || '0');
  const couponDiscount     = parseFloat(order.couponDiscount     || '0');
  const restaurantDiscount = parseFloat(order.restaurantDiscount || '0');
  const refBonus           = parseFloat(order.refBonus           || '0');
  const totalTax           = parseFloat(order.totalTax           || '0');
  const taxExcluded        = order.taxStatus === 'excluded';

  const itemsSubtotal =
    orderAmount - deliveryCharge - dmTips - additionalCharge - extraPackaging
    - (taxExcluded ? totalTax : 0)
    + couponDiscount + restaurantDiscount + refBonus;

  push(row('Items Total:', fmt(itemsSubtotal.toFixed(2)), cols));
  if (totalTax > 0 && !taxExcluded) push(line(`  (Tax £${totalTax.toFixed(2)} incl.)`));

  if (restaurantDiscount > 0) push(row('Restaurant Disc:', `-£${restaurantDiscount.toFixed(2)}`, cols));
  if (couponDiscount     > 0) push(row('Coupon Disc:',     `-£${couponDiscount.toFixed(2)}`,     cols));
  if (refBonus           > 0) push(row('Referral Disc:',   `-£${refBonus.toFixed(2)}`,           cols));

  if (restaurantDiscount > 0 || couponDiscount > 0 || refBonus > 0) {
    const subtotal = itemsSubtotal - restaurantDiscount - couponDiscount - refBonus;
    push(dashed(cols));
    push(row('Subtotal:', fmt(subtotal.toFixed(2)), cols));
  }

  if (taxExcluded && totalTax > 0) push(row('VAT/Tax:',    fmt(order.totalTax),        cols));
  if (deliveryCharge   > 0)        push(row('Delivery:',   fmt(order.deliveryCharge),   cols));
  if (dmTips           > 0)        push(row('DM Tips:',    fmt(order.dmTips),           cols));
  if (additionalCharge > 0)        push(row('Service:',    fmt(order.additionalCharge), cols));
  if (extraPackaging   > 0)        push(row('Packaging:',  fmt(order.extraPackaging),   cols));

  push(solid(cols));
  push(BOLD_ON, row('TOTAL:', `£${orderAmount.toFixed(2)}`, cols), BOLD_OFF);
  push(dashed(cols));
  push(row('Payment:', formatPayment(order.paymentMethod, order.partiallyPaid), cols));

  // ── Footer ────────────────────────────────────────────────────────────────
  push(ALIGN_CENTER);
  push(dashed(cols));
  push(line(`Printed: ${fmtDate(new Date().toISOString())}`));
  push(line('Thank you!'));

  push(FEED_AND_CUT);

  return Buffer.concat(parts);
}

/**
 * Send raw bytes to the printer via TCP socket.
 */
export function sendToTcpPrinter(host: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = 5000;
    socket.setTimeout(timeout);
    socket.connect(port, host, () => {
      socket.write(data, (err) => {
        if (err) { socket.destroy(); reject(err); }
        else      { socket.end();    resolve();    }
      });
    });
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`TCP printer timeout after ${timeout}ms`)); });
    socket.on('error',   (err) => { reject(err); });
  });
}

/**
 * Parse "host:port" or "host" — port defaults to 9100.
 */
export function parsePrinterAddress(address: string): { host: string; port: number } {
  const colonIdx = address.lastIndexOf(':');
  if (colonIdx > 0) {
    const port = parseInt(address.substring(colonIdx + 1), 10);
    if (!isNaN(port)) return { host: address.substring(0, colonIdx), port };
  }
  return { host: address, port: 9100 };
}
