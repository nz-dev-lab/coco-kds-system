// components/orders/DeliveryDetailsModal.tsx
import { X, MapPin, Phone, Mail, Home } from 'lucide-react';

interface DeliveryAddress {
  contact_person_name: string;
  contact_person_number: string;
  contact_person_email?: string;
  address_type: string;
  address: string;
  floor?: string | null;
  road?: string | null;
  house?: string | null;
}

interface DeliveryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryAddress: DeliveryAddress;
  orderType: string;
}

export default function DeliveryDetailsModal({ 
  isOpen, 
  onClose, 
  deliveryAddress,
  orderType 
}: DeliveryDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {orderType === 'delivery' ? 'Delivery Details' : 'Customer Details'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Customer Name */}
          <div className="flex items-start gap-3">
            <Home className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Customer</p>
              <p className="text-sm font-medium text-slate-900">{deliveryAddress.contact_person_name}</p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Phone</p>
              <a 
                href={`tel:${deliveryAddress.contact_person_number}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {deliveryAddress.contact_person_number}
              </a>
            </div>
          </div>

          {/* Email (if available) */}
          {deliveryAddress.contact_person_email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Email</p>
                <a 
                  href={`mailto:${deliveryAddress.contact_person_email}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {deliveryAddress.contact_person_email}
                </a>
              </div>
            </div>
          )}

          {/* Address */}
          {orderType === 'delivery' && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Delivery Address</p>
                <p className="text-sm text-slate-900 leading-relaxed">
                  {deliveryAddress.address}
                </p>
                {(deliveryAddress.house || deliveryAddress.floor || deliveryAddress.road) && (
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    {deliveryAddress.house && <div>House: {deliveryAddress.house}</div>}
                    {deliveryAddress.floor && <div>Floor: {deliveryAddress.floor}</div>}
                    {deliveryAddress.road && <div>Road: {deliveryAddress.road}</div>}
                  </div>
                )}
                <span className="inline-block mt-2 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded capitalize">
                  {deliveryAddress.address_type}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}