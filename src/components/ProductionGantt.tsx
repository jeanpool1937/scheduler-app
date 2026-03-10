import React, { useMemo } from 'react';
import { format, addDays, startOfDay, endOfDay, differenceInMinutes, isBefore, isAfter, max, min } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ProductionScheduleItem, SegmentType } from '../types';
import { useArticleStore } from '../store/useArticleStore';
import { useStore } from '../store/useStore';

interface ProductionGanttProps {
    schedule: ProductionScheduleItem[];
    programStartDate: Date;
}

const SKU_COLORS = [
    '#2563eb', // blue-600
    '#16a34a', // green-600
    '#d97706', // amber-600
    '#9333ea', // purple-600
    '#db2777', // pink-600
    '#0d9488', // teal-600
    '#4f46e5', // indigo-600
    '#e11d48', // rose-600
    '#0284c7', // light blue-600
];

// Fallback colors for stoppages if segments don't define them
const STOPPAGE_COLORS: Record<string, string> = {
    'changeover': '#ef4444',     // red-500
    'quality_change': '#f97316', // orange-500
    'stop_change': '#84cc16',    // lime-500
    'adjustment': '#eab308',     // yellow-500
    'ring_change': '#a855f7',    // purple-500
    'channel_change': '#06b6d4', // cyan-500
    'maintenance_hp': '#64748b', // slate-500
    'forced_stop': '#ef4444',    // red-500
    'off_shift': '#334155',      // slate-700
};

interface GanttSegment {
    id: string;
    type: SegmentType;
    label: string;
    description: string;
    color: string;
    start: Date;
    end: Date;
    durationMinutes: number;
    skuId?: string;
    isStoppage: boolean;
}

interface GanttDay {
    date: Date;
    segments: GanttSegment[];
}

const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());
const safeDate = (d: any, fallback = new Date()) => {
    if (!d) return fallback;
    const pd = new Date(d);
    return isValidDate(pd) ? pd : fallback;
};

