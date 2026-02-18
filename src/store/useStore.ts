import { create } from 'zustand';
import type { AppState, ProcessData, ProductionScheduleItem, StoppageConfig, WorkSchedule, ProcessId } from '../types';
import type { Article } from '../types/article';
import { useArticleStore } from './useArticleStore';
import { useChangeoverStore } from './useChangeoverStore';
import type { ChangeoverRule } from '../types/changeover';
import { format } from 'date-fns';
import { simulateSchedule } from '../utils/schedulerLogic';
import { supabase } from '../lib/supabaseClient';

// Helper: Extract length (in meters) from description
const extractLengthFromDescription = (desc: string | undefined): string | null => {
    if (!desc) return null;
    const match = desc.match(/X\s*(\d+(?:\.\d+)?)\s?M/i);
    return match ? match[1] : null;
};

const recalculate = (
    items: ProductionScheduleItem[],
    articles: Article[],
    rules: ChangeoverRule[],
    startDate: Date,
    holidays: string[] = [],
    manualStops: { id: string; start: Date; durationMinutes: number; label: string }[] = [],
    workSchedule?: WorkSchedule
): ProductionScheduleItem[] => {
    let sorted = [...items].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    // Phase 1: Calculate Static Attributes
    const preProcessedItems = sorted.map((item, index) => {
        const cleanSku = String(item.skuCode || '').replace(/\s+/g, '');
        let article = articles.find(a => String(a.codigoProgramacion || '').replace(/\s+/g, '') === cleanSku);
        if (!article) {
            article = articles.find(a => String(a.skuLaminacion || '') === cleanSku);
        }

        const pace = parseFloat(String(article?.ritmoTH || 0)) || 0;

        // 1. Calculate Changeover
        let changeoverMinutes = 0;
        if (index > 0) {
            const prevItem = sorted[index - 1];
            const cleanPrevSku = String(prevItem.skuCode || '').replace(/\s+/g, '');
            let prevArticle = articles.find(a => String(a.codigoProgramacion || '').replace(/\s+/g, '') === cleanPrevSku);
            if (!prevArticle) {
                prevArticle = articles.find(a => String(a.skuLaminacion || '') === cleanPrevSku);
            }

            if (article?.idTablaCambioMedida && prevArticle?.idTablaCambioMedida) {
                const fromId = String(prevArticle.idTablaCambioMedida).trim();
                const toId = String(article.idTablaCambioMedida).trim();
                const rule = rules.find(r =>
                    String(r.fromId).trim() === fromId &&
                    String(r.toId).trim() === toId
                );
                if (rule) {
                    changeoverMinutes = (rule.durationHours || 0) * 60;
                }
            }
        }

        // 1.2 Calculate Quality Change
        let qualityChangeMinutes = 0;
        if (index > 0 && changeoverMinutes === 0) {
            const prevItem = sorted[index - 1];
            const prevArticle = articles.find(a => a.codigoProgramacion === prevItem.skuCode);
            if (article?.calidadPalanquilla && prevArticle?.calidadPalanquilla) {
                if (article.calidadPalanquilla.trim() !== prevArticle.calidadPalanquilla.trim()) {
                    qualityChangeMinutes = 60;
                }
            }
        }

        // 1.3 Calculate Stop Change
        let stopChangeMinutes = 0;
        if (index > 0 && changeoverMinutes === 0 && qualityChangeMinutes === 0) {
            const prevItem = sorted[index - 1];
            const prevArticle = articles.find(a => a.codigoProgramacion === prevItem.skuCode);
            const currentLength = extractLengthFromDescription(article?.descripcion);
            const prevLength = extractLengthFromDescription(prevArticle?.descripcion);
            if (currentLength && prevLength && currentLength !== prevLength) {
                stopChangeMinutes = 10;
            }
        }

        // 1.5 Adjustment
        let adjustmentMinutes = 0;
        if (changeoverMinutes > 0) {
            adjustmentMinutes = (article?.aciertoCalibracion || 0) * 60;
        }

        // 2. Production Minutes
        let prodMinutes = 0;
        if (pace > 0 && item.quantity > 0) {
            prodMinutes = (item.quantity / pace) * 60;
        }

        return {
            ...item,
            changeoverMinutes,
            qualityChangeMinutes,
            stopChangeMinutes,
            adjustmentMinutes,
            productionTimeMinutes: prodMinutes,
            calculatedPace: pace
        };
    });

    // Phase 2: Simulate Timeline
    const simulatedItems = simulateSchedule(preProcessedItems, startDate, holidays, manualStops, workSchedule);

    // Phase 3: Map back
    return simulatedItems.map(simItem => ({
        ...simItem,
        startTime: simItem.computedStart,
        endTime: simItem.computedEnd,
        segments: simItem.segments
    }));
};

