
import { addMinutes, differenceInMilliseconds, getDay, isAfter, isBefore, setHours, setMinutes, startOfDay, addDays, format } from 'date-fns';
import type { ProductionScheduleItem, SegmentType } from '../types';

// ============================================================
// CONFIGURACIÓN
// ============================================================

// Hora Punta (Mantenimiento HP)
const PEAK_START_HOUR = 18;
const PEAK_START_MIN = 30;
const PEAK_END_HOUR = 20;
const PEAK_END_MIN = 30;
const REQUIRED_HP_MINUTES = 120;

// Cambio de Anillo (Ring Change)
const RING_CHANGE_HOUR = 18;
const RING_CHANGE_MIN = 30;
const RING_CHANGE_DURATION = 60;
const RING_CHANGE_WINDOW_HOURS = 7;
const RING_CHANGE_MIN_STOPPAGE = 60;

// Cambio de Canal (Channel Change)
const CHANNEL_CHANGE_HOUR = 6;
const CHANNEL_CHANGE_MIN = 30;
const CHANNEL_CHANGE_DURATION = 40;
const CHANNEL_CHANGE_WINDOW_HOURS = 7;
const CHANNEL_CHANGE_MIN_STOPPAGE = 40;

// Convergencia
const MAX_ITERATIONS = 20;

// ============================================================
// TIPOS
// ============================================================

export interface ScheduleSegment {
    type: SegmentType;
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

interface FlatSegment {
    itemIndex: number;
    segmentIndex: number;
    type: SegmentType;
    start: Date;
    end: Date;
    durationMinutes: number;
}

interface InsertionPoint {
    timestamp: Date;
    type: 'ring_change' | 'channel_change' | 'maintenance_hp' | 'forced_stop';
    durationMinutes: number;
    manualLabel?: string;
}

// ============================================================
// HELPERS
// ============================================================

const getDurationInMinutes = (end: Date, start: Date): number => {
    return differenceInMilliseconds(end, start) / 60000;
};

const isHoliday = (date: Date, holidays: string[]): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.includes(dateStr);
};

const SEGMENT_COLORS: Record<SegmentType, string> = {
    production: '#dbeafe',
    changeover: 'bg-red-100 text-red-800',
    adjustment: 'bg-yellow-100 text-yellow-800',
    quality_change: 'bg-pink-100 text-pink-800',
    stop_change: 'bg-teal-100 text-teal-800',
    ring_change: 'bg-violet-100 text-violet-800',
    channel_change: 'bg-orange-100 text-orange-800',
    maintenance_hp: '#fee2e2',
    forced_stop: 'bg-gray-100 text-gray-800',
};

const SEGMENT_LABELS: Record<SegmentType, string> = {
    production: 'Producción',
    changeover: 'Cambio de Medida',
    adjustment: 'Acierto y Calib.',
    quality_change: 'Cambio Calidad',
    stop_change: 'Cambio de Tope',
    ring_change: 'Cambio Anillo',
    channel_change: 'Cambio Canal',
    maintenance_hp: 'MANTENIMIENTO HORA PUNTA',
    forced_stop: 'Parada Manual',
};

const createSegment = (
    type: SegmentType,
    start: Date,
    durationMinutes: number,
    descriptionOverride?: string
): ScheduleSegment => {
    const end = addMinutes(start, durationMinutes);
    const label = SEGMENT_LABELS[type];
    return {
        type,
        start: new Date(start),
        end,
        durationMinutes,
        label,
        description: descriptionOverride || label,
        color: SEGMENT_COLORS[type],
    };
};

// ============================================================
// EXPORTED HELPERS (used by other components)
// ============================================================

export const isPeakHour = (date: Date): boolean => {
    const day = getDay(date);
    if (day === 0 || day === 6) return false;

    const peakStart = setMinutes(setHours(date, PEAK_START_HOUR), PEAK_START_MIN);
    peakStart.setSeconds(0, 0);
    const peakEnd = setMinutes(setHours(date, PEAK_END_HOUR), PEAK_END_MIN);
    peakEnd.setSeconds(0, 0);

    return date >= peakStart && date < peakEnd;
};

export const getNextPeakStart = (date: Date): Date => {
    let cursor = new Date(date);
    cursor.setSeconds(0, 0);
    const day = getDay(cursor);

    if (day === 6) cursor = addDays(cursor, 2);
    else if (day === 0) cursor = addDays(cursor, 1);

    let peakStart = setMinutes(setHours(cursor, PEAK_START_HOUR), PEAK_START_MIN);
    peakStart.setSeconds(0, 0);

    if (isBefore(cursor, peakStart)) return peakStart;

    do {
        cursor = addDays(cursor, 1);
    } while (getDay(cursor) === 0 || getDay(cursor) === 6);

    peakStart = setMinutes(setHours(cursor, PEAK_START_HOUR), PEAK_START_MIN);
    peakStart.setSeconds(0, 0);
    return peakStart;
};

