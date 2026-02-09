
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulateSchedule } from './utils/schedulerLogic';
import { ProductionScheduleItem } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupPath = path.resolve(__dirname, '../backup_scheduler.json');
console.log(`Loading backup from: ${backupPath}`);

try {
    const rawData = fs.readFileSync(backupPath, 'utf8');
    const backup = JSON.parse(rawData);

    const items = backup.schedule.map((item: any) => ({
        ...item,
        startTime: new Date(item.startTime),
        endTime: new Date(item.endTime),
        sequenceOrder: Number(item.sequenceOrder),
        quantity: Number(item.quantity),
        productionTimeMinutes: Number(item.productionTimeMinutes),
        changeoverMinutes: Number(item.changeoverMinutes || 0),
        qualityChangeMinutes: Number(item.qualityChangeMinutes || 0),
        stopChangeMinutes: Number(item.stopChangeMinutes || 0),
        adjustmentMinutes: Number(item.adjustmentMinutes || 0),
        ringChangeMinutes: Number(item.ringChangeMinutes || 0),
        channelChangeMinutes: Number(item.channelChangeMinutes || 0),
        stoppages: item.stoppages || {}
    }));

    // Use current time or config start if in future/past relevant to data
    const startDate = new Date(backup.config.programStartDate);
    console.log(`Simulating from: ${startDate.toISOString()}`);
    console.log(`Total items: ${items.length}`);

    const result = simulateSchedule(items, startDate);
    console.log('Simulation completed successfully!');

    let hpCount = 0;
    let totalHpMinutes = 0;

    console.log('\n--- Mantenimiento HP Segments ---');
    result.forEach(item => {
        const hpSegments = item.segments?.filter(s => s.type === 'maintenance_hp');
        if (hpSegments && hpSegments.length > 0) {
            hpSegments.forEach(seg => {
                hpCount++;
                totalHpMinutes += seg.durationMinutes;

                // Get bounds of this segment
                const segStart = new Date(seg.start);
                const segEnd = new Date(seg.end);

                // Check if there were OTHER stops in this item that contributed to coverage
                const otherStops = item.segments?.filter(s => s.type !== 'production' && s.type !== 'maintenance_hp');
                const otherStopsDuration = otherStops?.reduce((sum, s) => sum + s.durationMinutes, 0) || 0;

                console.log(`Item #${item.sequenceOrder} (${item.skuCode}): HP ${seg.durationMinutes.toFixed(1)} min | Start: ${segStart.toLocaleString("es-ES")} | Other Stops: ${otherStopsDuration} min`);
            });
        }
    });

    console.log(`\nTotal HP Segments: ${hpCount}`);

    if (hpCount > 0) {
        console.log('SUCCESS: Mantenimiento HP segments generated.');
    } else {
        console.log('WARNING: No Mantenimiento HP segments found.');
    }

} catch (error) {
    console.error('SIMULATION FAILED:', error);
}