const initialStoppages: StoppageConfig[] = [
    { id: 's1', colId: 'col_change', label: 'Cambio Medida', defaultDuration: 0 },
    { id: 's2', colId: 'col_maint', label: 'Mantenimiento', defaultDuration: 0 },
];

const MAX_HISTORY = 5;

// Esquemas de trabajo por defecto
const makeDaySchedule = (active: boolean, hours: number, startHour: number, startMinute = 0): import('../types').DaySchedule => ({
    active, hours, startHour, startMinute
});

const DEFAULT_WORK_SCHEDULE_24_7: WorkSchedule = {
    is24h: true,
    days: {
        0: makeDaySchedule(true, 24, 0),
        1: makeDaySchedule(true, 24, 0),
        2: makeDaySchedule(true, 24, 0),
        3: makeDaySchedule(true, 24, 0),
        4: makeDaySchedule(true, 24, 0),
        5: makeDaySchedule(true, 24, 0),
        6: makeDaySchedule(true, 24, 0),
    }
};

const DEFAULT_WORK_SCHEDULE_LAM1: WorkSchedule = {
    is24h: false,
    days: {
        0: makeDaySchedule(true, 16, 22, 0),  // Dom
        1: makeDaySchedule(true, 16, 22, 0),  // Lun
        2: makeDaySchedule(true, 16, 22, 0),  // Mar
        3: makeDaySchedule(true, 16, 22, 0),  // Mié
        4: makeDaySchedule(true, 16, 22, 0),  // Jue
        5: makeDaySchedule(true, 16, 22, 0),  // Vie
        6: makeDaySchedule(false, 0, 0, 0),   // Sáb - no opera
    }
};

const getDefaultWorkSchedule = (processId: string): WorkSchedule => {
    if (processId === 'laminador1') return JSON.parse(JSON.stringify(DEFAULT_WORK_SCHEDULE_LAM1));
    return JSON.parse(JSON.stringify(DEFAULT_WORK_SCHEDULE_24_7));
};

const createInitialProcessData = (processId: string): ProcessData => ({
    schedule: [],
    stoppageConfigs: initialStoppages,
    programStartDate: new Date(),
    columnLabels: {},
    scheduleHistory: [],
    holidays: [],
    manualStops: [],
    workSchedule: getDefaultWorkSchedule(processId),
    visualTargetDate: null,
    sequencerConfig: {
        draftItems: [],
        params: {
            poblacion: 100,
            generaciones: 250,
            pesoVenta: 0.5,
            costoVP: 100,
            costoTC: 5000,
            tasaMutacion: 0.15,
            tasaElitismo: 0.1
        },
        lastResult: null
    }
});