// ============================================================
// FASE 1: BASELINE (Solo paradas Tipo A + producción lineal)
// ============================================================

const buildBaseline = (
    items: ProductionScheduleItem[],
    globalStart: Date
): EnhancedScheduleItem[] => {
    let cursor = new Date(globalStart);
    cursor.setSeconds(0, 0);

    return items.map(item => {
        const itemStart = new Date(cursor);
        const segments: ScheduleSegment[] = [];

        // 1. Paradas manuales (forced_stop)
        if (item.stoppages) {
            Object.entries(item.stoppages).forEach(([stopId, duration]) => {
                if (duration > 0) {
                    segments.push(createSegment('forced_stop', cursor, duration, `Parada (ID: ${stopId})`));
                    cursor = addMinutes(cursor, duration);
                }
            });
        }

        // 2. Ring/Channel manuales (desde datos importados, NO automáticos)
        if (item.ringChangeMinutes && item.ringChangeMinutes > 0) {
            segments.push(createSegment('ring_change', cursor, item.ringChangeMinutes, 'Cambio Anillo (Manual)'));
            cursor = addMinutes(cursor, item.ringChangeMinutes);
        }
        if (item.channelChangeMinutes && item.channelChangeMinutes > 0) {
            segments.push(createSegment('channel_change', cursor, item.channelChangeMinutes, 'Cambio Canal (Manual)'));
            cursor = addMinutes(cursor, item.channelChangeMinutes);
        }

        // 3. Paradas Tipo A (inter-orden) en orden de prioridad
        // R1: Cambio de Medida → cancela R2 y R3
        if (item.changeoverMinutes && item.changeoverMinutes > 0) {
            segments.push(createSegment('changeover', cursor, item.changeoverMinutes));
            cursor = addMinutes(cursor, item.changeoverMinutes);

            // R4: Acierto/Calibración (siempre con cambio de medida)
            if (item.adjustmentMinutes && item.adjustmentMinutes > 0) {
                segments.push(createSegment('adjustment', cursor, item.adjustmentMinutes));
                cursor = addMinutes(cursor, item.adjustmentMinutes);
            }
        } else if (item.qualityChangeMinutes && item.qualityChangeMinutes > 0) {
            // R2: Cambio de Calidad (solo si NO hubo cambio de medida)
            segments.push(createSegment('quality_change', cursor, item.qualityChangeMinutes));
            cursor = addMinutes(cursor, item.qualityChangeMinutes);
        } else if (item.stopChangeMinutes && item.stopChangeMinutes > 0) {
            // R3: Cambio de Tope (solo si NO hubo cambio de medida NI calidad)
            segments.push(createSegment('stop_change', cursor, item.stopChangeMinutes));
            cursor = addMinutes(cursor, item.stopChangeMinutes);
        }

        // 4. Producción completa como un solo segmento
        if (item.productionTimeMinutes > 0) {
            segments.push(createSegment('production', cursor, item.productionTimeMinutes));
            cursor = addMinutes(cursor, item.productionTimeMinutes);
        }

        return {
            ...item,
            computedStart: itemStart,
            computedEnd: new Date(cursor),
            segments,
        };
    });
};

// ============================================================
// FASE 2: INSERCIÓN ITERATIVA DE PARADAS TIPO B/C
// ============================================================

/**
 * Aplanar todos los segmentos en un array ordenado por tiempo
 */
const flattenTimeline = (items: EnhancedScheduleItem[]): FlatSegment[] => {
    const flat: FlatSegment[] = [];
    items.forEach((item, itemIndex) => {
        item.segments.forEach((seg, segmentIndex) => {
            flat.push({
                itemIndex,
                segmentIndex,
                type: seg.type,
                start: new Date(seg.start),
                end: new Date(seg.end),
                durationMinutes: seg.durationMinutes,
            });
        });
    });
    return flat.sort((a, b) => a.start.getTime() - b.start.getTime());
};

/**
 * Calcular minutos totales de no-producción dentro de una ventana de tiempo
 */
