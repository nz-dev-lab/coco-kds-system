import { useState, useEffect } from 'react';
import { X, User, TrendingUp, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useAppSelector } from '@/store/hooks';

interface DeliveryMan {
  id: number;
  f_name: string;
  l_name: string;
  phone: string;
  current_orders: number;
  image: string | null;
  type: string;
}

interface DeliveryAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (deliveryManId: number) => Promise<void>;
  orderId: string;
  currentDeliveryManId?: string | null;
}

export default function DeliveryAssignmentModal({
  isOpen,
  onClose,
  onAssign,
  orderId,
  currentDeliveryManId,
}: DeliveryAssignmentModalProps) {
  const [deliveryMen, setDeliveryMen] = useState<DeliveryMan[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const token = useAppSelector((state) => state.auth.token);

  // Fetch delivery men when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDeliveryMen();
    }
  }, [isOpen]);

  const fetchDeliveryMen = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/kds/orders/delivery-men`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      setDeliveryMen(response.data);
    } catch (err: any) {
      console.error('Failed to fetch delivery men:', err);
      setError(err.response?.data?.message || 'Failed to load delivery men');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedId) return;
    
    setAssigning(true);
    setError(null);
    
    try {
      await onAssign(selectedId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign delivery man');
    } finally {
      setAssigning(false);
    }
  };

  const getCapacityColor = (currentOrders: number) => {
    if (currentOrders === 0) return 'text-green-600';
    if (currentOrders <= 2) return 'text-blue-600';
    if (currentOrders <= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCapacityBg = (currentOrders: number) => {
    if (currentOrders === 0) return 'bg-green-50 border-green-200';
    if (currentOrders <= 2) return 'bg-blue-50 border-blue-200';
    if (currentOrders <= 4) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const isAtCapacity = (currentOrders: number) => currentOrders >= 5;
  const isCurrentlyAssigned = (dmId: number) => 
    currentDeliveryManId && dmId === parseInt(currentDeliveryManId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {currentDeliveryManId ? 'Change' : 'Assign'} Delivery Man
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Order #{orderId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={assigning}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading delivery personnel...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={fetchDeliveryMen}
                className="px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100 rounded transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && deliveryMen.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <User className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No delivery personnel available</p>
              <p className="text-sm text-gray-500 mt-1">All delivery men are currently offline</p>
            </div>
          )}

          {/* Delivery Men Grid */}
          {!loading && !error && deliveryMen.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deliveryMen.map((dm) => {
                const atCapacity = isAtCapacity(dm.current_orders);
                const isAssigned = isCurrentlyAssigned(dm.id);
                const isSelected = selectedId === dm.id;

                return (
                  <button
                    key={dm.id}
                    onClick={() => !atCapacity && setSelectedId(dm.id)}
                    disabled={atCapacity}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]' 
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                      }
                      ${atCapacity ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      ${isAssigned ? 'ring-2 ring-green-500 ring-offset-2' : ''}
                    `}
                  >
                    {/* Currently Assigned Badge */}
                    {isAssigned && (
                      <div className="absolute -top-2 -right-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
                        CURRENT
                      </div>
                    )}

                    {/* At Capacity Badge */}
                    {atCapacity && (
                      <div className="absolute -top-2 -right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                        FULL
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {dm.image ? (
                          <img
                            src={dm.image}
                            alt={`${dm.f_name} ${dm.l_name}`}
                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {dm.f_name.charAt(0)}{dm.l_name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {dm.f_name} {dm.l_name}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">{dm.phone}</p>
                        
                        {/* Capacity Indicator */}
                        <div className={`
                          mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border
                          ${getCapacityBg(dm.current_orders)}
                        `}>
                          <TrendingUp className={`w-3.5 h-3.5 ${getCapacityColor(dm.current_orders)}`} />
                          <span className={`text-xs font-medium ${getCapacityColor(dm.current_orders)}`}>
                            {dm.current_orders}/5 orders
                          </span>
                        </div>

                        {/* Type Badge */}
                        {dm.type === 'zone_wise' && (
                          <span className="mt-2 inline-block text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Zone-wide
                          </span>
                        )}
                      </div>

                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedId ? (
              <span className="font-medium text-gray-900">
                {deliveryMen.find(dm => dm.id === selectedId)?.f_name}{' '}
                {deliveryMen.find(dm => dm.id === selectedId)?.l_name} selected
              </span>
            ) : (
              'Select a delivery person to continue'
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={assigning}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedId || assigning}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {assigning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Assigning...
                </>
              ) : (
                currentDeliveryManId ? 'Change Assignment' : 'Assign'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}