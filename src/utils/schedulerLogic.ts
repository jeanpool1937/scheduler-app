
import { addMinutes, differenceInMilliseconds, getDay, isAfter, isBefore, setHours, setMinutes, startOfDay, addDays, format } from 'date-fns';
import type { ProductionScheduleItem } from '../types';

// Configuration - Peak Hours
const PEAK_START_HOUR = 18;
const PEAK_START_MIN = 30;
const PEAK_END_HOUR = 20;
const PEAK_END_MIN = 30;
const REQUIRED_HP_MINUTES = 120; // 2 horas de parada requerida en hora punta

// Configuration - Ring Change (Cambio de Anillo)
const RING_CHANGE_HOUR = 18;
const RING_CHANGE_MIN = 30;
const RING_CHANGE_DURATION = 60; // minutos
const RING_CHANGE_WINDOW_HOURS = 7; // Verificar últimas 7 horas (11:30-18:30)
const RING_CHANGE_MIN_STOPPAGE = 60; // Solo insertar si no hubo parada >= 60min

// Configuration - Channel Change (Cambio de Canal)
const CHANNEL_CHANGE_HOUR = 6;
const CHANNEL_CHANGE_MIN = 30;
const CHANNEL_CHANGE_DURATION = 40; // minutos
const CHANNEL_CHANGE_WINDOW_HOURS = 7; // Verificar últimas 7 horas (23:30-06:30)
const CHANNEL_CHANGE_MIN_STOPPAGE = 40; // Solo insertar si no hubo parada >= 40min

// Helper for precise duration in minutes (float)
const getDurationInMinutes = (end: Date, start: Date): number => {
    return differenceInMilliseconds(end, start) / 60000;
};

export interface ScheduleSegment {
    type: 'production' | 'setup' | 'maintenance_hp' | 'forced_stop' | 'ring_change' | 'channel_change';
    start: Date;
    end: Date;
    durationMinutes: number;
    label: string;
    description: string;
    color: string;
}

export interface EnhancedScheduleItem extends ProductionScheduleItem {
    computedStart: Date;
    computedEnd: Date;
    segments: ScheduleSegment[];
}

export const isPeakHour = (date: Date): boolean => {
    const day = getDay(date);
    if (day === 0 || day === 6) return false; // Weekend exempt

    const peakStart = setMinutes(setHours(date, PEAK_START_HOUR), PEAK_START_MIN);
    peakStart.setSeconds(0, 0); // Normalize

    const peakEnd = setMinutes(setHours(date, PEAK_END_HOUR), PEAK_END_MIN);
    peakEnd.setSeconds(0, 0); // Normalize

    return date >= peakStart && date < peakEnd;
};

export const getNextPeakStart = (date: Date): Date => {
    // Determine next peak start relative to date
    let cursor = new Date(date);
    cursor.setSeconds(0, 0); // Normalize

    const day = getDay(cursor);

    // If weekend, skip to Monday
    if (day === 6) cursor = addDays(cursor, 2); // Sat -> Mon
    else if (day === 0) cursor = addDays(cursor, 1); // Sun -> Mon

    let peakStart = setMinutes(setHours(cursor, PEAK_START_HOUR), PEAK_START_MIN);
    peakStart.setSeconds(0, 0);

    // If we are before today's peak (and it's a weekday), return today's peak
    // Note: If we moved from weekend, it's definitely before Monday's peak
    if (isBefore(cursor, peakStart)) return peakStart;

    // We are past today's peak start, find next valid day
    do {
        cursor = addDays(cursor, 1);
    } while (getDay(cursor) === 0 || getDay(cursor) === 6); // Skip weekends

    peakStart = setMinutes(setHours(cursor, PEAK_START_HOUR), PEAK_START_MIN);
    peakStart.setSeconds(0, 0);

    return peakStart;
};

/**
 * Calcular minutos de paradas (no producción) que intersectan con el rango de hora punta
 * Busca tanto en los segmentos actuales como en los items ya procesados
 */
