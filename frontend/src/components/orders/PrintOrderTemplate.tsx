import React from 'react';
import { Order } from '@/types/order.type';

interface PrintOrderTemplateProps {
  order: Order;
}

/**
 * Print template optimized for 80mm thermal printers
 * Matches Laravel receipt calculation exactly
 */
export const PrintOrderTemplate: React.FC<PrintOrderTemplateProps> = ({ order }) => {
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

  // ✅ CORRECT CALCULATION: Reverse calculate items subtotal
  const calculateItemsSubtotal = () => {
    const orderAmount = parseFloat(order.order_amount || '0');
    const deliveryCharge = parseFloat(order.delivery_charge || '0');
    const dmTips = parseFloat(order.dm_tips || '0');
    const additionalCharge = parseFloat(order.additional_charge || '0');
    const extraPackaging = parseFloat(order.extra_packaging_amount || '0');
    const couponDiscount = parseFloat(order.coupon_discount_amount || '0');
    const restaurantDiscount = parseFloat(order.restaurant_discount_amount || '0');

    // Formula: items = order_amount - delivery - tips - extras + discounts
    const itemsTotal = 
      orderAmount 
      - deliveryCharge 
      - dmTips 
      - additionalCharge 
      - extraPackaging 
      + couponDiscount 
      + restaurantDiscount;

    return itemsTotal;
  };

  const itemsSubtotal = calculateItemsSubtotal();
  const totalTax = parseFloat(order.total_tax_amount || '0');
  const totalDiscount = 
    parseFloat(order.coupon_discount_amount || '0') + 
    parseFloat(order.restaurant_discount_amount || '0');

  return (
    <div
      style={{
        width: '80mm',
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '5mm',
        color: '#000',
        backgroundColor: '#fff',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '2px dashed #000', paddingBottom: '10px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>KITCHEN ORDER</div>
        <div style={{ fontSize: '20px', marginTop: '5px' }}>#{order.id}</div>
      </div>

      {/* Order Info */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <strong>Type:</strong>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatOrderType(order.order_type)}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <strong>Status:</strong>
          <span>{order.order_status.toUpperCase()}</span>
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

            {/* Variations */}
            {item.variation && item.variation.length > 0 && (
              <div style={{ fontSize: '11px', marginLeft: '10px', color: '#333' }}>
                {item.variation.map((v, vIdx) => (
                  <div key={vIdx}>
                    • {v.type}: {v.name} (+£{parseFloat(v.price).toFixed(2)})
                  </div>
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
          {/* Tax info (informational only - NOT added to total) */}
          {totalTax > 0 && (
            <div style={{ fontSize: '10px', color: '#666', marginLeft: '10px' }}>
              (Tax £{totalTax.toFixed(2)} included)
            </div>
          )}
        </div>

        {/* Add-ons Total (if any) */}
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
        {parseFloat(order.restaurant_discount_amount || '0') > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#d9534f' }}>
            <strong>Restaurant Discount:</strong>
            <span style={{ fontWeight: 'bold' }}>-£{parseFloat(order.restaurant_discount_amount || '0').toFixed(2)}</span>
          </div>
        )}

        {parseFloat(order.coupon_discount_amount || '0') > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#d9534f' }}>
            <strong>Coupon Discount:</strong>
            <span style={{ fontWeight: 'bold' }}>-£{parseFloat(order.coupon_discount_amount || '0').toFixed(2)}</span>
          </div>
        )}

        {/* Delivery Charge */}
        {parseFloat(order.delivery_charge || '0') > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Delivery Charge:</strong>
            <span>£{parseFloat(order.delivery_charge).toFixed(2)}</span>
          </div>
        )}

        {/* DM Tips */}
        {parseFloat(order.dm_tips || '0') > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Delivery Tips:</strong>
            <span>£{parseFloat(order.dm_tips || '0').toFixed(2)}</span>
          </div>
        )}

        {/* Additional Charge */}
        {parseFloat(order.additional_charge || '0') > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Service Charge:</strong>
            <span>£{parseFloat(order.additional_charge || '0').toFixed(2)}</span>
          </div>
        )}

        {/* Extra Packaging */}
        {parseFloat(order.extra_packaging_amount || '0') > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Extra Packaging:</strong>
            <span>£{parseFloat(order.extra_packaging_amount || '0').toFixed(2)}</span>
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
          borderTop: '2px solid #000' 
        }}>
          <span>TOTAL:</span>
          <span>£{parseFloat(order.order_amount || '0').toFixed(2)}</span>
        </div>

        {/* Payment Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px' }}>
          <strong>Payment:</strong>
          <span style={{ fontWeight: 'bold' }}>
            {order.payment_method === 'cash_on_delivery' ? 'UNPAID (COD)' : 'PAID'}
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