const calculateStoppageInWindow = (
    flat: FlatSegment[],
    windowStart: Date,
    windowEnd: Date
): number => {
    return flat
        .filter(s => s.type !== 'production')
        .reduce((sum, seg) => {
            const overlapStart = new Date(Math.max(seg.start.getTime(), windowStart.getTime()));
            const overlapEnd = new Date(Math.min(seg.end.getTime(), windowEnd.getTime()));
            return sum + Math.max(0, getDurationInMinutes(overlapEnd, overlapStart));
        }, 0);
};

/**
 * Verificar si ya existe un segmento de cierto tipo en un timestamp exacto
 */
const hasSegmentAtTime = (flat: FlatSegment[], type: SegmentType, timestamp: Date): boolean => {
    const t = timestamp.getTime();
    return flat.some(s => s.type === type && s.start.getTime() === t);
};

/**
 * Verificar si ya existe maintenance_hp que cubra la necesidad en la ventana peak
 */
const hasHPCoverageInWindow = (flat: FlatSegment[], peakStart: Date, peakEnd: Date): boolean => {
    return flat.some(s =>
        s.type === 'maintenance_hp' &&
        s.start.getTime() >= peakStart.getTime() &&
        s.end.getTime() <= peakEnd.getTime()
    );
};

/**
 * Encontrar todos los puntos de inserción necesarios para Tipo B/C
 */
/**
 * Helper: Sustraer intervalos de tiempo bloqueados de un intervalo objetivo
 */
const subtractIntervals = (
    target: { start: Date; end: Date },
    blocks: { start: Date; end: Date }[]
): { start: Date; end: Date; duration: number }[] => {
    let result = [target];

    for (const block of blocks) {
        const nextResult = [];
        for (const segment of result) {
            // Verificar solapamiento
            if (block.end.getTime() <= segment.start.getTime() || block.start.getTime() >= segment.end.getTime()) {
                // No hay solapamiento
                nextResult.push(segment);
            } else {
                // Hay solapamiento
                // 1. Parte antes del bloqueo
                if (block.start.getTime() > segment.start.getTime()) {
                    nextResult.push({ start: segment.start, end: block.start });
                }
                // 2. Parte después del bloqueo
                if (block.end.getTime() < segment.end.getTime()) {
                    nextResult.push({ start: block.end, end: segment.end });
                }
            }
        }
        result = nextResult;
    }

    return result.map(s => ({
        ...s,
        duration: getDurationInMinutes(s.end, s.start)
    })).filter(s => s.duration > 0.1);
};

/**
 * Encontrar todos los puntos de inserción necesarios para Tipo B/C
 */