const calculatePeakCoverage = (
    currentSegments: ScheduleSegment[],
    previousItems: EnhancedScheduleItem[],
    peakStart: Date,
    peakEnd: Date
): number => {
    let total = 0;

    // 1. Check current segments
    total += currentSegments
        .filter(s => s.type !== 'production')
        .reduce((sum, seg) => {
            const overlapStart = new Date(Math.max(seg.start.getTime(), peakStart.getTime()));
            const overlapEnd = new Date(Math.min(seg.end.getTime(), peakEnd.getTime()));
            return sum + Math.max(0, getDurationInMinutes(overlapEnd, overlapStart));
        }, 0);

    // 2. Check previous items (only those that might overlap the peak window)
    // Optimization: Check only last few items or those overlapping the day
    const distinctPreviousSegments = previousItems.flatMap(i => i.segments).filter(s => s.type !== 'production');

    total += distinctPreviousSegments.reduce((sum, seg) => {
        const overlapStart = new Date(Math.max(seg.start.getTime(), peakStart.getTime()));
        const overlapEnd = new Date(Math.min(seg.end.getTime(), peakEnd.getTime()));
        return sum + Math.max(0, getDurationInMinutes(overlapEnd, overlapStart));
    }, 0);

    return total;
};

/**
 * Calcular minutos de paradas en una ventana de tiempo arbitraria
 * Similar a calculatePeakCoverage pero para cualquier rango
 */
const calculateStoppageInWindow = (
    currentSegments: ScheduleSegment[],
    previousItems: EnhancedScheduleItem[],
    windowStart: Date,
    windowEnd: Date
): number => {
    let total = 0;

    // Check current
    total += currentSegments
        .filter(s => s.type !== 'production')
        .reduce((sum, seg) => {
            const overlapStart = new Date(Math.max(seg.start.getTime(), windowStart.getTime()));
            const overlapEnd = new Date(Math.min(seg.end.getTime(), windowEnd.getTime()));
            return sum + Math.max(0, getDurationInMinutes(overlapEnd, overlapStart));
        }, 0);

    // Check previous
    const distinctPreviousSegments = previousItems.flatMap(i => i.segments).filter(s => s.type !== 'production');

    total += distinctPreviousSegments.reduce((sum, seg) => {
        const overlapStart = new Date(Math.max(seg.start.getTime(), windowStart.getTime()));
        const overlapEnd = new Date(Math.min(seg.end.getTime(), windowEnd.getTime()));
        return sum + Math.max(0, getDurationInMinutes(overlapEnd, overlapStart));
    }, 0);

    return total;
};

/**
 * Obtener los límites de hora punta para una fecha dada
 */
const getPeakBounds = (date: Date): { start: Date; end: Date } => {
    const dayStart = startOfDay(date);
    const start = setMinutes(setHours(dayStart, PEAK_START_HOUR), PEAK_START_MIN);
    start.setSeconds(0, 0);

    const end = setMinutes(setHours(dayStart, PEAK_END_HOUR), PEAK_END_MIN);
    end.setSeconds(0, 0);

    return { start, end };
};

/**
 * Verificar si una fecha es feriado
 */
const isHoliday = (date: Date, holidays: string[]): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.includes(dateStr);
};

