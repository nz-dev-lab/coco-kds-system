import { useAppDispatch } from '../store/hooks';
import { addOrder } from '../store/slices/ordersSlice';
import { audioNotificationService } from '../utils/audioNotifications';

export default function ScheduledOrderDebug() {
  const dispatch = useAppDispatch();

  const addMockOrder = (minutesFromNow: number, label: string) => {
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + minutesFromNow * 60000);

    

    const mockOrder = {
      id: `MOCK-${Date.now()}`,
      restaurant_id: '2',
      order_status: 'pending' as const,
      order_type: 'delivery' as const,
      payment_method: 'cash_on_delivery',
      order_amount: '15.99',
      processing_time: null,
      order_note: `🧪 ${label}`,
      delivery_instruction: null,
      delivery_man_id: null,
      created_at: now.toISOString(),
      schedule_at: scheduledTime.toISOString(),
      order_age_minutes: 0,
      is_scheduled: true,
      customer_name: 'Test Customer',
      delivery_address: {
        contact_person_name: 'Test Customer',
        contact_person_number: '+447000000000',
        address_type: 'home',
        address: '123 Test Street',
        longitude: '0',
        latitude: '0'
      },
      status_timestamps: {
        pending: now.toISOString(),
        confirmed: null,
        processing: null,
        handover: null,
        delivered: null
      },
      items: [
        {
          id: `mock-item-${Date.now()}`,
          food_id: '1',
          name: 'Test Item',
          quantity: 1,
          price: '15.99',
          variant: null,
          variations: [],
          add_ons: []
        }
      ],
      item_count: 1
    };

    dispatch(addOrder(mockOrder));
    console.log('🧪 Mock order added:', label);
  };

  const testSpeech = () => {
  console.log('Testing speech synthesis...');
  console.log('Available:', 'speechSynthesis' in window);
  
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance('Testing one two three');
    utterance.lang = 'en-GB';
    utterance.volume = 1.0;
    utterance.rate = 1.0;
    
    utterance.onstart = () => console.log('✅ Speech started');
    utterance.onend = () => console.log('✅ Speech ended');
    utterance.onerror = (e) => console.error('❌ Speech error:', e);
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.error('Speech synthesis not supported');
  }
};

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-xl">
      <h3 className="font-bold mb-3 text-sm">🧪 Scheduled Order Testing</h3>
      
      <div className="space-y-2">
        <button
          onClick={() => addMockOrder(3, 'Scheduled 3 min')}
          className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium"
        >
          Add Mock Order (3 min)
        </button>

        <hr className="border-gray-700" />

        <p className="text-xs text-gray-400 mb-1">Test Audio:</p>
        <button
          onClick={() => audioNotificationService.playReadyNotification('TEST')}
          className="w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs"
        >
          🔊 Ready Sound
        </button>
        <button
          onClick={() => audioNotificationService.playOverdueWarning('TEST')}
          className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs"
        >
          🚨 Overdue Alarm
        </button>
        <button
  onClick={testSpeech}
  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
>
  🗣️ Test Speech
</button>
      </div>
    </div>
  );
}