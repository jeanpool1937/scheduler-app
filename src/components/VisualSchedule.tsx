import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import { format, addDays, startOfDay, endOfDay, differenceInMinutes, differenceInMilliseconds, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Zap, Filter, Check, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { exportFullReport } from '../utils/excelExport';
import type { SegmentType } from '../types';

interface DailyEvent {
    id: string;
    originalItemId?: string;
    type: SegmentType;
    label: string;
    description: string;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    skuCode?: string;
    tonnage?: number;
    color: string;
}

interface DailySchedule {
    date: Date;
    events: DailyEvent[];
    totalTonnage: number;
    totalProductionMinutes: number;
    totalStoppageMinutes: number;
    balanceMinutes: number; // 24h * 60 - used
}

export const VisualSchedule: React.FC = () => {
    const { schedule, isHoliday, visualTargetDate, setVisualTargetDate } = useStore();
    const { articles } = useArticleStore();
    const [showPeakHoursOnly, setShowPeakHoursOnly] = React.useState(false);
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const [selectedTypes, setSelectedTypes] = React.useState<Set<string>>(new Set(['all']));

    // 0. Auto-scroll to target date if provided
    React.useEffect(() => {
        if (visualTargetDate) {
            const dateKey = format(visualTargetDate, 'yyyy-MM-dd');
            // Wait a tiny bit for render to stabilize if needed, though usually react's cycle is enough
            setTimeout(() => {
                const element = document.getElementById(`day - ${dateKey} `);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Visual feedback: brief highlight
                    const originalBg = element.style.backgroundColor;
                    element.style.backgroundColor = '#fde047'; // Yellow-300
                    setTimeout(() => {
                        element.style.backgroundColor = originalBg;
                    }, 1500);
                }
            }, 100);
            // Clear the target date so it doesn't scroll again on re-renders
            setVisualTargetDate(null);
        }
    }, [visualTargetDate, setVisualTargetDate]);

    // 1. Process Schedule into Daily Buckets (Using Segments from Store)
    const dailySchedules = useMemo(() => {
        const daysMap = new Map<string, DailySchedule>();

        // Helper to get or create day
        const getDayBucket = (date: Date): DailySchedule => {
            const dateKey = format(date, 'yyyy-MM-dd');
            if (!daysMap.has(dateKey)) {
                daysMap.set(dateKey, {
                    date: startOfDay(date),
                    events: [],
                    totalTonnage: 0,
                    totalProductionMinutes: 0,
                    totalStoppageMinutes: 0,
                    balanceMinutes: 24 * 60
                });
            }
            return daysMap.get(dateKey)!;
        };

        // Check if item overlaps with Peak Hours (Mon-Fri 18:30-20:30, excluding holidays)
        const checkPeakHourOverlap = (start: Date, end: Date): boolean => {
            const currentCheck = new Date(start);
            // We only care about the specific day of this segment for visualization
            const dayOfWeek = currentCheck.getDay();

            // Check if it's a weekday (Mon-Fri) AND not a holiday
            if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(currentCheck)) {
                const peakStart = new Date(currentCheck);
                peakStart.setHours(18, 30, 0, 0);
                const peakEnd = new Date(currentCheck);
                peakEnd.setHours(20, 30, 0, 0);

                // Overlap check: start < peakEnd && end > peakStart
                return start < peakEnd && end > peakStart;
            }
            return false;
        };

        schedule.forEach(item => {
            if (item.segments) {
                item.segments.forEach(seg => {
                    const start = new Date(seg.start);
                    const end = new Date(seg.end);

                    if (isAfter(start, end)) return;

                    // Handle segments spanning multiple days? 
                    // simulateSchedule handles logic, but segments might cross midnight?
                    // Usually we want to visualize them per day.
                    // If a segment crosses midnight, we split it here for VISUALIZATION only.

                    let currentStart = start;
                    while (currentStart < end) {
                        const dayBucket = getDayBucket(currentStart);
                        const dayEnd = endOfDay(currentStart);
                        const actualEnd = isBefore(end, dayEnd) ? end : dayEnd;
                        // PRECISION FIX: Use milliseconds to avoid integer rounding errors
                        // differenceInMinutes truncates, causing tonnage mismatch (e.g. 2900 vs 2897.1)
                        const duration = differenceInMilliseconds(actualEnd, currentStart) / 60000;

                        if (duration > 0) {
                            // FILTER APPLIED HERE:
                            // If filter is ON, and this specific chunk does NOT overlap with Peak Hours, skip it.
                            const matchesFilter = !showPeakHoursOnly || checkPeakHourOverlap(currentStart, actualEnd);

                            if (matchesFilter) {
                                // Add to bucket
                                dayBucket.events.push({
                                    id: `${item.id}_${dayBucket.events.length} `, // visual ID
                                    originalItemId: item.id,
                                    type: seg.type,
                                    label: seg.label,
                                    description: seg.description,
                                    startTime: currentStart,
                                    endTime: actualEnd,
                                    durationMinutes: duration,
                                    skuCode: item.skuCode,
                                    // Tonnage only applies to production
                                    tonnage: seg.type === 'production' && item.quantity && item.productionTimeMinutes > 0
                                        ? (item.quantity * (duration / item.productionTimeMinutes))
                                        : 0,
                                    color: seg.color
                                });

                                // Update Totals
                                if (seg.type === 'production') {
                                    dayBucket.totalProductionMinutes += duration;
                                    if (item.productionTimeMinutes > 0 && item.quantity) {
                                        dayBucket.totalTonnage += (item.quantity * (duration / item.productionTimeMinutes));
                                    }
                                } else {
                                    dayBucket.totalStoppageMinutes += duration;
                                }
                                dayBucket.balanceMinutes -= duration;
                            }
                        }

                        currentStart = addDays(startOfDay(currentStart), 1);
                    }
                });
            }
        });

        // Sort events within each day by start time AND Merge adjacent identical events
        daysMap.forEach(day => {
            day.events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

            const mergedEvents: DailyEvent[] = [];
            if (day.events.length > 0) {
                let current = day.events[0];

                for (let i = 1; i < day.events.length; i++) {
                    const next = day.events[i];

                    // Condición de fusión: Mismo tipo, misma descripción/label y continuidad temporal
                    // Especialmente útil para Mantenimiento partido
                    const isSameType = current.type === next.type;
                    const isSameLabel = current.label === next.label; // O description si prefieres, pero label suele ser el tipo
                    const isSameSku = current.skuCode === next.skuCode; // CRITICAL: Don't merge if SKU changes
                    const isContiguous = Math.abs(differenceInMinutes(next.startTime, current.endTime)) < 1; // Tolerancia 1 min

                    if (isSameType && isSameLabel && isSameSku && isContiguous) {
                        // MERGE
                        current.endTime = next.endTime;
                        current.durationMinutes += next.durationMinutes;
                        if (current.tonnage !== undefined && next.tonnage !== undefined) {
                            current.tonnage += next.tonnage;
                        }

                        // Update Description if it contains duration info (specifically for Maintenance)
                        if (current.type === 'maintenance_hp') {
                            current.description = `Mantenimiento(${Math.round(current.durationMinutes)} min)`;
                        }
                    } else {
                        // Push current and start new
                        mergedEvents.push(current);
                        current = next;
                    }
                }
                mergedEvents.push(current);
            }
            day.events = mergedEvents;
        });

        // Convert Map to Array and Sort
        return Array.from(daysMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    }, [schedule, articles, showPeakHoursOnly]);



    const handleExportExcel = async () => {
        try {
            // Enriquecer datos con descripciones reales de artículos
            const enrichedDailySchedules = dailySchedules.map(day => ({
                ...day,
                events: day.events.map(ev => {
                    if (ev.type === 'production' && ev.skuCode) {
                        const article = articles.find(a => a.codigoProgramacion === ev.skuCode);
                        return {
                            ...ev,
                            description: article ? article.descripcion : ev.description
                        };
                    }
                    return ev;
                })
            }));

            await exportFullReport({
                dailySchedules: enrichedDailySchedules,
                monthlyTotals,
                articles
            });
        } catch (error) {
            console.error("Export Error:", error);
            alert("Hubo un error al exportar a Excel. Revisa la consola para más detalles.");
        }
    };

    // Calculate Monthly Totals for the new compact Header
    const monthlyTotals = dailySchedules.reduce((acc, day) => ({
        tonnage: acc.tonnage + day.totalTonnage,
        productionMinutes: acc.productionMinutes + day.totalProductionMinutes,
        stoppageMinutes: acc.stoppageMinutes + day.totalStoppageMinutes
    }), { tonnage: 0, productionMinutes: 0, stoppageMinutes: 0 });

    // Filter Logic
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        dailySchedules.forEach(day => {
            day.events.forEach(event => {
                const type = event.type || 'unknown';
                counts[type] = (counts[type] || 0) + 1;
            });
        });
        return counts;
    }, [dailySchedules]);

    const availableTypes = useMemo(() => {
        const types = Object.keys(typeCounts).sort();
        // Move 'production' to the top if it exists
        if (types.includes('production')) {
            return ['production', ...types.filter(t => t !== 'production')];
        }
        return types;
    }, [typeCounts]);

    const toggleType = (type: string) => {
        const newTypes = new Set(selectedTypes);
        if (type === 'all') {
            if (newTypes.has('all')) {
                // If unchecking 'all', technically we should uncheck everything or decide behavior.
                // Better: 'all' is distinct. If clicking 'all', we clear others and set 'all'
                newTypes.clear();
                newTypes.add('all');
            } else {
                newTypes.clear();
                newTypes.add('all');
            }
        } else {
            newTypes.delete('all');
            if (newTypes.has(type)) {
                newTypes.delete(type);
                if (newTypes.size === 0) newTypes.add('all');
            } else {
                newTypes.add(type);
            }
        }
        setSelectedTypes(newTypes);
    };

    const SEGMENT_TYPE_LABELS: Record<string, string> = {
        production: 'Producción',
        changeover: 'Cambio de Medida',
        maintenance_hp: 'Mantenimiento HP',
        maintenance: 'Mantenimiento',
        lunch: 'Refrigerio',
        forced_stop: 'Parada Forzada',
        stop_change: 'Parada Cambio',
        quality_change: 'Cambio Calidad',
        ring_change: 'Cambio Anillo',
        channel_change: 'Cambio Canal',
        adjustment: 'Ajuste',
        unknown: 'Desconocido'
    };

    return (
        <div className="bg-white h-full overflow-y-auto relative p-4 font-sans text-gray-900">


            {/* Ultra Compact Global Header */}
            <header className="mb-4 border-b-2 border-black pb-2 flex justify-between items-end bg-white block">
                <div className="flex gap-8 items-end">
                    <div>
                        <h1 className="text-2xl font-black uppercase leading-none">Programación Mensual</h1>
                        <p className="text-sm font-black text-blue-900 mt-1">
                            Total: {monthlyTotals.tonnage.toLocaleString('en-US', { maximumFractionDigits: 0 })} Ton |
                            Prod: {(monthlyTotals.productionMinutes / 60).toFixed(1)}h |
                            Paradas: {(monthlyTotals.stoppageMinutes / 60).toFixed(1)}h
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    {/* FILTER DROPDOWN */}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`flex items - center gap - 2 px - 4 py - 2 rounded text - xs font - bold transition shadow ${!selectedTypes.has('all')
                                ? 'bg-blue-100 text-blue-700 border border-blue-300 ring-2 ring-blue-200'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                } `}
                        >
                            <Filter size={16} className={!selectedTypes.has('all') ? 'fill-current' : ''} />
                            FILTRAR EVENTOS
                            <ChevronDown size={14} />
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                                <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <span className="text-xs font-bold text-gray-500">TIPOS DE EVENTO</span>
                                    <button
                                        onClick={() => { setSelectedTypes(new Set(['all'])); setIsFilterOpen(false); }}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                    >
                                        VER TODO
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1">
                                    <button
                                        onClick={() => toggleType('all')}
                                        className={`w - full text - left px - 3 py - 2 text - xs flex items - center gap - 2 rounded hover: bg - gray - 50 ${selectedTypes.has('all') ? 'font-bold text-blue-700 bg-blue-50' : 'text-gray-700'} `}
                                    >
                                        <div className={`w - 4 h - 4 rounded border flex items - center justify - center ${selectedTypes.has('all') ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} `}>
                                            {selectedTypes.has('all') && <Check size={10} className="text-white" />}
                                        </div>
                                        Todos los tipos
                                    </button>
                                    {availableTypes.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => toggleType(type)}
                                            className={`w - full text - left px - 3 py - 2 text - xs flex items - center gap - 2 rounded hover: bg - gray - 50 ${selectedTypes.has(type) ? 'font-bold text-blue-700 bg-blue-50' : 'text-gray-700'} `}
                                        >
                                            <div className={`w - 4 h - 4 rounded border flex items - center justify - center ${selectedTypes.has(type) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} `}>
                                                {selectedTypes.has(type) && <Check size={10} className="text-white" />}
                                            </div>
                                            <span className="flex-1 truncate">{SEGMENT_TYPE_LABELS[type] || type}</span>
                                            <span className="text-gray-400 font-mono text-[10px]">{typeCounts[type]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isFilterOpen && (
                            <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                        )}
                    </div>

                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700 transition shadow"
                    >
                        <FileSpreadsheet size={16} /> EXCEL
                    </button>




                    <button
                        onClick={() => setShowPeakHoursOnly(!showPeakHoursOnly)}
                        className={`flex items - center gap - 2 px - 4 py - 2 rounded text - xs font - bold transition shadow ${showPeakHoursOnly
                            ? 'bg-purple-100 text-purple-700 border border-purple-300 ring-2 ring-purple-200'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            } `}
                        title="Mostrar solo items que intersectan Lunes-Viernes 18:30-20:30"
                    >
                        <Zap size={16} className={showPeakHoursOnly ? 'fill-current' : ''} />
                        HORA PUNTA
                    </button>
                </div>

            </header>

            {/* CONTINUOUS COMPACT TABLE */}
            <div>
                <table className="w-full text-[10px] leading-tight border-collapse">
                    <thead className="text-white">
                        <tr>
                            <th className="sticky top-0 z-20 bg-black p-1 text-left font-bold uppercase w-20 border border-gray-600 shadow-sm">Horario</th>
                            <th className="sticky top-0 z-20 bg-black p-1 text-center font-bold uppercase w-12 border border-gray-600 shadow-sm">Min</th>
                            <th className="sticky top-0 z-20 bg-black p-1 text-left font-bold uppercase w-24 border border-gray-600 shadow-sm">SKU / Tipo</th>
                            <th className="sticky top-0 z-20 bg-black p-1 text-left font-bold uppercase border border-gray-600 shadow-sm">Actividad / Descripción</th>
                            <th className="sticky top-0 z-20 bg-black p-1 text-right font-bold uppercase w-16 border border-gray-600 shadow-sm">
                                Ton
                                <div className="text-[9px] text-yellow-300 font-mono leading-none mt-1">
                                    Σ {monthlyTotals.tonnage.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailySchedules.map((day) => (
                            <React.Fragment key={day.date.toISOString()}>
                                {/* DAY HEADER ROW */}
                                <tr
                                    id={`day - ${format(day.date, 'yyyy-MM-dd')} `}
                                    className="bg-gray-200 border-t-2 border-black transition-colors duration-500"
                                >
                                    <td colSpan={5} className="p-1 border border-gray-400">
                                        <div className="flex justify-between items-baseline px-1">
                                            <span className="font-black text-sm uppercase print:text-xs">
                                                {format(day.date, 'EEEE d MMMM', { locale: es })}
                                            </span>
                                            <span className="font-mono text-[9px] font-bold">
                                                P: {(day.totalProductionMinutes / 60).toFixed(1)}h | S: {(day.totalStoppageMinutes / 60).toFixed(1)}h | {day.totalTonnage.toFixed(0)} T
                                            </span>
                                        </div>
                                    </td>
                                </tr>

                                {/* EVENT ROWS */}
                                {day.events.map((event) => {
                                    // Event Filtering Logic
                                    const isVisible = selectedTypes.has('all') || selectedTypes.has(event.type);

                                    if (!isVisible) return null;

                                    // Robust check for Peak Hour
                                    const labelUpper = event.label ? event.label.toUpperCase() : '';
                                    const descUpper = event.description ? event.description.toUpperCase() : '';
                                    const isPeakHour = labelUpper.includes('HORA PUNTA') || descUpper.includes('HORA PUNTA') || event.type === 'maintenance_hp';

                                    const isChangeover = event.type === 'changeover' || event.type === 'adjustment';
                                    const isStop = event.type === 'maintenance_hp' || event.type === 'forced_stop' || event.type === 'stop_change' || event.type === 'quality_change' || event.type === 'ring_change' || event.type === 'channel_change';

                                    // Row Styling Logic
                                    let rowClass = "border-b border-gray-200 print:border-gray-300";
                                    if (isPeakHour) rowClass += " bg-red-50 text-red-900 font-bold print:bg-gray-50";
                                    else if (isChangeover) rowClass += " bg-orange-50 print:bg-white";
                                    else if (isStop) rowClass += " bg-yellow-50 print:bg-white";

                                    // Color override from Segment
                                    const style = event.color ? { backgroundColor: `${event.color} 15` } : {};

                                    return (
                                        <tr key={event.id} className={rowClass} style={style}>
                                            {/* Time */}
                                            <td className="p-0.5 border-r border-gray-200 font-mono whitespace-nowrap text-center">
                                                {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                                            </td>

                                            {/* Duration */}
                                            <td className="p-0.5 border-r border-gray-200 text-center font-mono">
                                                {event.durationMinutes.toFixed(0)}
                                            </td>

                                            {/* SKU / Badge */}
                                            <td className="p-0.5 border-r border-gray-200 print:border-gray-300">
                                                <div className="flex items-center gap-1">
                                                    {event.skuCode ? (
                                                        <span className="font-black font-mono text-[10px] bg-gray-100 px-1 rounded">
                                                            {event.skuCode}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="px-1 rounded text-[8px] font-bold uppercase tracking-wider"
                                                            style={{ backgroundColor: event.color, color: '#333' }}
                                                        >
                                                            {event.label.substring(0, 10)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td className="p-0.5 border-r border-gray-200 print:border-gray-300">
                                                <span className={`font - semibold ${isPeakHour ? 'text-red-700' : 'text-gray-900'} `}>
                                                    {event.type === 'production' && event.skuCode
                                                        ? (articles.find(a => a.codigoProgramacion === event.skuCode)?.descripcion || event.description)
                                                        : event.description
                                                    }
                                                </span>
                                            </td>

                                            {/* Tonnage */}
                                            <td className="p-0.5 text-right font-mono font-bold">
                                                {event.type === 'production' && event.tonnage && event.tonnage > 0
                                                    ? event.tonnage.toFixed(1)
                                                    : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}

                        {dailySchedules.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                                    No hay programación generada para este rango.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