export const simulateSchedule = (
    items: ProductionScheduleItem[],
    globalStart: Date,
    holidays: string[] = []
): EnhancedScheduleItem[] => {
    // Normalize global start to remove seconds/ms noise
    let cursor = new Date(globalStart);
    cursor.setSeconds(0, 0);

    const enhancedItems: EnhancedScheduleItem[] = [];


    items.forEach(item => {
        const itemStart = new Date(cursor);
        const segments: ScheduleSegment[] = [];

        // 1. Process Setups (Changeovers, etc.)
        // These are FIXED durations, but they also occupy time.
        // Setups CAN overlap Peak Hours and count as "Valid Stops".

        const setups = [
            { type: 'setup', min: item.changeoverMinutes, label: 'Cambio de Medida', color: 'bg-red-100 text-red-800' },
            { type: 'setup', min: item.qualityChangeMinutes, label: 'Cambio Calidad', color: 'bg-pink-100 text-pink-800' },
            { type: 'setup', min: item.stopChangeMinutes, label: 'Cambio de Tope', color: 'bg-teal-100 text-teal-800' },
            { type: 'setup', min: item.adjustmentMinutes, label: 'Acierto y Calib.', color: 'bg-yellow-100 text-yellow-800' },
        ];

        // Process stored stoppages (User defined manual stops)
        if (item.stoppages) {
            Object.entries(item.stoppages).forEach(([stopId, duration]) => {
                if (duration > 0) {
                    const segEnd = addMinutes(cursor, duration);
                    segments.push({
                        type: 'forced_stop',
                        start: new Date(cursor),
                        end: segEnd,
                        durationMinutes: duration,
                        label: 'Parada Manual',
                        description: `Parada (ID: ${stopId})`,
                        color: 'bg-gray-100 text-gray-800'
                    });
                    cursor = segEnd;
                }
            });
        }

        // Ring/Channel Changes from DATA (Manually entered or imported)
        // These are distinct from AUTOMATIC ones. If manual exist, they act as coverage.
        if (item.ringChangeMinutes && item.ringChangeMinutes > 0) {
            const segEnd = addMinutes(cursor, item.ringChangeMinutes);
            segments.push({
                type: 'setup',
                start: new Date(cursor),
                end: segEnd,
                durationMinutes: item.ringChangeMinutes,
                label: 'Cambio Anillo',
                description: 'Cambio Anillo',
                color: 'bg-violet-100 text-violet-800'
            });
            cursor = segEnd;
        }

        if (item.channelChangeMinutes && item.channelChangeMinutes > 0) {
            const segEnd = addMinutes(cursor, item.channelChangeMinutes);
            segments.push({
                type: 'setup',
                start: new Date(cursor),
                end: segEnd,
                durationMinutes: item.channelChangeMinutes,
                label: 'Cambio Canal',
                description: 'Cambio Canal',
                color: 'bg-orange-100 text-orange-800'
            });
            cursor = segEnd;
        }

        setups.forEach(setup => {
            if (setup.min && setup.min > 0) {
                const segEnd = addMinutes(cursor, setup.min);
                segments.push({
                    type: 'setup',
                    start: new Date(cursor),
                    end: segEnd,
                    durationMinutes: setup.min,
                    label: setup.label,
                    description: setup.label,
                    color: setup.color
                });
                cursor = segEnd;
            }
        });

        // 2. Process Production with UNIFIED Event Loop
        let remainingProd = item.productionTimeMinutes;

        while (remainingProd > 0.01) {
            const day = getDay(cursor);
            const isWeekend = day === 0 || day === 6;

            // Define Critical Events
            const cursorDay = startOfDay(cursor);
            const nextDay = addDays(cursorDay, 1);

            const events: { time: Date, type: 'channel' | 'ring' | 'peak_start' | 'peak_end' }[] = [];

            // Channel Change: 06:30
            events.push({ time: setMinutes(setHours(cursorDay, CHANNEL_CHANGE_HOUR), CHANNEL_CHANGE_MIN), type: 'channel' });
            events.push({ time: setMinutes(setHours(nextDay, CHANNEL_CHANGE_HOUR), CHANNEL_CHANGE_MIN), type: 'channel' });

            // Ring Change: 18:30
            events.push({ time: setMinutes(setHours(cursorDay, RING_CHANGE_HOUR), RING_CHANGE_MIN), type: 'ring' });
            events.push({ time: setMinutes(setHours(nextDay, RING_CHANGE_HOUR), RING_CHANGE_MIN), type: 'ring' });

            // Peak Hours: 18:30 (Start) and 20:30 (End) - Only Weekdays
            // Note: Peak Start coincides with Ring Change. Order doesn't strictly matter as we handle logic.
            if (!isWeekend) {
                events.push({ time: setMinutes(setHours(cursorDay, PEAK_START_HOUR), PEAK_START_MIN), type: 'peak_start' });
                events.push({ time: setMinutes(setHours(cursorDay, PEAK_END_HOUR), PEAK_END_MIN), type: 'peak_end' });

                // Need check next day is weekend?
                const nextDayNum = getDay(nextDay);
                if (nextDayNum !== 0 && nextDayNum !== 6) {
                    events.push({ time: setMinutes(setHours(nextDay, PEAK_START_HOUR), PEAK_START_MIN), type: 'peak_start' });
                    events.push({ time: setMinutes(setHours(nextDay, PEAK_END_HOUR), PEAK_END_MIN), type: 'peak_end' });
                }
            }

            // Clean events: Filter past events and sort
            // Note: We include current time events to process them IMMEDIATELY
            const validEvents = events
                .filter(e => isAfter(e.time, cursor) || e.time.getTime() === cursor.getTime())
                .sort((a, b) => a.time.getTime() - b.time.getTime());

            // 1. CHECK CONDITIONS AT CURRENT CURSOR
            // This priority is important.

            let actionTaken = false;

            // Check Channel Change (06:30)
            const isChannelTime = validEvents.some(e => e.type === 'channel' && e.time.getTime() === cursor.getTime());
            if (isChannelTime) {
                const windowStart = addMinutes(cursor, -CHANNEL_CHANGE_WINDOW_HOURS * 60);
                const stoppages = calculateStoppageInWindow(segments, enhancedItems, windowStart, cursor);
                if (stoppages < CHANNEL_CHANGE_MIN_STOPPAGE) {
                    const splitEnd = addMinutes(cursor, CHANNEL_CHANGE_DURATION);
                    segments.push({
                        type: 'channel_change',
                        start: new Date(cursor),
                        end: splitEnd,
                        durationMinutes: CHANNEL_CHANGE_DURATION,
                        label: 'Cambio Canal',
                        description: 'Cambio de Canal (Automático)',
                        color: 'bg-orange-100 text-orange-800'
                    });
                    cursor = splitEnd;
                    actionTaken = true;
                }
            }
            if (actionTaken) continue; // Loop again from new cursor

            // Check Ring Change (18:30)
            const isRingTime = validEvents.some(e => e.type === 'ring' && e.time.getTime() === cursor.getTime());
            if (isRingTime) {
                const windowStart = addMinutes(cursor, -RING_CHANGE_WINDOW_HOURS * 60);
                const stoppages = calculateStoppageInWindow(segments, enhancedItems, windowStart, cursor);
                if (stoppages < RING_CHANGE_MIN_STOPPAGE) {
                    const splitEnd = addMinutes(cursor, RING_CHANGE_DURATION);
                    segments.push({
                        type: 'ring_change',
                        start: new Date(cursor),
                        end: splitEnd,
                        durationMinutes: RING_CHANGE_DURATION,
                        label: 'Cambio Anillo',
                        description: 'Cambio de Anillo (Automático)',
                        color: 'bg-violet-100 text-violet-800'
                    });
                    cursor = splitEnd;
                    actionTaken = true;
                }
            }
            if (actionTaken) continue; // Loop again from new cursor

            // Check Peak Hour Maintenance (Anytime inside peak window)
            // But we mostly care if we are AT Peak Start or Inside it.
            const { start: pStart, end: pEnd } = getPeakBounds(cursor);
            if (!isWeekend && (isAfter(cursor, pStart) || cursor.getTime() === pStart.getTime())) {
                if (isBefore(cursor, pEnd)) {
                    // We are inside peak window. Ensure coverage.
                    const coverage = calculatePeakCoverage(segments, enhancedItems, pStart, pEnd);
                    const needed = REQUIRED_HP_MINUTES - coverage;

                    if (needed > 0.01) {
                        // We need to stop.
                        // But wait, we can only stop up to Peak End.
                        const distToPeakEnd = getDurationInMinutes(pEnd, cursor);
                        const duration = Math.min(needed, distToPeakEnd);

                        const splitEnd = addMinutes(cursor, duration);
                        segments.push({
                            type: 'maintenance_hp',
                            start: new Date(cursor),
                            end: splitEnd,
                            durationMinutes: duration,
                            label: 'MANTENIMIENTO HORA PUNTA',
                            description: `PARADA HORA PUNTA (${Math.round(duration)} min)`,
                            color: '#fee2e2'
                        });
                        cursor = splitEnd;
                        actionTaken = true;
                    }
                }
            }
            if (actionTaken) continue;


            // 2. MOVE TO NEXT EVENT
            // If no action was taken at current cursor, we produce until the next event.

            // Filter strictly future events now
            const futureEvents = validEvents.filter(e => isAfter(e.time, cursor));

            let nextStop = addMinutes(cursor, remainingProd); // Default: finish production
            let hitEvent = false;

            if (futureEvents.length > 0) {
                const nextEvent = futureEvents[0];
                const distToEvent = getDurationInMinutes(nextEvent.time, cursor);

                if (distToEvent < remainingProd) {
                    nextStop = nextEvent.time;
                    hitEvent = true;
                }
            }

            const productionDur = getDurationInMinutes(nextStop, cursor);

            if (productionDur > 0) {
                segments.push({
                    type: 'production',
                    start: new Date(cursor),
                    end: nextStop,
                    durationMinutes: productionDur,
                    label: 'Producción',
                    description: 'Producción',
                    color: '#dbeafe'
                });
                cursor = nextStop;
                remainingProd -= productionDur;
            } else {
                // Should not happen unless remainingProd is tiny
                if (remainingProd > 0) {
                    cursor = addMinutes(cursor, remainingProd);
                    remainingProd = 0;
                }
            }
        }

        enhancedItems.push({
            ...item,
            computedStart: itemStart,
            computedEnd: new Date(cursor),
            segments: segments
        });
    });

    return enhancedItems;
};
