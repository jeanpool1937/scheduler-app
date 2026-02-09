
import { simulateSchedule } from './schedulerLogic';
import { ProductionScheduleItem } from '../types';
import { startOfDay, setHours, setMinutes, addDays, getDay, format } from 'date-fns';
import * as fs from 'fs';

const LOG_FILE = 'test_results.log';

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Clear log
fs.writeFileSync(LOG_FILE, '');

log('--- Starting Robust Test ---');

const createDate = (base: Date, hour: number, min: number = 0) => {
    const d = new Date(base);
    d.setHours(hour, min, 0, 0);
    return d;
};

// 1. Setup Base Date (Next Monday)
let baseDate = startOfDay(new Date());
while (getDay(baseDate) !== 1) {
    baseDate = addDays(baseDate, 1);
}
log(`Base Date: ${format(baseDate, 'yyyy-MM-dd')}`);

// Scenario 1: Basic Overlap
// Production 5 hours starting at 17:00.
// Should have 90m Prod, 120m HP Stop, 210m Prod.
{
    log('\n--- Scenario 1: Standard Peak Overlap ---');
    const start = createDate(baseDate, 17, 0);
    const item: ProductionScheduleItem = {
        id: 's1', sequenceOrder: 1, skuCode: 'A', quantity: 10,
        startTime: start, endTime: start, calculatedPace: 1,
        productionTimeMinutes: 300, stoppages: {}
    };

    const results = simulateSchedule([item], start);
    const segs = results[0].segments || [];

    let hpDuration = 0;
    segs.forEach(s => {
        log(`${s.type}: ${format(s.start, 'HH:mm')} - ${format(s.end, 'HH:mm')} (${s.durationMinutes.toFixed(1)}m)`);
        if (s.type === 'maintenance_hp') hpDuration += s.durationMinutes;
    });

    if (Math.abs(hpDuration - 120) < 1) log('PASS: HP Duration is 120m');
    else log(`FAIL: HP Duration is ${hpDuration}m (Expected 120m)`);
}

// Scenario 2: Manual Stop Covers Peak
// Production starts 17:00.
// Manual Stop (forced_stop) defined from 18:30 for 120 mins.
// Should NOT insert maintenance_hp.
{
    log('\n--- Scenario 2: Manual Stop Covers Peak ---');
    const start = createDate(baseDate, 17, 0);

    // We need to simulate how "stoppages" are passed.
    // In logic: 
    // Object.entries(item.stoppages).forEach(([stopId, duration]) => ...
    // Note: The logic puts stops at the CURRENT cursor. 
    // If I start at 17:00, and I have a stoppage of 120m.
    // It will be inserted at 17:00 immediately?

    // Let's check logic:
    // 135:         if (item.stoppages) {
    // 136:             Object.entries(item.stoppages).forEach(([stopId, duration]) => {
    // ...
    // 139:                     segments.push({... start: new Date(cursor) ...})
    // 148:                     cursor = segEnd;

    // YES! The current logic inserts manual stoppages AT THE BEGINNING of the schedule item.
    // It does not respect a specific time for the stoppage.
    // This implies that if I want a stoppage at 18:30, I cannot easily defined it via `stoppages` map unless the item starts at 18:30.

    // BUT, `calculatePeakCoverage` checks segments.
    // If the item starts at 17:00.
    // And I add a stoppage of 120m.
    // It will run 17:00 - 19:00 (Stoppage).
    // Peak is 18:30 - 20:30.
    // Overlap: 18:30 to 19:00 (30 mins).
    // Remaining HP needed: 120 - 30 = 90 mins.
    // So it should insert 90 mins of maintenance_hp.

    const item: ProductionScheduleItem = {
        id: 's2', sequenceOrder: 1, skuCode: 'A', quantity: 10,
        startTime: start, endTime: start, calculatedPace: 1,
        productionTimeMinutes: 300,
        stoppages: { 'manual-1': 120 } // 2 hours stop at START
    };

    const results = simulateSchedule([item], start);
    const segs = results[0].segments || [];

    let hpDuration = 0;
    let forcedDuration = 0;

    segs.forEach(s => {
        log(`${s.type}: ${format(s.start, 'HH:mm')} - ${format(s.end, 'HH:mm')} (${s.durationMinutes.toFixed(1)}m)`);
        if (s.type === 'maintenance_hp') hpDuration += s.durationMinutes;
        if (s.type === 'forced_stop') forcedDuration += s.durationMinutes;
    });

    log(`Forced Stop Duration: ${forcedDuration}m`);
    // Overlap calculation:
    // Start 17:00. Stop 120m -> End 19:00.
    // Peak 18:30. Overlap 18:30-19:00 = 30m.
    // Required 120. Remaining 90.
    // HP Insert starts after production comes close?
    // Wait. 17:00-19:00 is STOP.
    // 19:00 is current cursor.
    // 19:00 is Inside Peak (18:30-20:30).
    // So it should insert HP immediately at 19:00 for 90 mins.
    // 19:00 + 90m = 20:30.
    // So total downtime 17:00-20:30. 
    // PASS if HP duration is 90.

    if (Math.abs(hpDuration - 90) < 1) log('PASS: HP Duration is 90m (Correctly reduced)');
    else log(`FAIL: HP Duration is ${hpDuration}m (Expected 90m)`);
}

// Scenario 3: User wants to validate manually?
// Maybe the user issue is that they have a "Manual Validation" field or logic that is missing?
// "no debes dejar la validacion manual por el usuario"
// Perhaps they want the system to AUTOMATICALLY insert the stop without user asking?
// The current system DOES insert 'maintenance_hp'.
// Maybe the label is wrong? Or the color?
// Or maybe they see that the production just "jumps" without a visual block?
// (We verified visual block IS inserted).
