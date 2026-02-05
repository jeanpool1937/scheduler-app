import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import { format, addDays, startOfDay, endOfDay, differenceInMinutes, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Printer } from 'lucide-react';
import type { ProductionScheduleItem } from '../types';

interface DailyEvent {
    id: string; // Original ID or generated for split
    originalItemId?: string;
    type: 'production' | 'changeover' | 'maintenance' | 'adjustment' | 'quality_change' | 'stop_change';
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
    const { schedule, stoppageConfigs } = useStore();
    const { articles } = useArticleStore();

    // 1. Process Schedule into Daily Buckets
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

        // Helper to add event
        const addEvent = (start: Date, end: Date, originalItem: ProductionScheduleItem, type: DailyEvent['type'], label: string, color: string, tonnage: number = 0, customDescription?: string) => {
            if (isAfter(start, end)) return; // Invalid

            let currentStart = start;
            while (currentStart < end) {
                const dayBucket = getDayBucket(currentStart);
                const dayEnd = endOfDay(currentStart);

                // Determine actual end for this day
                const actualEnd = isBefore(end, dayEnd) ? end : dayEnd;

                // Duration for this slice
                const duration = differenceInMinutes(actualEnd, currentStart);
                if (duration <= 0) break;

                const description = customDescription ||
                    (type === 'production'
                        ? `${articles.find(a => a.codigoProgramacion === originalItem.skuCode)?.descripcion || '---'}`
                        : label);

                dayBucket.events.push({
                    id: `${originalItem.id}_${dayBucket.events.length}`,
                    originalItemId: originalItem.id,
                    type,
                    label,
                    description,
                    startTime: currentStart,
                    endTime: actualEnd,
                    durationMinutes: duration,
                    skuCode: originalItem.skuCode,
                    tonnage: type === 'production' ? (tonnage * (duration / originalItem.productionTimeMinutes)) : 0, // Pro-rate tonnage if split? Or just 0 for non-prod
                    color
                });

                // Update totals
                if (type === 'production') {
                    dayBucket.totalProductionMinutes += duration;
                    // Pro-rate tonnage strictly for the day report? 
                    // Use a simpler approach: if it's the main chunk, log it? 
                    // Better: logic above pro-rates based on time fraction. 
                    // But originalItem.quantity is total. 
                    // tonnage arg passed is total. 
                    if (originalItem.productionTimeMinutes > 0) {
                        const timeFraction = duration / originalItem.productionTimeMinutes;
                        dayBucket.totalTonnage += (originalItem.quantity * timeFraction);
                    }
                } else {
                    dayBucket.totalStoppageMinutes += duration;
                }

                dayBucket.balanceMinutes -= duration;

                // Next iteration
                currentStart = addDays(startOfDay(currentStart), 1);
            }
        };

