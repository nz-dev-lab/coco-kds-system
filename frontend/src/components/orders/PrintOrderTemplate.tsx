import React from 'react';
import { Order } from '../../store/slices/ordersSlice';

interface PrintOrderTemplateProps {
  order: Order;
}

/**
 * Print template optimized for 80mm thermal printers
 * Can also work with regular printers
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
          <span>{formatDateTime(order.created_at || 'Date')}</span>
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
            {/* Item name and quantity */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '13px' }}>
                  {item.quantity}x {item.name || 'Unknown Item'}
                </strong>
              </div>
              <div style={{ fontWeight: 'bold' }}>
                £{parseFloat(item.price).toFixed(2)}
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

      {/* Total */}
      <div style={{ borderTop: '2px solid #000', paddingTop: '10px', marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <strong>Subtotal:</strong>
          <span>£{parseFloat(order.order_amount || '0').toFixed(2)}</span>
        </div>

        {parseFloat(order.total_tax_amount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Tax:</strong>
            <span>£{parseFloat(order.total_tax_amount).toFixed(2)}</span>
          </div>
        )}

        {parseFloat(order.delivery_charge) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Delivery:</strong>
            <span>£{parseFloat(order.delivery_charge).toFixed(2)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #000' }}>
          <span>TOTAL:</span>
          <span>£{(
            parseFloat(order.order_amount || '0') +
            parseFloat(order.total_tax_amount) +
            parseFloat(order.delivery_charge)
          ).toFixed(2)}</span>
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