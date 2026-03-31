import { calculateOEE, OEEResult } from './src/services/oeeCalculator';

async function testCalc() {
  console.log('--- Testing CNC-13 Scenario ---');
  // CNC-13: 637 Produced. Cycle 54.8. Shift 595.
  const res = await calculateOEE({
    producedQuantity: 637,
    cycleTimeSeconds: 54.8,
    shiftDurationMinutes: 595,
    plannedDowntimeMinutes: 0
  });

  console.log(JSON.stringify(res, null, 2));

  const actual = (637 * 54.8) / 60;
  console.log(`Manual Actual: ${actual}`);
  console.log(`Manual Downtime: ${595 - actual}`);
}

testCalc().catch(console.error);