export const useStore = create<AppState>((set, get) => ({
    activeProcessId: 'laminador1',
    processes: {
        'laminador1': createInitialProcessData('laminador1'),
        'laminador2': createInitialProcessData('laminador2'),
        'laminador3': createInitialProcessData('laminador3'),
    },
    activeTab: 'scheduler',

    // Global Actions
    setActiveProcess: async (id) => {
        set({ activeProcessId: id });
        // Trigger fetch for other stores when process changes
        await Promise.all([
            useArticleStore.getState().fetchArticles(id),
            useChangeoverStore.getState().fetchRules(id),
            (get() as any).fetchProcessData(id)
        ]);
    },
    setActiveTab: (tab) => set({ activeTab: tab }),

    // Fetch Configs and Schedule
    fetchProcessData: async (processId: ProcessId) => {
        const [configRes, itemsRes, stopsRes, manualRes] = await Promise.all([
            supabase.from('scheduler_process_configs').select('*').eq('id', processId).single(),
            supabase.from('scheduler_production_items').select('*').eq('process_id', processId).order('sequence_order'),
            supabase.from('scheduler_stoppage_configs').select('*').eq('process_id', processId),
            supabase.from('scheduler_manual_stops').select('*').eq('process_id', processId)
        ]);

        if (configRes.data) {
            set((state) => ({
                processes: {
                    ...state.processes,
                    [processId]: {
                        ...state.processes[processId],
                        programStartDate: new Date(configRes.data.program_start_date),
                        workSchedule: configRes.data.work_schedule,
                        holidays: configRes.data.holidays,
                        columnLabels: configRes.data.column_labels,
                        visualTargetDate: configRes.data.visual_target_date ? new Date(configRes.data.visual_target_date) : null,
                        sequencerConfig: configRes.data.sequencer_config || state.processes[processId].sequencerConfig
                    }
                }
            }));
        }

        if (itemsRes.data) {
            const mappedItems: ProductionScheduleItem[] = itemsRes.data.map(d => ({
                id: d.id,
                sequenceOrder: d.sequence_order,
                skuCode: d.sku_code,
                quantity: Number(d.quantity),
                stoppages: d.stoppages,
                startTime: new Date(), // Will be recalculated
                endTime: new Date(),
                calculatedPace: 0,
                productionTimeMinutes: 0
            }));

            set((state) => ({
                processes: {
                    ...state.processes,
                    [processId]: {
                        ...state.processes[processId],
                        schedule: mappedItems
                    }
                }
            }));
        }

        if (stopsRes.data && stopsRes.data.length > 0) {
            set((state) => ({
                processes: {
                    ...state.processes,
                    [processId]: {
                        ...state.processes[processId],
                        stoppageConfigs: stopsRes.data.map(s => ({
                            id: s.id,
                            colId: s.col_id,
                            label: s.label,
                            defaultDuration: Number(s.default_duration)
                        }))
                    }
                }
            }));
        }

        if (manualRes.data) {
            set((state) => ({
                processes: {
                    ...state.processes,
                    [processId]: {
                        ...state.processes[processId],
                        manualStops: manualRes.data.map(m => ({
                            id: m.id,
                            start: new Date(m.start_time),
                            durationMinutes: Number(m.duration_minutes),
                            label: m.label
                        }))
                    }
                }
            }));
        }

        get().recalculateSchedule();
    },

    saveProcessItems: async (processId: ProcessId, items: ProductionScheduleItem[]) => {
        // Bulk sync production items
        await supabase.from('scheduler_production_items').delete().eq('process_id', processId);
        const toInsert = items.map(it => ({
            id: it.id || crypto.randomUUID(),
            process_id: processId,
            sequence_order: it.sequenceOrder,
            sku_code: it.skuCode,
            quantity: it.quantity,
            stoppages: it.stoppages
        }));
        await supabase.from('scheduler_production_items').insert(toInsert);
    },

    _saveSnapshot: () => {
        set((state) => {
            const pid = state.activeProcessId;
            const pData = state.processes[pid];
            return {
                processes: {
                    ...state.processes,
                    [pid]: {
                        ...pData,
                        scheduleHistory: [JSON.parse(JSON.stringify(pData.schedule)), ...pData.scheduleHistory].slice(0, MAX_HISTORY)
                    }
                }
            };
        });
    },

    // Delegated Actions
    setProgramStartDate: async (date) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], programStartDate: date }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ program_start_date: date }).eq('id', pid);
        get().recalculateSchedule();
    },

    addScheduleItem: async (item) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newItem: ProductionScheduleItem = {
            ...item,
            id: crypto.randomUUID(),
            sequenceOrder: pData.schedule.length,
        };

        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, schedule: [...pData.schedule, newItem] }
            }
        }));

        await (get() as any).saveProcessItems(pid, get().processes[pid].schedule);
        get().recalculateSchedule();
    },

    insertScheduleItem: async (index, item) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newSchedule = [...pData.schedule];
        newSchedule.splice(index, 0, item);
        const sequenced = newSchedule.map((it, idx) => ({ ...it, sequenceOrder: idx }));

        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, schedule: sequenced }
            }
        }));

        await (get() as any).saveProcessItems(pid, sequenced);
        get().recalculateSchedule();
    },

    addScheduleItems: async (items) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newSchedule = [...pData.schedule, ...items].map((it, idx) => ({ ...it, sequenceOrder: idx }));

        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, schedule: newSchedule }
            }
        }));

        await (get() as any).saveProcessItems(pid, newSchedule);
        get().recalculateSchedule();
    },

    updateScheduleItem: async (id, updates) => {
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newSchedule = pData.schedule.map(s => s.id === id ? { ...s, ...updates } : s);

        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, schedule: newSchedule }
            }
        }));

        // Selective update in DB for performance
        await supabase.from('scheduler_production_items').update({
            sku_code: updates.skuCode,
            quantity: updates.quantity,
            stoppages: updates.stoppages,
            sequence_order: updates.sequenceOrder
        }).eq('id', id);

        get().recalculateSchedule();
    },

    deleteScheduleItem: async (id) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newSchedule = pData.schedule.filter(s => s.id !== id).map((it, idx) => ({ ...it, sequenceOrder: idx }));

        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, schedule: newSchedule }
            }
        }));

        await supabase.from('scheduler_production_items').delete().eq('id', id);
        // Resync orders
        await (get() as any).saveProcessItems(pid, newSchedule);
        get().recalculateSchedule();
    },

    clearSchedule: async () => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], schedule: [] }
            }
        }));
        await supabase.from('scheduler_production_items').delete().eq('process_id', pid);
    },

    reorderSchedule: async (newOrder) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        const sequenced = newOrder.map((item, idx) => ({ ...item, sequenceOrder: idx }));
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], schedule: sequenced }
            }
        }));
        await (get() as any).saveProcessItems(pid, sequenced);
        get().recalculateSchedule();
    },

    addStoppageConfig: async (config) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: {
                    ...state.processes[pid],
                    stoppageConfigs: [...state.processes[pid].stoppageConfigs, config]
                }
            }
        }));
        await supabase.from('scheduler_stoppage_configs').insert({
            id: config.id,
            process_id: pid,
            col_id: config.colId,
            label: config.label,
            default_duration: config.defaultDuration
        });
    },

    removeStoppageConfig: async (id) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: {
                    ...state.processes[pid],
                    stoppageConfigs: state.processes[pid].stoppageConfigs.filter(c => c.id !== id)
                }
            }
        }));
        await supabase.from('scheduler_stoppage_configs').delete().eq('id', id);
    },

    recalculateSchedule: () => {
        const state = get();
        const pid = state.activeProcessId;
        const pData = state.processes[pid];

        const { schedule, programStartDate, holidays, manualStops, workSchedule } = pData;
        const articles = useArticleStore.getState().getArticles(pid);
        const rules = useChangeoverStore.getState().getRules(pid);

        const newSchedule = recalculate(schedule, articles, rules, programStartDate, holidays, manualStops, workSchedule);

        set((s) => ({
            processes: {
                ...s.processes,
                [pid]: { ...s.processes[pid], schedule: newSchedule }
            }
        }));
    },

    undo: async () => {
        const state = get();
        const pid = state.activeProcessId;
        const pData = state.processes[pid];
        if (pData.scheduleHistory.length === 0) return;

        const [lastState, ...rest] = pData.scheduleHistory;
        set((s) => ({
            processes: {
                ...s.processes,
                [pid]: { ...s.processes[pid], schedule: lastState, scheduleHistory: rest }
            }
        }));
        await (get() as any).saveProcessItems(pid, lastState);
        get().recalculateSchedule();
    },

    canUndo: () => {
        const state = get();
        const pid = state.activeProcessId;
        return state.processes[pid].scheduleHistory.length > 0;
    },

    setColumnLabel: async (field, label) => {
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newLabels = { ...pData.columnLabels, [field]: label };
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, columnLabels: newLabels }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ column_labels: newLabels }).eq('id', pid);
    },

    setSchedule: async (schedule) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], schedule, scheduleHistory: [] }
            }
        }));
        await (get() as any).saveProcessItems(pid, schedule);
        get().recalculateSchedule();
    },

    setStoppageConfigs: async (configs) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], stoppageConfigs: configs }
            }
        }));
        // For bulk update configs: delete and insert
        await supabase.from('scheduler_stoppage_configs').delete().eq('process_id', pid);
        await supabase.from('scheduler_stoppage_configs').insert(configs.map(c => ({
            id: c.id,
            process_id: pid,
            col_id: c.colId,
            label: c.label,
            default_duration: c.defaultDuration
        })));
    },

    importColumnLabels: async (labels) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], columnLabels: labels }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ column_labels: labels }).eq('id', pid);
    },

    addHoliday: async (date) => {
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        if (pData.holidays.includes(date)) return;
        const newHolidays = [...pData.holidays, date].sort();
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, holidays: newHolidays }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ holidays: newHolidays }).eq('id', pid);
    },

    removeHoliday: async (date) => {
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newHolidays = pData.holidays.filter(d => d !== date);
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, holidays: newHolidays }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ holidays: newHolidays }).eq('id', pid);
    },

    isHoliday: (date) => {
        const state = get();
        const pid = state.activeProcessId;
        const pData = state.processes[pid];
        const dateStr = format(date, 'yyyy-MM-dd');
        return pData.holidays.includes(dateStr);
    },

    addManualStop: async (stop) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: {
                    ...state.processes[pid],
                    manualStops: [...state.processes[pid].manualStops, stop]
                }
            }
        }));
        await supabase.from('scheduler_manual_stops').insert({
            id: stop.id || crypto.randomUUID(),
            process_id: pid,
            start_time: stop.start,
            duration_minutes: stop.durationMinutes,
            label: stop.label
        });
        get().recalculateSchedule();
    },

    updateManualStop: async (id, updates) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newStops = pData.manualStops.map(s => s.id === id ? { ...s, ...updates } : s);
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, manualStops: newStops }
            }
        }));
        await supabase.from('scheduler_manual_stops').update({
            start_time: updates.start,
            duration_minutes: updates.durationMinutes,
            label: updates.label
        }).eq('id', id);
        get().recalculateSchedule();
    },

    deleteManualStop: async (id) => {
        (get() as any)._saveSnapshot();
        const pid = get().activeProcessId;
        const pData = get().processes[pid];
        const newStops = pData.manualStops.filter(s => s.id !== id);
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...pData, manualStops: newStops }
            }
        }));
        await supabase.from('scheduler_manual_stops').delete().eq('id', id);
        get().recalculateSchedule();
    },

    setManualStops: async (stops) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], manualStops: stops }
            }
        }));
        await supabase.from('scheduler_manual_stops').delete().eq('process_id', pid);
        await supabase.from('scheduler_manual_stops').insert(stops.map(s => ({
            id: s.id || crypto.randomUUID(),
            process_id: pid,
            start_time: s.start,
            duration_minutes: s.durationMinutes,
            label: s.label
        })));
    },

    setWorkSchedule: async (schedule) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], workSchedule: schedule }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ work_schedule: schedule }).eq('id', pid);
        get().recalculateSchedule();
    },

    setVisualTargetDate: async (date) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: { ...state.processes[pid], visualTargetDate: date }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ visual_target_date: date }).eq('id', pid);
    },

    updateItemEndTime: async (itemId, targetEndDate) => {
        const state = get();
        const pid = state.activeProcessId;
        const pData = state.processes[pid];
        const { schedule, programStartDate, holidays, manualStops, workSchedule } = pData;
        const articles = useArticleStore.getState().getArticles(pid);
        const rules = useChangeoverStore.getState().getRules(pid);

        const itemIndex = schedule.findIndex(s => s.id === itemId);
        if (itemIndex === -1) return;
        const item = schedule[itemIndex];

        if (!item.startTime) return;
        const startTime = new Date(item.startTime);

        if (targetEndDate <= startTime) {
            alert('La fecha fin debe ser posterior a la fecha de inicio.');
            return;
        }

        const pace = item.calculatedPace || 1;
        const targetDurationMinutes = (targetEndDate.getTime() - startTime.getTime()) / 60000;

        let currentDuration = item.productionTimeMinutes || 0;
        if (item.endTime && item.startTime) {
            currentDuration = (new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 60000;
        }

        let estimatedQuantity = 0;
        if (item.quantity > 0 && currentDuration > 0) {
            estimatedQuantity = item.quantity * (targetDurationMinutes / currentDuration);
        } else {
            estimatedQuantity = (targetDurationMinutes / 60) * pace;
        }

        let bestQuantity = estimatedQuantity;

        const testQuantity = (q: number) => {
            const tempSchedule = [...schedule];
            tempSchedule[itemIndex] = { ...item, quantity: q };
            const simulated = recalculate(tempSchedule, articles, rules, programStartDate, holidays, manualStops, workSchedule);
            const simulatedItem = simulated[itemIndex];
            if (!simulatedItem.computedEnd) return { error: Infinity, diff: 0, end: new Date() };
            const diffMinutes = (simulatedItem.computedEnd.getTime() - targetEndDate.getTime()) / 60000;
            return { error: Math.abs(diffMinutes), diff: diffMinutes, end: simulatedItem.computedEnd };
        };

        for (let i = 0; i < 3; i++) {
            const result = testQuantity(bestQuantity);
            if (result.error < 2) break;
            const adjustment = result.diff * (pace / 60);
            bestQuantity -= adjustment;
            if (bestQuantity < 0) bestQuantity = 0;
        }

        (get() as any)._saveSnapshot();
        const newSchedule = pData.schedule.map((s, idx) => (idx === itemIndex ? { ...s, quantity: Math.round(bestQuantity * 100) / 100 } : s));
        set((s) => ({
            processes: {
                ...s.processes,
                [pid]: {
                    ...s.processes[pid],
                    schedule: newSchedule
                }
            }
        }));
        await supabase.from('scheduler_production_items').update({
            quantity: Math.round(bestQuantity * 100) / 100
        }).eq('id', itemId);
        get().recalculateSchedule();
    },

    saveSequencerConfig: async (config) => {
        const pid = get().activeProcessId;
        set((state) => ({
            processes: {
                ...state.processes,
                [pid]: {
                    ...state.processes[pid],
                    sequencerConfig: config
                }
            }
        }));
        await supabase.from('scheduler_process_configs').update({ sequencer_config: config }).eq('id', pid);
    },
}));
