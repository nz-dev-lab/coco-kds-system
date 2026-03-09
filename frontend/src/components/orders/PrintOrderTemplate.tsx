import React from 'react';
import { Order } from '@/types/order.type';

interface PrintOrderTemplateProps {
  order: Order;
  restaurantName?: string;
  paperWidth?: 58 | 80;
}

/**
 * Print template optimized for 80mm thermal printers
 * Matches Laravel receipt calculation exactly
 */
export const PrintOrderTemplate: React.FC<PrintOrderTemplateProps> = ({ order, restaurantName, paperWidth = 80 }) => {
  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatOrderType = (type: string) => {
    switch (type) {
      case 'delivery':
        return 'DELIVERY';
      case 'take_away':
        return 'TAKEAWAY';
      case 'dine_in':
        return 'DINE-IN';
      default:
        return type.toUpperCase();
    }
  };

  // Parse all financial values up front
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
  const partiallyPaid      = parseFloat(order.partially_paid_amount || '0');

  // Reverse-calculate items subtotal
  // If tax is excluded it was added ON TOP of order_amount so we subtract it back out
  const itemsSubtotal =
    orderAmount
    - deliveryCharge
    - dmTips
    - additionalCharge
    - extraPackaging
    - (taxExcluded ? totalTax : 0)
    + couponDiscount
    + restaurantDiscount
    + refBonus;

  return (
    <div
      style={{
        width: `${paperWidth}mm`,
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '5mm',
        color: '#000',
        backgroundColor: '#fff',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '2px dashed #000', paddingBottom: '10px' }}>
        <div style={{ fontSize: '22px', fontWeight: 'bold' }}>CocoEats UK</div>
        {restaurantName && (
          <div style={{ fontSize: '11px', marginTop: '3px', color: '#444' }}>{restaurantName}</div>
        )}
        <div style={{ fontSize: '20px', marginTop: '6px' }}>#{order.id}</div>
      </div>

      {/* Order Info */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <strong>Type:</strong>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatOrderType(order.order_type)}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <strong>Time:</strong>
          <span>{formatDateTime(order.created_at || new Date().toISOString())}</span>
        </div>

        {order.schedule_at && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Scheduled:</strong>
            <span>{formatDateTime(order.schedule_at)}</span>
          </div>
        )}
      </div>

      {/* Customer Info (for delivery) */}
      {order.order_type === 'delivery' && order.delivery_address && (
        <div style={{ marginBottom: '10px', borderTop: '1px dashed #000', paddingTop: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>CUSTOMER:</div>
          <div>{order.delivery_address.contact_person_name}</div>
          {order.delivery_address.contact_person_number && (
            <div>Tel: {order.delivery_address.contact_person_number}</div>
          )}
          {order.delivery_address.address && (
            <div style={{ fontSize: '11px', marginTop: '3px' }}>
              {order.delivery_address.address}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', paddingTop: '10px', paddingBottom: '10px', marginBottom: '10px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>ITEMS:</div>
        
        {order.items?.map((item, index) => (
          <div key={index} style={{ marginBottom: '15px' }}>
            {/* Item name, quantity, and total price */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '13px' }}>
                  {item.quantity}x {item.name || 'Unknown Item'}
                </strong>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                  @ £{parseFloat(item.price).toFixed(2)} each
                </div>
              </div>
              <div style={{ fontWeight: 'bold' }}>
                £{(parseFloat(item.price) * item.quantity).toFixed(2)}
              </div>
            </div>

            {/* Variations — price already included in item.price, show as info only */}
            {item.variations && item.variations.length > 0 && (
              <div style={{ fontSize: '11px', marginLeft: '10px', color: '#333' }}>
                {item.variations.map((v, vIdx) => (
                  <div key={vIdx}>• {v.type}: {v.name}</div>
                ))}
              </div>
            )}

            {/* Add-ons */}
            {item.add_ons && item.add_ons.length > 0 && (
              <div style={{ fontSize: '11px', marginLeft: '10px', color: '#333', marginTop: '3px' }}>
                <strong>Add-ons:</strong>
                {item.add_ons.map((addon, aIdx) => (
                  <div key={aIdx}>
                    • {addon.name} x{addon.quantity} (+£{(parseFloat(addon.price) * addon.quantity).toFixed(2)})
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Special Instructions */}
      {order.order_note && (
        <div style={{ marginBottom: '10px', borderTop: '1px dashed #000', paddingTop: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>SPECIAL INSTRUCTIONS:</div>
          <div style={{ fontSize: '12px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
            {order.order_note}
          </div>
        </div>
      )}

      {/* ✅ CORRECTED TOTAL CALCULATION */}
      <div style={{ borderTop: '2px solid #000', paddingTop: '10px', marginTop: '10px' }}>
        {/* Items Total */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <strong>Items Total:</strong>
            <span style={{ fontWeight: 'bold' }}>£{itemsSubtotal.toFixed(2)}</span>
          </div>
          {totalTax > 0 && !taxExcluded && (
            <div style={{ fontSize: '10px', color: '#666', marginLeft: '10px' }}>
              (Tax £{totalTax.toFixed(2)} included)
            </div>
          )}
        </div>

        {/* Add-ons Total */}
        {order.items?.some(item => item.add_ons && item.add_ons.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '11px' }}>
            <span>Addon Cost:</span>
            <span>
              £{order.items.reduce((total, item) => {
                const addonsTotal = item.add_ons?.reduce((sum, addon) =>
                  sum + (parseFloat(addon.price) * addon.quantity), 0) || 0;
                return total + addonsTotal;
              }, 0).toFixed(2)}
            </span>
          </div>
        )}

        {/* Discounts */}
        {restaurantDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#d9534f' }}>
            <strong>Restaurant Discount:</strong>
            <span style={{ fontWeight: 'bold' }}>-£{restaurantDiscount.toFixed(2)}</span>
          </div>
        )}
        {couponDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#d9534f' }}>
            <strong>Coupon Discount:</strong>
            <span style={{ fontWeight: 'bold' }}>-£{couponDiscount.toFixed(2)}</span>
          </div>
        )}
        {refBonus > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#d9534f' }}>
            <strong>Referral Discount:</strong>
            <span style={{ fontWeight: 'bold' }}>-£{refBonus.toFixed(2)}</span>
          </div>
        )}

        {/* Subtotal — only shown when at least one discount applies */}
        {(restaurantDiscount > 0 || couponDiscount > 0 || refBonus > 0) && (() => {
          const subtotal = itemsSubtotal - restaurantDiscount - couponDiscount - refBonus;
          return (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px dashed #000', paddingTop: '5px', marginTop: '5px', marginBottom: '5px',
            }}>
              <strong>Subtotal:</strong>
              <span style={{ fontWeight: 'bold' }}>£{subtotal.toFixed(2)}</span>
            </div>
          );
        })()}

        {/* Tax (excluded mode — added on top) */}
        {taxExcluded && totalTax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>VAT/Tax:</strong>
            <span>£{totalTax.toFixed(2)}</span>
          </div>
        )}

        {/* Delivery Charge */}
        {deliveryCharge > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Delivery Charge:</strong>
            <span>£{deliveryCharge.toFixed(2)}</span>
          </div>
        )}

        {/* DM Tips */}
        {dmTips > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Delivery Tips:</strong>
            <span>£{dmTips.toFixed(2)}</span>
          </div>
        )}

        {/* Service Charge */}
        {additionalCharge > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Service Charge:</strong>
            <span>£{additionalCharge.toFixed(2)}</span>
          </div>
        )}

        {/* Extra Packaging */}
        {extraPackaging > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Extra Packaging:</strong>
            <span>£{extraPackaging.toFixed(2)}</span>
          </div>
        )}

        {/* Final Total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '16px',
          fontWeight: 'bold',
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '2px solid #000',
        }}>
          <span>TOTAL:</span>
          <span>£{orderAmount.toFixed(2)}</span>
        </div>

        {/* Payment */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px' }}>
          <strong>Payment:</strong>
          <span style={{ fontWeight: 'bold' }}>
            {order.payment_method === 'cash_on_delivery' && 'CASH ON DELIVERY (Unpaid)'}
            {order.payment_method === 'digital_payment'  && 'PAID (Online)'}
            {order.payment_method === 'wallet'           && 'PAID (Wallet)'}
            {order.payment_method === 'offline_payment'  && 'CASH / OFFLINE'}
            {order.payment_method === 'partial_payment'  && `PARTIAL — Cash: £${partiallyPaid.toFixed(2)}`}
            {!['cash_on_delivery','digital_payment','wallet','offline_payment','partial_payment'].includes(order.payment_method || '') && (order.payment_method || 'N/A').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', borderTop: '2px dashed #000', paddingTop: '10px' }}>
        <div>Printed: {new Date().toLocaleString('en-GB')}</div>
        <div style={{ marginTop: '5px' }}>Thank you!</div>
      </div>
    </div>
  );
};