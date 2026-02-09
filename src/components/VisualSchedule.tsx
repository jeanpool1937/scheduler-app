import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import { format, addDays, startOfDay, endOfDay, differenceInMinutes, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, Zap } from 'lucide-react';
import type { ProductionScheduleItem } from '../types';

interface DailyEvent {
    id: string; // Original ID or generated for split
    type: 'production' | 'changeover' | 'maintenance' | 'maintenance_hp' | 'adjustment' | 'quality_change' | 'stop_change' | 'ring_change' | 'channel_change';
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
    const { schedule, isHoliday } = useStore();
    const { articles } = useArticleStore();
    const [showPeakHoursOnly, setShowPeakHoursOnly] = React.useState(false);

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
        const isPeakHourOverlap = (item: ProductionScheduleItem) => {
            if (!item.startTime || !item.endTime) return false;
            const start = new Date(item.startTime);
            const end = new Date(item.endTime);
            const currentCheck = new Date(start);
            currentCheck.setHours(0, 0, 0, 0);
            const lastDay = new Date(end);
            lastDay.setHours(0, 0, 0, 0);

            while (currentCheck <= lastDay) {
                const dayOfWeek = currentCheck.getDay();
                // Check if it's a weekday (Mon-Fri) AND not a holiday
                if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(currentCheck)) {
                    const peakStart = new Date(currentCheck);
                    peakStart.setHours(18, 30, 0, 0);
                    const peakEnd = new Date(currentCheck);
                    peakEnd.setHours(20, 30, 0, 0);
                    if (start < peakEnd && end > peakStart) return true;
                }
                currentCheck.setDate(currentCheck.getDate() + 1);
            }
            return false;
        };

        const filteredSchedule = showPeakHoursOnly
            ? schedule.filter(isPeakHourOverlap)
            : schedule;

        filteredSchedule.forEach(item => {
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
                        const duration = differenceInMinutes(actualEnd, currentStart);

                        if (duration <= 0) break;

                        // Add to bucket
                        dayBucket.events.push({
                            id: `${item.id}_${dayBucket.events.length}`, // visual ID
                            originalItemId: item.id,
                            type: seg.type as any, // Cast to match
                            label: seg.label,
                            description: seg.description,
                            startTime: currentStart,
                            endTime: actualEnd,
                            durationMinutes: duration,
                            skuCode: item.skuCode,
                            // Tonnage only applies to production
                            tonnage: seg.type === 'production' && item.quantity
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

                        currentStart = addDays(startOfDay(currentStart), 1);
                    }
                });
            }
        });

        // Sort events within each day by start time
        daysMap.forEach(day => {
            day.events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        });

        // Convert Map to Array and Sort
        return Array.from(daysMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    }, [schedule, articles, showPeakHoursOnly]);

    const handlePrint = () => {
        window.print();
    };

    // Flatten functionality for the continuous table is handled via nested mapping in the render

    // Calculate Monthly Totals for the new compact Header
    const monthlyTotals = dailySchedules.reduce((acc, day) => ({
        tonnage: acc.tonnage + day.totalTonnage,
        productionMinutes: acc.productionMinutes + day.totalProductionMinutes,
        stoppageMinutes: acc.stoppageMinutes + day.totalStoppageMinutes
    }), { tonnage: 0, productionMinutes: 0, stoppageMinutes: 0 });

    return (
        <div className="bg-white h-full overflow-y-auto relative p-4 print:p-0 font-sans text-gray-900 print:text-black print:overflow-visible print:h-auto print:block">
            {/* INJECTED PRINT STYLES */}
            <style>{`
                @media print {
                    @page { margin: 1cm; size: A4 portrait; }
                    html, body, #root, .app-container {
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        display: block !important;
                        background: white !important;
                    }
                    /* Reset any potential flex/grid constraints in parents */
                    div {
                        display: block !important;
                        height: auto !important;
                        position: static !important;
                        overflow: visible !important;
                    }
                    
                    /* Table Mechanics */
                    table {
                        width: 100% !important;
                        table-layout: fixed !important;
                        border-collapse: collapse !important;
                    }
                    thead { display: table-header-group !important; }
                    tfoot { display: table-footer-group !important; }
                    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
                    td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
                    
                    /* Hide UI */
                    button, nav, header:not(.print-header) { display: none !important; }
                }
            `}</style>

            {/* Ultra Compact Global Header */}
            <header className="print-header mb-4 border-b-2 border-black pb-2 flex justify-between items-end print:mb-2 bg-white block">
                <div className="flex gap-8 items-end">
                    <div>
                        <h1 className="text-2xl font-black uppercase leading-none">Programación Mensual</h1>
                        <p className="text-xs font-bold text-gray-500">Total: {monthlyTotals.tonnage.toFixed(0)} Ton | Prod: {(monthlyTotals.productionMinutes / 60).toFixed(1)}h | Paradas: {(monthlyTotals.stoppageMinutes / 60).toFixed(1)}h</p>
                    </div>
                </div>

                <div className="flex gap-4 items-center print:hidden">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded text-xs font-bold hover:bg-gray-800 transition shadow"
                    >
                        <Printer size={16} /> IMPRIMIR (A4 COMPACTO)
                    </button>
                    <button
                        onClick={() => setShowPeakHoursOnly(!showPeakHoursOnly)}
                        className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition shadow ${showPeakHoursOnly
                            ? 'bg-purple-100 text-purple-700 border border-purple-300 ring-2 ring-purple-200'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        title="Mostrar solo items que intersectan Lunes-Viernes 18:30-20:30"
                    >
                        <Zap size={16} className={showPeakHoursOnly ? 'fill-current' : ''} />
                        HORA PUNTA
                    </button>
                </div>
                <div className="text-right hidden print:block">
                    <p className="text-[10px] font-bold uppercase text-gray-500">Scheduler v2</p>
                    <p className="text-[8px] text-gray-400 font-mono">{format(new Date(), 'dd/MM/yy HH:mm')}</p>
                </div>
            </header>

            {/* CONTINUOUS COMPACT TABLE */}
            <div className="print:overflow-visible">
                <table className="w-full text-[10px] leading-tight border-collapse print:text-[9px]">
                    <thead className="text-white print:text-black">
                        <tr>
                            <th className="sticky top-0 z-20 bg-black print:bg-gray-200 p-1 text-left font-bold uppercase w-20 border border-gray-600 print:border-gray-400 shadow-sm">Horario</th>
                            <th className="sticky top-0 z-20 bg-black print:bg-gray-200 p-1 text-center font-bold uppercase w-12 border border-gray-600 print:border-gray-400 shadow-sm">Min</th>
                            <th className="sticky top-0 z-20 bg-black print:bg-gray-200 p-1 text-left font-bold uppercase w-24 border border-gray-600 print:border-gray-400 shadow-sm">SKU / Tipo</th>
                            <th className="sticky top-0 z-20 bg-black print:bg-gray-200 p-1 text-left font-bold uppercase border border-gray-600 print:border-gray-400 shadow-sm">Actividad / Descripción</th>
                            <th className="sticky top-0 z-20 bg-black print:bg-gray-200 p-1 text-right font-bold uppercase w-16 border border-gray-600 print:border-gray-400 shadow-sm">Ton</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailySchedules.map((day) => (
                            <React.Fragment key={day.date.toISOString()}>
                                {/* DAY HEADER ROW */}
                                <tr className="bg-gray-200 print:bg-gray-300 border-t-2 border-black break-after-avoid">
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
                                    // Robust check for Peak Hour
                                    const labelUpper = event.label.toUpperCase();
                                    const descUpper = event.description.toUpperCase();
                                    const isPeakHour = labelUpper.includes('HORA PUNTA') || descUpper.includes('HORA PUNTA') || event.type === 'maintenance_hp';

                                    const isChangeover = event.type === 'changeover';
                                    const isStop = event.type === 'maintenance' || event.type === 'maintenance_hp' || event.type === 'stop_change' || event.type === 'quality_change' || event.type === 'ring_change' || event.type === 'channel_change';

                                    // Row Styling Logic
                                    let rowClass = "border-b border-gray-200 print:border-gray-300";
                                    if (isPeakHour) rowClass += " bg-red-50 text-red-900 font-bold print:bg-gray-50";
                                    else if (isChangeover) rowClass += " bg-orange-50 print:bg-white";
                                    else if (isStop) rowClass += " bg-yellow-50 print:bg-white";

                                    return (
                                        <tr key={event.id} className={rowClass}>
                                            {/* Time */}
                                            <td className="p-0.5 border-r border-gray-200 print:border-gray-300 font-mono whitespace-nowrap">
                                                {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                                            </td>

                                            {/* Duration */}
                                            <td className="p-0.5 border-r border-gray-200 print:border-gray-300 text-center font-mono">
                                                {event.durationMinutes.toFixed(0)}
                                            </td>

                                            {/* SKU / Badge */}
                                            <td className="p-0.5 border-r border-gray-200 print:border-gray-300">
                                                <div className="flex items-center gap-1">
                                                    {event.skuCode ? (
                                                        <span className="font-black font-mono text-[10px] bg-gray-100 px-1 rounded print:bg-transparent print:border print:border-gray-400">
                                                            {event.skuCode}
                                                        </span>
                                                    ) : (
                                                        <span className={`px-1 rounded text-[8px] font-bold uppercase tracking-wider print:border print:border-black print:bg-transparent ${event.color}`}>
                                                            {event.label.substring(0, 10)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td className="p-0.5 border-r border-gray-200 print:border-gray-300">
                                                <span className={`font-semibold ${isPeakHour ? 'text-red-700' : 'text-gray-900'}`}>
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