export const ProductionGantt: React.FC<ProductionGanttProps> = ({ schedule, programStartDate }) => {
    const activeProcessId = useStore((state) => state.activeProcessId);
    const articles = useArticleStore((state) => state.articlesByProcess[activeProcessId] || []);

    const segments = useMemo(() => {
        const allSegments: GanttSegment[] = [];
        const skuColorMap = new Map<string, string>();
        let colorIndex = 0;

        schedule.forEach(item => {
            if (!item.skuCode) return;
            // Assign a consistent color to each SKU
            if (!skuColorMap.has(item.skuCode)) {
                skuColorMap.set(item.skuCode, SKU_COLORS[colorIndex % SKU_COLORS.length]);
                colorIndex++;
            }
            const skuColor = skuColorMap.get(item.skuCode)!;

            if (item.segments && item.segments.length > 0) {
                item.segments.forEach((seg, idx) => {
                    const isProduction = seg.type === 'production';
                    const art = articles.find(a => a.codigoProgramacion === item.skuCode);

                    const label = isProduction ? item.skuCode : (seg.label || 'Parada');
                    let desc = seg.description || '';
                    if (isProduction && art) {
                        desc = `${art.descripcion} - ${item.quantity} Ton`;
                    }

                    const segStart = safeDate(seg.start);
                    const segEnd = safeDate(seg.end);

                    allSegments.push({
                        id: `${item.id}-${idx}`,
                        type: seg.type,
                        label,
                        description: desc,
                        color: isProduction ? skuColor : (seg.color || STOPPAGE_COLORS[seg.type] || '#cbd5e1'),
                        start: segStart,
                        end: segEnd,
                        durationMinutes: seg.durationMinutes || differenceInMinutes(segEnd, segStart),
                        skuId: item.skuCode,
                        isStoppage: !isProduction
                    });
                });
            } else if (item.startTime && item.endTime) {
                // Fallback for items that haven't been simulated to segments yet
                const art = articles.find(a => a.codigoProgramacion === item.skuCode);
                const isProduction = true;

                const segStart = safeDate(item.startTime);
                const segEnd = safeDate(item.endTime);

                allSegments.push({
                    id: item.id,
                    type: 'production',
                    label: item.skuCode,
                    description: art ? `${art.descripcion} - ${item.quantity} Ton` : 'Producción',
                    color: skuColor,
                    start: segStart,
                    end: segEnd,
                    durationMinutes: differenceInMinutes(segEnd, segStart),
                    skuId: item.skuCode,
                    isStoppage: !isProduction
                });
            }
        });

        allSegments.sort((a, b) => a.start.getTime() - b.start.getTime());
        return allSegments;
    }, [schedule, articles]);

    const { startDate, endDate } = useMemo(() => {
        const pStart = safeDate(programStartDate);
        if (segments.length === 0) return { startDate: startOfDay(pStart), endDate: endOfDay(pStart) };

        let minDate = segments[0].start;
        let maxDate = segments[0].end;
        segments.forEach(seg => {
            if (isBefore(seg.start, minDate)) minDate = seg.start;
            if (isAfter(seg.end, maxDate)) maxDate = seg.end;
        });

        if (isBefore(pStart, minDate)) minDate = pStart;

        return { startDate: startOfDay(minDate), endDate: endOfDay(maxDate) };
    }, [segments, programStartDate]);

    const days = useMemo(() => {
        const d: GanttDay[] = [];
        let current = startDate;
        while (isBefore(current, endDate) || current.getTime() === startOfDay(endDate).getTime()) {
            d.push({
                date: current,
                segments: []
            });
            current = addDays(current, 1);
        }
        return d;
    }, [startDate, endDate]);

    const daysWithSegments = useMemo(() => {
        const result = days.map(d => ({ ...d, segments: [] as GanttSegment[] }));

        segments.forEach(seg => {
            result.forEach(dayInfo => {
                const dStart = dayInfo.date;
                const dEnd = endOfDay(dStart);

                // Detailed overlap logic using date-fns
                // A segment overlaps a day if it starts before the day ends AND ends after the day starts
                if (isBefore(seg.start, dEnd) && isAfter(seg.end, dStart)) {
                    const sliceStart = max([seg.start, dStart]);
                    const sliceEnd = min([seg.end, dEnd]);
                    const duration = differenceInMinutes(sliceEnd, sliceStart);

                    if (duration > 0) {
                        dayInfo.segments.push({
                            ...seg,
                            start: sliceStart,
                            end: sliceEnd,
                            durationMinutes: duration,
                            id: `${seg.id}-${format(dStart, 'yyyyMMdd')}`
                        });
                    }
                }
            });
        });

        return result;
    }, [days, segments]);

    if (schedule.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mt-6 mx-4 flex flex-col mb-4 max-h-[400px]">
            <div className="flex items-center justify-between mb-2 shrink-0 p-4 pb-0">
                <h3 className="text-lg font-bold text-gray-800 tracking-tight">Cronograma de Ejecución Diaria</h3>

                <div className="flex items-center gap-4 text-xs bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-[#2563eb]"></div>
                        <span className="text-gray-600 font-bold uppercase tracking-wider text-[10px]">Producción</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-red-400"></div>
                        <span className="text-gray-600 font-bold uppercase tracking-wider text-[10px]">Paradas</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto mt-2 p-1">
                <div className="min-w-[1000px] relative">

                    {/* Header: X-Axis (Horas) */}
                    <div className="flex border-b border-gray-200 bg-white sticky top-0 z-30 shadow-sm">
                        <div className="w-24 shrink-0 border-r border-gray-200 p-2 font-black text-[10px] text-gray-400 uppercase tracking-widest flex items-center justify-center bg-gray-50/50">
                            Día
                        </div>
                        <div className="flex-1 relative h-8 bg-gray-50/20">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className="absolute top-0 bottom-0 border-r border-gray-200/50 border-dashed" style={{ left: `${(i / 24) * 100}%`, width: `${(1 / 24) * 100}%` }}>
                                    <span className="absolute -left-3 top-2 text-[10px] font-bold text-gray-400 font-mono bg-white px-1 shadow-[0_0_10px_white]">{i.toString().padStart(2, '0')}:00</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows: Y-Axis (Días) */}
                    <div className="flex flex-col relative z-10 pb-4">
                        {daysWithSegments.map(dayInfo => (
                            <div key={dayInfo.date.toISOString()} className="flex border-b border-gray-100 hover:bg-blue-50/20 transition-colors group">
                                {/* Day Label */}
                                <div className="w-24 shrink-0 border-r border-gray-200 p-2 flex flex-col items-center justify-center bg-white group-hover:bg-blue-50/20 z-20">
                                    <span className="text-xs font-black text-gray-700 capitalize tracking-tight">{format(dayInfo.date, 'EEEE', { locale: es }).slice(0, 3)}</span>
                                    <span className="text-[10px] font-bold text-gray-400 font-mono">{format(dayInfo.date, 'dd/MM')}</span>
                                </div>

                                {/* Day Timeline */}
                                <div className="flex-1 relative h-14 bg-transparent py-2">
                                    {/* Grid lines */}
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <div key={`grid-${i}`} className="absolute top-0 bottom-0 border-r border-gray-100/60 border-dashed pointer-events-none" style={{ left: `${(i / 24) * 100}%` }} />
                                    ))}

                                    {/* Segments */}
                                    {dayInfo.segments.map(seg => {
                                        try {
                                            const dStart = startOfDay(dayInfo.date);
                                            const startMins = differenceInMinutes(seg.start, dStart);
                                            const durationMins = seg.durationMinutes;
                                            const totalMins = 24 * 60;

                                            const leftPct = Math.max(0, (startMins / totalMins) * 100);
                                            const widthPct = Math.min(100 - leftPct, (durationMins / totalMins) * 100);

                                            const minVisualWidth = seg.isStoppage && durationMins > 0 ? Math.max(0.4, widthPct) : widthPct;
                                            const finalWidth = minVisualWidth;

                                            const formatSafe = (d: Date, f: string) => {
                                                if (!isValidDate(d)) return '---';
                                                try { return format(d, f); } catch (e) { return '---'; }
                                            };

                                            return (
                                                <div
                                                    key={seg.id}
                                                    className={`absolute top-1.5 bottom-1.5 rounded-md text-[9px] flex items-center justify-center font-bold text-white shadow-sm overflow-hidden whitespace-nowrap px-1 hover:brightness-110 hover:shadow-md hover:scale-[1.03] hover:z-30 border border-black/10 transition-all cursor-crosshair ${seg.isStoppage ? 'opacity-90 hover:opacity-100' : ''}`}
                                                    style={{
                                                        left: `${leftPct}%`,
                                                        width: `${finalWidth}%`,
                                                        backgroundColor: seg.color || '#ccc'
                                                    }}
                                                    title={`${seg.label}\n${formatSafe(seg.start, 'HH:mm')} - ${formatSafe(seg.end, 'HH:mm')} (${durationMins}m)\n${seg.description}`}
                                                >
                                                    {finalWidth > 3.5 && (seg.isStoppage ? (finalWidth > 5 ? seg.label : '') : seg.label)}
                                                </div>
                                            );
                                        } catch (e) {
                                            console.error('Error rendering segment:', seg, e);
                                            return null;
                                        }
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

class ProductionGanttErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: Error) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Gantt Chart Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200 mt-6 mx-4">
                    <h3 className="text-red-800 font-bold mb-2">Gantt Chart Error</h3>
                    <p className="text-red-600 text-sm">Failed to render Gantt chart due to invalid data format.</p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="mt-3 px-4 py-2 bg-white text-red-700 border border-red-200 rounded-lg text-sm font-bold shadow-sm"
                    >
                        Retry Render
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export const ProductionGanttWrapper: React.FC<ProductionGanttProps> = (props) => (
    <ProductionGanttErrorBoundary>
        <ProductionGantt {...props} />
    </ProductionGanttErrorBoundary>
);
