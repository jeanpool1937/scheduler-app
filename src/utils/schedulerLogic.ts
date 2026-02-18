
import { addMinutes, differenceInMilliseconds, getDay, isAfter, isBefore, setHours, setMinutes, startOfDay, addDays, format, differenceInMinutes } from 'date-fns';
import type { ProductionScheduleItem, SegmentType, WorkSchedule } from '../types';

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
const MAX_ITERATIONS = 200;

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
    off_shift: '#f3f4f6',
};

const SEGMENT_LABELS: Record<SegmentType, string> = {
    production: 'Producción',
    changeover: 'Cambio de Medida',
    adjustment: 'Acierto y Calib.',
    quality_change: 'Cambio Calidad',
    stop_change: 'Cambio de Tope',
    ring_change: 'Cambio Anillo',
    channel_change: 'Cambio Canal',
    maintenance_hp: 'Mantenimiento',
    forced_stop: 'Parada Manual',
    off_shift: 'Fuera de Turno',
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
// WORK SCHEDULE HELPERS
// ============================================================

/**
 * Verifica si un momento dado está dentro del horario de operación.
 * Con el modelo por día, cada día tiene su propia configuración.
 */
const isInOperatingHours = (date: Date, ws: WorkSchedule): boolean => {
    if (ws.is24h) return true;

    const day = getDay(date);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const currentMinutesOfDay = hour * 60 + minute;

    // Primero verificar si este day-config tiene turno que empieza HOY
    const dayConfig = ws.days[day];
    if (dayConfig && dayConfig.active && dayConfig.hours > 0) {
        const startMinutesOfDay = dayConfig.startHour * 60 + dayConfig.startMinute;
        const endMinutesOfDay = startMinutesOfDay + dayConfig.hours * 60;

        if (endMinutesOfDay <= 1440) {
            // No cruza medianoche
            if (currentMinutesOfDay >= startMinutesOfDay && currentMinutesOfDay < endMinutesOfDay) {
                return true;
            }
        } else {
            // Cruza medianoche - parte nocturna (22:00-23:59) pertenece a HOY
            if (currentMinutesOfDay >= startMinutesOfDay) {
                return true;
            }
        }
    }

    // Verificar si estamos en la parte diurna de un turno que EMPEZÓ AYER
    const prevDay = (day + 6) % 7; // Día anterior
    const prevConfig = ws.days[prevDay];
    if (prevConfig && prevConfig.active && prevConfig.hours > 0) {
        const prevStartMinutes = prevConfig.startHour * 60 + prevConfig.startMinute;
        const prevEndMinutes = prevStartMinutes + prevConfig.hours * 60;

        if (prevEndMinutes > 1440) {
            // El turno de ayer cruza medianoche
            const endMinutesWrapped = prevEndMinutes - 1440;
            if (currentMinutesOfDay < endMinutesWrapped) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Dado un cursor fuera de horario, calcula cuándo empieza el próximo turno operativo.
 */
const getNextOperatingStart = (date: Date, ws: WorkSchedule): Date => {
    if (ws.is24h) return date;

    let cursor = new Date(date);
    // Intentar hasta 14 días adelante para encontrar el próximo turno
    for (let d = 0; d < 14; d++) {
        const day = getDay(cursor);
        const dayConfig = ws.days[day];

        if (dayConfig && dayConfig.active && dayConfig.hours > 0) {
            const opStart = setMinutes(setHours(new Date(cursor), dayConfig.startHour), dayConfig.startMinute);
            opStart.setSeconds(0, 0);

            if (opStart >= date) {
                return opStart;
            }
        }

        // Avanzar al día siguiente a medianoche
        cursor = startOfDay(addDays(cursor, 1));
    }

    // Fallback: no debería llegar aquí
    return date;
};

/**
 * Si el cursor está fuera de horario, avanza al próximo turno y retorna el gap.
 * Si está dentro del horario, retorna null.
 */
const advancePastOffShift = (
    cursor: Date,
    ws: WorkSchedule
): { nextStart: Date; gapMinutes: number } | null => {
    if (ws.is24h) return null;
    if (isInOperatingHours(cursor, ws)) return null;

    const nextStart = getNextOperatingStart(cursor, ws);
    const gapMinutes = getDurationInMinutes(nextStart, cursor);

    if (gapMinutes <= 0) return null;
    return { nextStart, gapMinutes };
};

/**
 * Calcula cuántos minutos de operación quedan desde el cursor hasta el fin del turno actual.
 * Ahora busca el turno activo que cubre este momento (puede ser del día actual o del anterior).
 */
const getMinutesUntilShiftEnd = (date: Date, ws: WorkSchedule): number => {
    if (ws.is24h) return Infinity;

    const day = getDay(date);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const currentMinutesOfDay = hour * 60 + minute;

    // Verificar turno que empieza HOY
    const dayConfig = ws.days[day];
    if (dayConfig && dayConfig.active && dayConfig.hours > 0) {
        const startMinutesOfDay = dayConfig.startHour * 60 + dayConfig.startMinute;
        const endMinutesOfDay = startMinutesOfDay + dayConfig.hours * 60;

        if (endMinutesOfDay <= 1440) {
            if (currentMinutesOfDay >= startMinutesOfDay && currentMinutesOfDay < endMinutesOfDay) {
                return endMinutesOfDay - currentMinutesOfDay;
            }
        } else {
            // Cruza medianoche - parte nocturna
            if (currentMinutesOfDay >= startMinutesOfDay) {
                return (1440 - currentMinutesOfDay) + (endMinutesOfDay - 1440);
            }
        }
    }

    // Verificar turno del DÍA ANTERIOR que cruza medianoche
    const prevDay = (day + 6) % 7; // Día anterior
    const prevConfig = ws.days[prevDay];
    if (prevConfig && prevConfig.active && prevConfig.hours > 0) {
        const prevStartMinutes = prevConfig.startHour * 60 + prevConfig.startMinute;
        const prevEndMinutes = prevStartMinutes + prevConfig.hours * 60;

        if (prevEndMinutes > 1440) {
            const endMinutesWrapped = prevEndMinutes - 1440;
            if (currentMinutesOfDay < endMinutesWrapped) {
                return endMinutesWrapped - currentMinutesOfDay;
            }
        }
    }

    return 0; // No estamos en ningún turno
};

// ============================================================
// FASE 1: BASELINE (Solo paradas Tipo A + producción lineal)
// ============================================================

const buildBaseline = (
    items: ProductionScheduleItem[],
    globalStart: Date,
    ws?: WorkSchedule
): EnhancedScheduleItem[] => {
    let cursor = new Date(globalStart);
    cursor.setSeconds(0, 0);

    // Si el inicio global cae fuera de turno, avanzar primero
    if (ws && !ws.is24h) {
        const gap = advancePastOffShift(cursor, ws);
        if (gap) {
            cursor = gap.nextStart;
        }
    }

    return items.map(item => {
        const itemStart = new Date(cursor);
        const segments: ScheduleSegment[] = [];

        // Helper: insertar off_shift si cursor está fuera de turno
        const insertOffShiftIfNeeded = () => {
            if (!ws || ws.is24h) return;
            const gap = advancePastOffShift(cursor, ws);
            if (gap) {
                segments.push(createSegment('off_shift', cursor, gap.gapMinutes, 'Fuera de Turno'));
                cursor = gap.nextStart;
            }
        };

        // Verificar off_shift al inicio de cada item
        insertOffShiftIfNeeded();

        // 1. Paradas manuales (forced_stop)
        if (item.stoppages) {
            Object.entries(item.stoppages).forEach(([stopId, duration]) => {
                if (duration > 0) {
                    segments.push(createSegment('forced_stop', cursor, duration, `Parada (ID: ${stopId})`));
                    cursor = addMinutes(cursor, duration);
                    insertOffShiftIfNeeded();
                }
            });
        }

        // 2. Ring/Channel manuales (desde datos importados, NO automáticos)
        if (item.ringChangeMinutes && item.ringChangeMinutes > 0) {
            segments.push(createSegment('ring_change', cursor, item.ringChangeMinutes, 'Cambio Anillo (Manual)'));
            cursor = addMinutes(cursor, item.ringChangeMinutes);
            insertOffShiftIfNeeded();
        }
        if (item.channelChangeMinutes && item.channelChangeMinutes > 0) {
            segments.push(createSegment('channel_change', cursor, item.channelChangeMinutes, 'Cambio Canal (Manual)'));
            cursor = addMinutes(cursor, item.channelChangeMinutes);
            insertOffShiftIfNeeded();
        }

        // 3. Paradas Tipo A (inter-orden) en orden de prioridad
        // R1: Cambio de Medida → cancela R2 y R3
        if (item.changeoverMinutes && item.changeoverMinutes > 0) {
            segments.push(createSegment('changeover', cursor, item.changeoverMinutes));
            cursor = addMinutes(cursor, item.changeoverMinutes);
            insertOffShiftIfNeeded();

            // R4: Acierto/Calibración (siempre con cambio de medida)
            if (item.adjustmentMinutes && item.adjustmentMinutes > 0) {
                segments.push(createSegment('adjustment', cursor, item.adjustmentMinutes));
                cursor = addMinutes(cursor, item.adjustmentMinutes);
                insertOffShiftIfNeeded();
            }
        } else if (item.qualityChangeMinutes && item.qualityChangeMinutes > 0) {
            // R2: Cambio de Calidad (solo si NO hubo cambio de medida)
            segments.push(createSegment('quality_change', cursor, item.qualityChangeMinutes));
            cursor = addMinutes(cursor, item.qualityChangeMinutes);
            insertOffShiftIfNeeded();
        } else if (item.stopChangeMinutes && item.stopChangeMinutes > 0) {
            // R3: Cambio de Tope (solo si NO hubo cambio de medida NI calidad)
            segments.push(createSegment('stop_change', cursor, item.stopChangeMinutes));
            cursor = addMinutes(cursor, item.stopChangeMinutes);
            insertOffShiftIfNeeded();
        }

        // 4. Producción - dividir por turnos si es necesario
        if (item.productionTimeMinutes > 0) {
            let remainingProd = item.productionTimeMinutes;

            while (remainingProd > 0.01) {
                insertOffShiftIfNeeded();

                if (ws && !ws.is24h) {
                    // Calcular cuánto queda del turno actual
                    const minutesLeft = getMinutesUntilShiftEnd(cursor, ws);
                    const chunk = Math.min(remainingProd, minutesLeft);

                    if (chunk > 0.01) {
                        segments.push(createSegment('production', cursor, chunk));
                        cursor = addMinutes(cursor, chunk);
                        remainingProd -= chunk;
                    } else {
                        // No queda tiempo en este turno, insertaremos off_shift en la próxima iteración
                        cursor = addMinutes(cursor, 0.1); // Pequeño avance para salir del límite
                    }
                } else {
                    // 24h continuo: un solo segmento de producción
                    segments.push(createSegment('production', cursor, remainingProd));
                    cursor = addMinutes(cursor, remainingProd);
                    remainingProd = 0;
                }
            }
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
/**
 * Encontrar todos los puntos de inserción necesarios para Tipo B/C
 * Implementa el patrón "Unified Daily Orchestrator" para resolver conflictos 
 * entre reglas que ocurren el mismo día.
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
    // ORQUESTADOR DIARIO (R5, R6, R7)
    // ===================================
    // Iteramos día a día para resolver dependencias entre paradas del mismo día
    let currentDay = startOfDay(timelineStart);
    const lastDay = addDays(startOfDay(timelineEnd), 1);

    while (isBefore(currentDay, lastDay) || currentDay.getTime() === lastDay.getTime()) {
        const dayOfWeek = getDay(currentDay);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHolidayDay = isHoliday(currentDay, holidays);

        // Variables de estado para el día actual
        let proposedRingChange: InsertionPoint | null = null;
        let proposedChannelChange: InsertionPoint | null = null;

        // ------------------------------------------------------------
        // PASO 1: R6 - Cambio de Canal (06:30)
        // ------------------------------------------------------------
        const channelTime = setMinutes(setHours(new Date(currentDay), CHANNEL_CHANGE_HOUR), CHANNEL_CHANGE_MIN);
        channelTime.setSeconds(0, 0);

        if (!isBefore(channelTime, timelineStart) && !isAfter(channelTime, timelineEnd)) {
            // Solo si NO existe ya uno en el timeline
            if (!hasSegmentAtTime(flat, 'channel_change', channelTime)) {
                // Verificar ventana de 7 horas atrás
                const windowStart = addMinutes(channelTime, -CHANNEL_CHANGE_WINDOW_HOURS * 60);
                const stoppageInWindow = calculateStoppageInWindow(flat, windowStart, channelTime);

                if (stoppageInWindow < CHANNEL_CHANGE_MIN_STOPPAGE) {
                    proposedChannelChange = {
                        timestamp: new Date(channelTime),
                        type: 'channel_change',
                        durationMinutes: CHANNEL_CHANGE_DURATION,
                    };
                    insertions.push(proposedChannelChange);
                }
            }
        }

        // ------------------------------------------------------------
        // PASO 2: R5 - Cambio de Anillo (18:30)
        // ------------------------------------------------------------
        const ringTime = setMinutes(setHours(new Date(currentDay), RING_CHANGE_HOUR), RING_CHANGE_MIN);
        ringTime.setSeconds(0, 0);

        if (!isBefore(ringTime, timelineStart) && !isAfter(ringTime, timelineEnd)) {
            if (!hasSegmentAtTime(flat, 'ring_change', ringTime)) {
                const windowStart = addMinutes(ringTime, -RING_CHANGE_WINDOW_HOURS * 60);
                // NOTA: Aquí idealmente deberíamos considerar 'proposedChannelChange' si cayera en ventana,
                // pero 06:30 está lejos de 11:30-18:30, así que no afecta.
                const stoppageInWindow = calculateStoppageInWindow(flat, windowStart, ringTime);

                if (stoppageInWindow < RING_CHANGE_MIN_STOPPAGE) {
                    proposedRingChange = {
                        timestamp: new Date(ringTime),
                        type: 'ring_change',
                        durationMinutes: RING_CHANGE_DURATION,
                    };
                    insertions.push(proposedRingChange);
                }
            }
        }

        // ------------------------------------------------------------
        // PASO 3: R7 - Mantenimiento Hora Punta (18:30-20:30)
        // ------------------------------------------------------------
        if (!isWeekend && !isHolidayDay) {
            const peakStart = setMinutes(setHours(new Date(currentDay), PEAK_START_HOUR), PEAK_START_MIN);
            peakStart.setSeconds(0, 0);
            const peakEnd = setMinutes(setHours(new Date(currentDay), PEAK_END_HOUR), PEAK_END_MIN);
            peakEnd.setSeconds(0, 0);

            if (!isBefore(peakStart, timelineStart) && !isAfter(peakStart, timelineEnd)) {
                // REMOVED: !hasHPCoverageInWindow check so we can iteratively "top up" maintenance
                // if previous iterations didn't cover enough (e.g. because stops moved out of window).

                // 1. Calcular cobertura "física" existente (Paradas Tipo A, etc.)
                const physicalCoverage = calculateStoppageInWindow(flat, peakStart, peakEnd);

                // 2. Calcular cobertura "virtual" del C. Anillo propuesto
                let virtualCoverage = 0;
                if (proposedRingChange) {
                    const rcStart = proposedRingChange.timestamp;
                    const rcEnd = addMinutes(rcStart, proposedRingChange.durationMinutes);

                    // Intersección entre RingChange propuesto y ventana Peak
                    const overlapStart = new Date(Math.max(rcStart.getTime(), peakStart.getTime()));
                    const overlapEnd = new Date(Math.min(rcEnd.getTime(), peakEnd.getTime()));

                    if (overlapStart < overlapEnd) {
                        virtualCoverage = differenceInMinutes(overlapEnd, overlapStart);
                    }
                }

                const totalCoverage = physicalCoverage + virtualCoverage;
                // Use a slightly larger epsilon to avoid tiny insertions
                const needed = Math.max(0, REQUIRED_HP_MINUTES - totalCoverage);

                if (needed > 0.5) { // Threshold 0.5 min to avoid micro-stops
                    // Determinar dónde insertar el mantenimiento
                    // Si hubo cambio de anillo a las 18:30 (60 min), el mantenimiento debería ir a continuación (19:30).
                    let potentialStart = findHPInsertionTime(flat, peakStart, peakEnd);

                    if (proposedRingChange) {
                        // Si hay anillo propuesto, intentamos pegar el mantenimiento justo después
                        const rcEnd = addMinutes(proposedRingChange.timestamp, proposedRingChange.durationMinutes);
                        if (potentialStart && rcEnd > potentialStart) {
                            potentialStart = rcEnd;
                        }
                    }

                    if (potentialStart && potentialStart < peakEnd) {
                        const distToEnd = getDurationInMinutes(peakEnd, potentialStart);
                        const actualDuration = Math.min(needed, distToEnd);

                        if (actualDuration > 0.5) {
                            insertions.push({
                                timestamp: new Date(potentialStart),
                                type: 'maintenance_hp',
                                durationMinutes: actualDuration,
                            });
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

    // Ordenar segmentos para asegurar búsqueda cronológica
    const sortedFlat = [...flat].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Buscar el primer hueco disponible (producción)
    for (const seg of sortedFlat) {
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
                                : `Mantenimiento (${Math.round(durationMinutes)} min)`;

                    newSegments.push(createSegment(type, timestamp, durationMinutes, stopDescription));

                    // Parte 3: Producción después de la parada
                    const stopEnd = addMinutes(timestamp, durationMinutes);
                    // FIX: No restar durationMinutes. El tiempo de producción restante debe conservarse (empujar el resto)
                    const afterDuration = getDurationInMinutes(seg.end, timestamp);

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
            // Skip off_shift segments during rebuild - they'll be in the right place
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

        // Aplicar inserciones (Chronological Order + One Change Per Pass)
        const sortedInsertions = [...insertions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        for (const insertion of sortedInsertions) {
            const inserted = insertStopIntoTimeline(items, insertion);
            if (inserted) {
                changed = true;
                break; // Restart loop to handle time shifts correctly
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
    manualStops: { id: string; start: Date; durationMinutes: number; label: string }[] = [],
    workSchedule?: WorkSchedule
): EnhancedScheduleItem[] => {
    if (items.length === 0) return [];

    // Fase 1: Construir baseline con solo paradas Tipo A (y off_shift)
    const baseline = buildBaseline(items, globalStart, workSchedule);

    // Fase 2: Insertar paradas Tipo B/C iterativamente hasta convergencia
    const result = insertTypeBCStops(baseline, holidays, manualStops);

    return result;
};