const findInsertionPoints = (
    flat: FlatSegment[],
    timelineStart: Date,
    timelineEnd: Date,
    holidays: string[],
    manualStops: { id: string; start: Date; durationMinutes: number; label: string }[] = []
): InsertionPoint[] => {
    const insertions: InsertionPoint[] = [];

    // ===================================
    // R5, R6, R7: Paradas Automáticas
    // ===================================
    let currentDay = startOfDay(timelineStart);
    const lastDay = addDays(startOfDay(timelineEnd), 1);

    while (isBefore(currentDay, lastDay) || currentDay.getTime() === lastDay.getTime()) {
        const dayOfWeek = getDay(currentDay);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHolidayDay = isHoliday(currentDay, holidays);

        // R5: Cambio de Anillo a las 18:30 (todos los días)
        const ringTime = setMinutes(setHours(new Date(currentDay), RING_CHANGE_HOUR), RING_CHANGE_MIN);
        ringTime.setSeconds(0, 0);

        if (!isBefore(ringTime, timelineStart) && !isAfter(ringTime, timelineEnd)) {
            if (!hasSegmentAtTime(flat, 'ring_change', ringTime)) {
                const windowStart = addMinutes(ringTime, -RING_CHANGE_WINDOW_HOURS * 60);
                const stoppageInWindow = calculateStoppageInWindow(flat, windowStart, ringTime);
                if (stoppageInWindow < RING_CHANGE_MIN_STOPPAGE) {
                    insertions.push({
                        timestamp: new Date(ringTime),
                        type: 'ring_change',
                        durationMinutes: RING_CHANGE_DURATION,
                    });
                }
            }
        }

        // R6: Cambio de Canal a las 06:30 (todos los días)
        const channelTime = setMinutes(setHours(new Date(currentDay), CHANNEL_CHANGE_HOUR), CHANNEL_CHANGE_MIN);
        channelTime.setSeconds(0, 0);

        if (!isBefore(channelTime, timelineStart) && !isAfter(channelTime, timelineEnd)) {
            if (!hasSegmentAtTime(flat, 'channel_change', channelTime)) {
                const windowStart = addMinutes(channelTime, -CHANNEL_CHANGE_WINDOW_HOURS * 60);
                const stoppageInWindow = calculateStoppageInWindow(flat, windowStart, channelTime);
                if (stoppageInWindow < CHANNEL_CHANGE_MIN_STOPPAGE) {
                    insertions.push({
                        timestamp: new Date(channelTime),
                        type: 'channel_change',
                        durationMinutes: CHANNEL_CHANGE_DURATION,
                    });
                }
            }
        }

        // R7: Mantenimiento Hora Punta (18:30-20:30 L-V, excluyendo feriados)
        if (!isWeekend && !isHolidayDay) {
            const peakStart = setMinutes(setHours(new Date(currentDay), PEAK_START_HOUR), PEAK_START_MIN);
            peakStart.setSeconds(0, 0);
            const peakEnd = setMinutes(setHours(new Date(currentDay), PEAK_END_HOUR), PEAK_END_MIN);
            peakEnd.setSeconds(0, 0);

            if (!isBefore(peakStart, timelineStart) && !isAfter(peakStart, timelineEnd)) {
                if (!hasHPCoverageInWindow(flat, peakStart, peakEnd)) {
                    const coverage = calculateStoppageInWindow(flat, peakStart, peakEnd);
                    const needed = Math.max(0, REQUIRED_HP_MINUTES - coverage);

                    if (needed > 0.01) {
                        // Encontrar el primer punto disponible dentro de la ventana peak
                        const insertTime = findHPInsertionTime(flat, peakStart, peakEnd);
                        if (insertTime) {
                            const distToEnd = getDurationInMinutes(peakEnd, insertTime);
                            const actualDuration = Math.min(needed, distToEnd);
                            if (actualDuration > 0.01) {
                                insertions.push({
                                    timestamp: new Date(insertTime),
                                    type: 'maintenance_hp',
                                    durationMinutes: actualDuration,
                                });
                            }
                        }
                    }
                }
            }
        }

        currentDay = addDays(currentDay, 1);
    }

    // ===================================
    // R8: Paradas Manuales (Prioridad Baja)
    // ===================================
    manualStops.forEach(ms => {
        const msStart = new Date(ms.start);
        const msEnd = addMinutes(msStart, ms.durationMinutes);

        // Validar rango (con holgura de 1 min)
        if (isAfter(addMinutes(msStart, 1), timelineEnd) || isBefore(addMinutes(msEnd, -1), timelineStart)) return;

        // Definir intervalos bloqueantes: CUALQUIER segmento que NO sea producción
        const blockingIntervals = flat
            .filter(s => s.type !== 'production')
            .map(s => ({ start: s.start, end: s.end }));

        // Calcular intervalos libres
        const freeIntervals = subtractIntervals({ start: msStart, end: msEnd }, blockingIntervals);

        freeIntervals.forEach(interval => {
            if (interval.duration > 0.1) {
                insertions.push({
                    timestamp: interval.start,
                    type: 'forced_stop',
                    durationMinutes: interval.duration,
                    manualLabel: ms.label
                });
            }
        });
    });

    // Ordenar por timestamp
    return insertions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

/**
 * Encontrar el primer momento dentro de la ventana peak donde se puede insertar HP.
 * Busca el primer segmento de producción que cae dentro del rango peak,
 * o el inicio del peak si coincide con producción.
 */
const findHPInsertionTime = (
    flat: FlatSegment[],
    peakStart: Date,
    peakEnd: Date
): Date | null => {
    const psTime = peakStart.getTime();
    const peTime = peakEnd.getTime();

    // Buscar segmentos de producción que intersecten con la ventana peak
    for (const seg of flat) {
        if (seg.type !== 'production') continue;
        const segStart = seg.start.getTime();
        const segEnd = seg.end.getTime();

        // ¿Este segmento de producción intersecta con la ventana peak?
        if (segStart < peTime && segEnd > psTime) {
            // El punto de inserción es el máximo entre peakStart y segStart
            return new Date(Math.max(psTime, segStart));
        }
    }

    return null;
};

/**
 * Insertar una parada en el timeline, dividiendo segmentos de producción si es necesario.
 * Retorna true si se realizó la inserción.
 */
const insertStopIntoTimeline = (
    items: EnhancedScheduleItem[],
    insertion: InsertionPoint
): boolean => {
    const { timestamp, type, durationMinutes } = insertion;
    const tTime = timestamp.getTime();

    for (const item of items) {
        for (let j = 0; j < item.segments.length; j++) {
            const seg = item.segments[j];
            const segStartTime = seg.start.getTime();
            const segEndTime = seg.end.getTime();

            // El timestamp debe caer dentro de este segmento
            if (tTime >= segStartTime && tTime < segEndTime) {
                if (seg.type === 'production') {
                    const newSegments: ScheduleSegment[] = [];

                    // Parte 1: Producción antes de la parada
                    const beforeDuration = getDurationInMinutes(timestamp, seg.start);
                    if (beforeDuration > 0.01) {
                        newSegments.push({
                            ...seg,
                            end: new Date(timestamp),
                            durationMinutes: beforeDuration,
                        });
                    }

                    // Parte 2: La parada insertada
                    const stopDescription = type === 'ring_change'
                        ? 'Cambio de Anillo (Automático)'
                        : type === 'channel_change'
                            ? 'Cambio de Canal (Automático)'
                            : type === 'forced_stop'
                                ? (insertion.manualLabel || 'Parada Manual')
                                : `PARADA HORA PUNTA (${Math.round(durationMinutes)} min)`;

                    newSegments.push(createSegment(type, timestamp, durationMinutes, stopDescription));

                    // Parte 3: Producción después de la parada
                    const stopEnd = addMinutes(timestamp, durationMinutes);
                    const afterDuration = getDurationInMinutes(seg.end, timestamp) - durationMinutes;
                    if (afterDuration > 0.01) {
                        newSegments.push({
                            ...seg,
                            start: new Date(stopEnd),
                            end: addMinutes(stopEnd, afterDuration),
                            durationMinutes: afterDuration,
                        });
                    }

                    // Reemplazar el segmento original
                    item.segments.splice(j, 1, ...newSegments);
                    return true;
                }
                // Si no es producción, ya hay una parada aquí - no insertar
                return false;
            }
        }
    }

    return false;
};

/**
 * Reconstruir timeline: recalcular todos los start/end secuencialmente
 * manteniendo las duraciones de cada segmento.
 */
const rebuildTimeline = (items: EnhancedScheduleItem[]): void => {
    if (items.length === 0) return;

    let cursor = new Date(items[0].computedStart);

    for (const item of items) {
        item.computedStart = new Date(cursor);

        for (const seg of item.segments) {
            seg.start = new Date(cursor);
            seg.end = addMinutes(cursor, seg.durationMinutes);
            cursor = new Date(seg.end);
        }

        item.computedEnd = new Date(cursor);
    }
};

/**
 * Fase 2: Inserción iterativa de paradas Tipo B/C con convergencia
 */
const insertTypeBCStops = (
    items: EnhancedScheduleItem[],
    holidays: string[],
    manualStops: { id: string; start: Date; durationMinutes: number; label: string }[]
): EnhancedScheduleItem[] => {
    let iteration = 0;
    let changed = true;

    while (changed && iteration < MAX_ITERATIONS) {
        changed = false;
        iteration++;

        const flat = flattenTimeline(items);

        if (items.length === 0) break;

        const timelineStart = items[0].computedStart;
        const timelineEnd = items[items.length - 1].computedEnd;

        // Encontrar todos los puntos de inserción necesarios
        const insertions = findInsertionPoints(flat, timelineStart, timelineEnd, holidays, manualStops);

        if (insertions.length === 0) break;

        // Aplicar inserciones (de última a primera para no invalidar índices)
        const reversedInsertions = [...insertions].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        for (const insertion of reversedInsertions) {
            const inserted = insertStopIntoTimeline(items, insertion);
            if (inserted) {
                changed = true;
            }
        }

        if (changed) {
            // Reconstruir timeline completo con nuevos tiempos
            rebuildTimeline(items);
        }
    }

    if (iteration >= MAX_ITERATIONS) {
        console.warn(`Scheduler: Máximo de iteraciones (${MAX_ITERATIONS}) alcanzado. El timeline puede no estar completamente optimizado.`);
    }

    return items;
};

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

export const simulateSchedule = (
    items: ProductionScheduleItem[],
    globalStart: Date,
    holidays: string[] = [],
    manualStops: { id: string; start: Date; durationMinutes: number; label: string }[] = []
): EnhancedScheduleItem[] => {
    if (items.length === 0) return [];

    // Fase 1: Construir baseline con solo paradas Tipo A
    const baseline = buildBaseline(items, globalStart);

    // Fase 2: Insertar paradas Tipo B/C iterativamente hasta convergencia
    const result = insertTypeBCStops(baseline, holidays, manualStops);

    return result;
};
