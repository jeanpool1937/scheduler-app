
import { simulateSchedule, EnhancedScheduleItem } from './schedulerLogic';
import { ProductionScheduleItem } from '../types';
import { startOfDay, setHours, setMinutes, addDays, getDay, addMinutes, differenceInMinutes, format } from 'date-fns';

console.log('--- Starting Test ---');

// Helper to create a specific date
const createDate = (base: Date, hour: number, min: number = 0) => {
    const d = new Date(base);
    d.setHours(hour, min, 0, 0);
    return d;
};

// 1. Setup a clean Monday
let baseDate = startOfDay(new Date());
while (getDay(baseDate) !== 1) { // 1 = Monday
    baseDate = addDays(baseDate, 1);
}

console.log(`Base Date (Monday): ${format(baseDate, 'yyyy-MM-dd')}`);

// 2. Scenario 1: Production starts well before peak, crosses it.
// Start: 17:00 (5:00 PM)
// Duration: 300 mins (5 hours) -> Should be 17:00 to 22:00
// Peak: 18:30 - 20:30 (120 mins)
// Expected timeline:
// 17:00 - 18:30 (90m) Production
// 18:30 - 20:30 (120m) Maintenance HP
// 20:30 - 00:00 (210m) Production (Total Prod 90+210=300m)
// End time: 00:00 (Midnight)

const start1 = createDate(baseDate, 17, 0);
const item1: ProductionScheduleItem = {
    id: 'test-1',
    sequenceOrder: 1,
    skuCode: 'SKU-A',
    quantity: 10,
    startTime: start1,
    endTime: start1, // placeholder
    calculatedPace: 1,
    productionTimeMinutes: 300,
    stoppages: {},
    changeoverMinutes: 0,
    qualityChangeMinutes: 0,
    stopChangeMinutes: 0,
    ringChangeMinutes: 0,
    channelChangeMinutes: 0,
    adjustmentMinutes: 0
};

console.log(`\nScenario 1: Start 17:00, Duration 300m`);
const results1 = simulateSchedule([item1], start1);
const segs1 = results1[0].segments || [];

let totalProd1 = 0;
let totalHP1 = 0;

segs1.forEach((s, idx) => {
    console.log(`[${idx}] ${format(s.start, 'HH:mm')} - ${format(s.end, 'HH:mm')} | ${s.type} (${s.durationMinutes.toFixed(1)}m)`);
    if (s.type === 'production') totalProd1 += s.durationMinutes;
    if (s.type === 'maintenance_hp') totalHP1 += s.durationMinutes;
});

if (Math.abs(totalProd1 - 300) > 0.1) console.error(`FAIL: Prod duration ${totalProd1} != 300`);
else console.log('PASS: Prod duration correct');

if (Math.abs(totalHP1 - 120) > 0.1) console.error(`FAIL: HP duration ${totalHP1} != 120`);
else console.log('PASS: HP duration correct');

// End time check
const lastSeg = segs1[segs1.length - 1];
const expectedEnd = createDate(baseDate, 24, 0); // Midnight
// Or rather, start (17:00) + 300m prod + 120m HP = 420m total duration = 7 hours. 17+7 = 24:00. correct.

const diff = differenceInMinutes(lastSeg.end, expectedEnd);
if (Math.abs(diff) > 1) console.error(`FAIL: End time ${format(lastSeg.end, 'HH:mm')} != 00:00`);
else console.log(`PASS: End time correct (${format(lastSeg.end, 'HH:mm')})`);


// 3. Scenario 2: Setup overlaps Peak
// Start: 18:00
// Setup: 60 mins (18:00 - 19:00)
// Production: 60 mins
// Peak: 18:30 - 20:30
// Logic:
// 18:00 - 19:00: Setup (overlaps 30m with HP)
// Remaining HP required: 120 - 30 = 90 mins.
// 19:00 - 20:30: Maintenance HP (90 mins).
// 20:30 - 21:30: Production.

const start2 = createDate(baseDate, 18, 0);
const item2: ProductionScheduleItem = {
    ...item1,
    id: 'test-2',
    startTime: start2,
    endTime: start2,
    productionTimeMinutes: 60,
    changeoverMinutes: 60, // 1 hour setup
};

console.log(`\nScenario 2: Start 18:00, Setup 60m, Prod 60m`);
const results2 = simulateSchedule([item2], start2);
const segs2 = results2[0].segments || [];

let totalSetup2 = 0;
let totalHP2 = 0;
let totalProd2 = 0;

segs2.forEach((s, idx) => {
    console.log(`[${idx}] ${format(s.start, 'HH:mm')} - ${format(s.end, 'HH:mm')} | ${s.type} (${s.durationMinutes.toFixed(1)}m)`);
    if (s.type === 'setup') totalSetup2 += s.durationMinutes;
    if (s.type === 'maintenance_hp') totalHP2 += s.durationMinutes;
    if (s.type === 'production') totalProd2 += s.durationMinutes;
});

if (Math.abs(totalSetup2 - 60) > 0.1) console.error(`FAIL: Setup ${totalSetup2} != 60`);
if (Math.abs(totalHP2 - 90) > 0.1) console.error(`FAIL: HP ${totalHP2} != 90 (Expected 120-30 overlap)`);
else console.log('PASS: HP duration 90m correct (reduced by overlap)');
if (Math.abs(totalProd2 - 60) > 0.1) console.error(`FAIL: Prod ${totalProd2} != 60`);