        schedule.forEach(item => {
            // Process sequence: 
            // 1. Changeover
            // 2. Quality Change
            // 3. Adjustment
            // 4. Stoppages (We need to decide WHERE they occur. Ideally before production? Or interleaved? 
            //    The current logic sums them up. Let's assume they happen BEFORE production for simplicity or sequentially based on logic.
            //    Standard: Changeover -> Quality -> Adjustment -> Production. 
            //    Stoppages: 'Mantenimiento' might be independent. 
            //    For now, we sequence them linearly starting from item.startTime which is calculated in store as "Start of the whole block".
            //    Wait, item.startTime in store INCLUDES changeovers. 
            //    So we need to reconstruct the internal timeline of the item.

            // Re-simulation of internal structure:
            let timer = new Date(item.startTime);

            // 1. Changeover
            if (item.changeoverMinutes && item.changeoverMinutes > 0) {
                const end = new Date(timer.getTime() + item.changeoverMinutes * 60000);
                addEvent(timer, end, item, 'changeover', 'Cambio de Medida', 'bg-red-100 text-red-800');
                timer = end;
            }

            // 2. Quality Change
            if (item.qualityChangeMinutes && item.qualityChangeMinutes > 0) {
                const end = new Date(timer.getTime() + item.qualityChangeMinutes * 60000);
                addEvent(timer, end, item, 'quality_change', 'Cambio Calidad', 'bg-pink-100 text-pink-800');
                timer = end;
            }

            // 3. Stop Change (Cambio de Tope)
            if (item.stopChangeMinutes && item.stopChangeMinutes > 0) {
                const end = new Date(timer.getTime() + item.stopChangeMinutes * 60000);
                addEvent(timer, end, item, 'stop_change', 'Cambio de Tope', 'bg-teal-100 text-teal-800');
                timer = end;
            }

            // 4. Adjustment
            if (item.adjustmentMinutes && item.adjustmentMinutes > 0) {
                const end = new Date(timer.getTime() + item.adjustmentMinutes * 60000);
                addEvent(timer, end, item, 'adjustment', 'Acierto y Calib.', 'bg-yellow-100 text-yellow-800');
                timer = end;
            }

            // 4. Stoppages (Dynamic)
            // We don't know the order of multiple stoppages, just sum. Let's sequence them.
            if (item.stoppages) {
                Object.entries(item.stoppages).forEach(([stopId, duration]) => {
                    if (duration > 0) {
                        const config = stoppageConfigs.find(c => c.id === stopId);
                        const end = new Date(timer.getTime() + duration * 60000);
                        addEvent(timer, end, item, 'maintenance', config?.label || 'Parada', 'bg-orange-100 text-orange-800');
                        timer = end;
                    }
                });
            }

            // 5. Production
            if (item.productionTimeMinutes > 0) {
                const end = new Date(timer.getTime() + item.productionTimeMinutes * 60000);
                const sku = articles.find(a => a.codigoProgramacion === item.skuCode);
                addEvent(timer, end, item, 'production', item.skuCode, 'bg-blue-50 text-blue-900', item.quantity,
                    `${sku?.descripcion} (${sku?.calidadPalanquilla})`);
                timer = end;
            }

            // Theoretical end should match item.endTime approx (give or take floating point diffs)
        });

        // Convert Map to Array and Sort
        return Array.from(daysMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    }, [schedule, articles, stoppageConfigs]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="text-blue-600" />
                    Programación Visual Diaria
                </h2>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition print:hidden"
                >
                    <Printer size={18} /> Imprimir
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-6 print:overflow-visible">
                {dailySchedules.map((day) => (
                    <div key={day.date.toISOString()} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden break-inside-avoid">
                        {/* Daily Header */}
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex flex-wrap justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-gray-800 capitalize">
                                    {format(day.date, 'EEEE d, MMMM yyyy', { locale: es })}
                                </h3>
                                <span className="text-sm px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-medium">
                                    {day.events.length} Eventos
                                </span>
                            </div>

                            <div className="flex gap-6 text-sm">
                                <div className="flex flex-col items-end">
                                    <span className="text-gray-500">Producción Total</span>
                                    <span className="font-bold text-gray-800">{day.totalTonnage.toFixed(0)} Ton</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-gray-500">Tiempo Prod.</span>
                                    <span className="font-bold text-green-700">{(day.totalProductionMinutes / 60).toFixed(1)} hrs</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-gray-500">Tiempo Paradas</span>
                                    <span className="font-bold text-red-600">{(day.totalStoppageMinutes / 60).toFixed(1)} hrs</span>
                                </div>
                                <div className="flex flex-col items-end border-l pl-6 border-gray-300">
                                    <span className="text-gray-500">Balance (24h)</span>
                                    <span className={`font-bold ${day.balanceMinutes < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                        {(day.balanceMinutes / 60).toFixed(1)} hrs Libres
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Events Table */}
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-500 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-2 font-medium w-32">Horario</th>
                                    <th className="px-6 py-2 font-medium w-24">Duración</th>
                                    <th className="px-6 py-2 font-medium w-40">Tipo/Código</th>
                                    <th className="px-6 py-2 font-medium">Descripción / Actividad</th>
                                    <th className="px-6 py-2 font-medium text-right">Toneladas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {day.events.map((event) => (
                                    <tr key={event.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-mono text-gray-600">
                                            {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                                        </td>
                                        <td className="px-6 py-3 text-gray-500">
                                            {event.durationMinutes.toFixed(0)} min
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${event.color}`}>
                                                {event.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-800 font-medium">
                                            {event.description}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-gray-700">
                                            {event.type === 'production' && event.tonnage
                                                ? event.tonnage.toFixed(1)
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}

                {dailySchedules.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Calendar size={48} className="mb-2 opacity-50" />
                        <p>No hay programación generada.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
