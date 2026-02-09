
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, ProductionScheduleItem, StoppageConfig } from '../types';
import type { Article } from '../types/article';
import { useArticleStore } from './useArticleStore';
import { useChangeoverStore } from './useChangeoverStore';
import type { ChangeoverRule } from '../types/changeover';
import { addMinutes } from 'date-fns';
import { format } from 'date-fns';


// Helper: Extract length (in meters) from description like "BACO A615-G60 1/2" X 9M"
const extractLengthFromDescription = (desc: string | undefined): string | null => {
    if (!desc) return null;
    // Match patterns like "X 9M", "X 12M", "x 6M" at the end or within
    const match = desc.match(/X\s*(\d+(?:\.\d+)?)\s?M/i);
    return match ? match[1] : null;
};


import { simulateSchedule } from '../utils/schedulerLogic';

const recalculate = (
    items: ProductionScheduleItem[],
    articles: Article[],
    rules: ChangeoverRule[],
    startDate: Date,
    holidays: string[] = []
): ProductionScheduleItem[] => {
    let sorted = [...items].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    // Phase 1: Calculate Static Attributes (Changeovers, Rates, Def. Durations)
    const preProcessedItems = sorted.map((item, index) => {
        const article = articles.find(a => a.codigoProgramacion === item.skuCode);
        const pace = article?.ritmoTH || 0;

        // 1. Calculate Changeover
        let changeoverMinutes = 0;
        if (index > 0) {
            const prevItem = sorted[index - 1];
            const prevArticle = articles.find(a => a.codigoProgramacion === prevItem.skuCode);

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
    const simulatedItems = simulateSchedule(preProcessedItems, startDate, holidays);

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

interface CalendarState {
    programStartDate: Date;
    setProgramStartDate: (date: Date) => void;
}

const MAX_HISTORY = 5;

export const useStore = create<AppState & CalendarState>()(
    persist(
        (set, get) => ({
            programStartDate: new Date(),
            schedule: [],
            stoppageConfigs: initialStoppages,
            columnLabels: {},
            scheduleHistory: [],
            holidays: [],


            setProgramStartDate: (date) => {
                set({ programStartDate: date });
                get().recalculateSchedule();
            },

            // Helper to save snapshot before changes
            _saveSnapshot: () => {
                const { schedule, scheduleHistory } = get();
                const newHistory = [JSON.parse(JSON.stringify(schedule)), ...scheduleHistory].slice(0, MAX_HISTORY);
                set({ scheduleHistory: newHistory });
            },

            addScheduleItem: (item) => {
                (get() as any)._saveSnapshot();
                set((state) => ({
                    schedule: [...state.schedule, item]
                }));
                get().recalculateSchedule();
            },

            insertScheduleItem: (index, item) => {
                (get() as any)._saveSnapshot();
                const newSchedule = [...get().schedule];
                newSchedule.splice(index, 0, item);
                // Re-sequence to ensure sort order in recalculate works
                const sequenced = newSchedule.map((it, idx) => ({ ...it, sequenceOrder: idx }));
                set({ schedule: sequenced });
                get().recalculateSchedule();
            },

            addScheduleItems: (items) => {
                (get() as any)._saveSnapshot();
                set((state) => ({
                    schedule: [...state.schedule, ...items]
                }));
                get().recalculateSchedule();
            },

            updateScheduleItem: (id, updates) => {
                (get() as any)._saveSnapshot();
                set((state) => ({
                    schedule: state.schedule.map((s) => (s.id === id ? { ...s, ...updates } : s))
                }));
                get().recalculateSchedule();
            },

            deleteScheduleItem: (id) => {
                (get() as any)._saveSnapshot();
                set((state) => ({
                    schedule: state.schedule.filter(s => s.id !== id)
                }));
                get().recalculateSchedule();
            },

            clearSchedule: () => {
                (get() as any)._saveSnapshot();
                set({ schedule: [] });
            },

            reorderSchedule: (newOrder) => {
                (get() as any)._saveSnapshot();
                const sequenced = newOrder.map((item, idx) => ({ ...item, sequenceOrder: idx }));
                set({ schedule: sequenced });
                get().recalculateSchedule();
            },

            addStoppageConfig: (config) => set((state) => ({
                stoppageConfigs: [...state.stoppageConfigs, config]
            })),

            removeStoppageConfig: (id) => set((state) => ({
                stoppageConfigs: state.stoppageConfigs.filter(c => c.id !== id)
            })),

            recalculateSchedule: () => {
                const { schedule, programStartDate, holidays } = get();
                const articles = useArticleStore.getState().articles;
                const rules = useChangeoverStore.getState().rules;
                const newSchedule = recalculate(schedule, articles, rules, programStartDate, holidays);
                set({ schedule: newSchedule });
            },

            // Undo: restore last snapshot
            undo: () => {
                const { scheduleHistory } = get();
                if (scheduleHistory.length === 0) return;

                const [lastState, ...rest] = scheduleHistory;
                set({ schedule: lastState, scheduleHistory: rest });
                get().recalculateSchedule();
            },

            canUndo: () => {
                return get().scheduleHistory.length > 0;
            },

            // Column Labels
            setColumnLabel: (field: string, label: string) => {
                set((state) => ({
                    columnLabels: { ...state.columnLabels, [field]: label }
                }));
            },

            // Import/Export
            setSchedule: (schedule) => {
                set({ schedule, scheduleHistory: [] }); // Clear history when importing
                get().recalculateSchedule();
            },

            setStoppageConfigs: (configs) => {
                set({ stoppageConfigs: configs });
            },

            importColumnLabels: (labels) => {
                set({ columnLabels: labels });
            },

            // Holidays Management
            addHoliday: (date: string) => {
                set((state) => {
                    if (state.holidays.includes(date)) return state;
                    return { holidays: [...state.holidays, date].sort() };
                });
            },

            removeHoliday: (date: string) => {
                set((state) => ({
                    holidays: state.holidays.filter(d => d !== date)
                }));
            },

            isHoliday: (date: Date): boolean => {
                const dateStr = format(date, 'yyyy-MM-dd');
                return get().holidays.includes(dateStr);
            },


        }),
        {
            name: 'scheduler-storage',
            partialize: (state) => ({
                schedule: state.schedule,
                stoppageConfigs: state.stoppageConfigs,
                programStartDate: state.programStartDate,
                columnLabels: state.columnLabels,
                holidays: state.holidays,

                // Note: scheduleHistory is NOT persisted (transient)
            }),
        }
    )
);
