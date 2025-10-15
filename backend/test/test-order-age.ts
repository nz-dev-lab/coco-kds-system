import { DateTime } from 'luxon';

// ====================================
// CONFIGURATION: Use real order data
// ====================================

// Replace this with ACTUAL created_at from your database
// From your MySQL query: Order 100111 created at 2025-10-14 13:18:59
const testOrderCreatedAt = new Date('2025-10-14T13:18:59.000Z');

// You can add multiple test cases
const testCases = [
  {
    name: 'Real Order from DB',
    createdAt: new Date('2025-10-14T13:18:59.000Z'), // Your actual order
    description: 'Order #100111 from MySQL'
  },
  {
    name: 'Order 5 minutes old',
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    description: 'Simulated order from 5 minutes ago'
  },
  {
    name: 'Order 30 minutes old',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    description: 'Simulated order from 30 minutes ago'
  },
  {
    name: 'Order 2 hours old',
    createdAt: new Date(Date.now() - 120 * 60 * 1000),
    description: 'Simulated order from 2 hours ago'
  }
];

// ====================================
// METHOD 1: Current Luxon Code (Complex)
// ====================================
function calculateOrderAgeOLD(createdAt: Date): number {
  const now = DateTime.now();
  
  // Parse what's in the database (stored as Europe/London time)
  // by treating the UTC timestamp as if it were London local time
  const storedValue = DateTime.fromJSDate(new Date(createdAt));
  
  // Figure out what timezone offset London had at that moment
  const londonAtThatTime = DateTime.fromObject({
    year: storedValue.year,
    month: storedValue.month,
    day: storedValue.day,
    hour: storedValue.hour,
    minute: storedValue.minute,
    second: storedValue.second
  }, { zone: 'Europe/London' });
  
  // Convert to actual UTC
  const actualUTC = londonAtThatTime.toUTC();
  
  const diff = now.diff(actualUTC, 'minutes');
  return Math.floor(diff.minutes);
}

// ====================================
// METHOD 2: Simple Date Math (Proposed)
// ====================================
function calculateOrderAgeNEW(createdAt: Date): number {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / 60000);
}

// ====================================
// TEST RUNNER
// ====================================
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║        ORDER AGE CALCULATION COMPARISON TEST                   ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('Current Time (UTC):', new Date().toISOString());
console.log('Current Time (London):', DateTime.now().setZone('Europe/London').toISO());
console.log('Is BST Active?', DateTime.now().setZone('Europe/London').isInDST ? 'YES (UTC+1)' : 'NO (UTC+0)');
console.log('\n' + '─'.repeat(70) + '\n');

let totalTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  totalTests++;
  
  console.log(`TEST ${index + 1}: ${testCase.name}`);
  console.log(`Description: ${testCase.description}`);
  console.log(`Order Created: ${testCase.createdAt.toISOString()}`);
  console.log('');

  // Calculate using both methods
  const ageOLD = calculateOrderAgeOLD(testCase.createdAt);
  const ageNEW = calculateOrderAgeNEW(testCase.createdAt);
  const difference = Math.abs(ageOLD - ageNEW);

  console.log('  OLD Method (Luxon):  ', ageOLD, 'minutes');
  console.log('  NEW Method (Simple): ', ageNEW, 'minutes');
  console.log('  Difference:          ', difference, 'minutes');
  
  // Determine result
  if (difference === 0) {
    console.log('  ✅ PASS: Both methods agree');
  } else if (difference === 60) {
    console.log('  ⚠️  FAIL: 1 hour offset detected (OLD method is wrong)');
    failedTests++;
  } else {
    console.log(`  ⚠️  FAIL: ${difference} minute difference (unexpected)`);
    failedTests++;
  }
  
  console.log('\n' + '─'.repeat(70) + '\n');
});

// ====================================
// DETAILED ANALYSIS (for first test case)
// ====================================
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║        DETAILED ANALYSIS (First Test Case)                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const firstTest = testCases[0].createdAt;

console.log('--- OLD Method (Luxon) Step-by-Step ---');
const storedValue = DateTime.fromJSDate(new Date(firstTest));
console.log('Step 1 - Parse from DB:', storedValue.toISO());

const londonAtThatTime = DateTime.fromObject({
  year: storedValue.year,
  month: storedValue.month,
  day: storedValue.day,
  hour: storedValue.hour,
  minute: storedValue.minute,
  second: storedValue.second
}, { zone: 'Europe/London' });
console.log('Step 2 - Treat as London:', londonAtThatTime.toISO());
console.log('         Offset:', londonAtThatTime.offset, 'minutes from UTC');

const actualUTC = londonAtThatTime.toUTC();
console.log('Step 3 - Convert to UTC:', actualUTC.toISO());

console.log('\n--- NEW Method (Simple) Step-by-Step ---');
const created = new Date(firstTest);
const now = new Date();
console.log('Step 1 - Created timestamp:', created.getTime(), 'ms since epoch');
console.log('Step 2 - Now timestamp:    ', now.getTime(), 'ms since epoch');
console.log('Step 3 - Difference:       ', now.getTime() - created.getTime(), 'ms');
console.log('Step 4 - In minutes:       ', Math.floor((now.getTime() - created.getTime()) / 60000));

// ====================================
// SUMMARY
// ====================================
console.log('\n' + '═'.repeat(70));
console.log('SUMMARY');
console.log('═'.repeat(70));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${totalTests - failedTests}`);
console.log(`Failed: ${failedTests}`);
console.log('');

if (failedTests === 0) {
  console.log('✅ ALL TESTS PASSED - Both methods produce identical results');
  console.log('   → It\'s safe to use the simple method');
} else {
  console.log('⚠️  TESTS FAILED - Methods produce different results');
  console.log('   → The OLD Luxon method is likely WRONG');
  console.log('   → The NEW simple method is CORRECT (uses pure UTC)');
  console.log('   → RECOMMENDATION: Switch to NEW method');
}

console.log('');
console.log('Next Steps:');
if (failedTests > 0) {
  console.log('1. Review the detailed analysis above');
  console.log('2. Verify MySQL timezone is truly UTC');
  console.log('3. Update calculateOrderAge() in orders.service.ts');
  console.log('4. Deploy to backend-production branch');
} else {
  console.log('1. Both methods work identically');
  console.log('2. You can safely switch to the simpler method');
  console.log('3. Or keep the current method - both are correct');
}

// Add this to test-order-age.ts

console.log('\n' + '═'.repeat(70));
console.log('CLOCK SKEW TEST - Simulating Brand New Order');
console.log('═'.repeat(70));

// Simulate order created RIGHT NOW (0 seconds old)
const justNowOrder = new Date();
console.log('Order Created (NOW):', justNowOrder.toISOString());

// Wait 100ms to simulate tiny delay
setTimeout(() => {
  const ageOLD = calculateOrderAgeOLD(justNowOrder);
  const ageNEW = calculateOrderAgeNEW(justNowOrder);
  
  console.log('After 100ms delay:');
  console.log('  OLD Method:', ageOLD, 'minutes');
  console.log('  NEW Method:', ageNEW, 'minutes');
  
  if (ageOLD < 0 || ageNEW < 0) {
    console.log('  ⚠️  NEGATIVE AGE DETECTED!');
  } else if (ageOLD === 0 && ageNEW === 0) {
    console.log('  ✅ Both correctly show 0 minutes for brand new order');
  }
}, 100);