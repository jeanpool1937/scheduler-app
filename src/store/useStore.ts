import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, ProcessData, ProductionScheduleItem, StoppageConfig } from '../types';
import type { Article } from '../types/article';
import { useArticleStore } from './useArticleStore';
import { useChangeoverStore } from './useChangeoverStore';
import type { ChangeoverRule } from '../types/changeover';
import { format } from 'date-fns';
import { simulateSchedule } from '../utils/schedulerLogic';

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
    manualStops: { id: string; start: Date; durationMinutes: number; label: string }[] = []
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
    const simulatedItems = simulateSchedule(preProcessedItems, startDate, holidays, manualStops);

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

const createInitialProcessData = (): ProcessData => ({
    schedule: [],
    stoppageConfigs: initialStoppages,
    programStartDate: new Date(),
    columnLabels: {},
    scheduleHistory: [],
    holidays: [],
    manualStops: [],
    visualTargetDate: null
});

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            activeProcessId: 'laminador1',
            processes: {
                'laminador1': createInitialProcessData(),
                'laminador2': createInitialProcessData(),
                'laminador3': createInitialProcessData(),
            },
            activeTab: 'scheduler',

            // Global Actions
            setActiveProcess: (id) => set({ activeProcessId: id }),
            setActiveTab: (tab) => set({ activeTab: tab }),

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
            setProgramStartDate: (date) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], programStartDate: date }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            addScheduleItem: (item) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    const newItem: ProductionScheduleItem = {
                        ...item,
                        id: crypto.randomUUID(),
                        sequenceOrder: pData.schedule.length,
                    };
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, schedule: [...pData.schedule, newItem] }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            insertScheduleItem: (index, item) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    const newSchedule = [...pData.schedule];
                    newSchedule.splice(index, 0, item);
                    const sequenced = newSchedule.map((it, idx) => ({ ...it, sequenceOrder: idx }));
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, schedule: sequenced }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            addScheduleItems: (items) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, schedule: [...pData.schedule, ...items] }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            updateScheduleItem: (id, updates) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: {
                                ...pData,
                                schedule: pData.schedule.map(s => s.id === id ? { ...s, ...updates } : s)
                            }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            deleteScheduleItem: (id) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: {
                                ...pData,
                                schedule: pData.schedule.filter(s => s.id !== id)
                            }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            clearSchedule: () => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], schedule: [] }
                        }
                    };
                });
            },

            reorderSchedule: (newOrder) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const sequenced = newOrder.map((item, idx) => ({ ...item, sequenceOrder: idx }));
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], schedule: sequenced }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            addStoppageConfig: (config) => set((state) => {
                const pid = state.activeProcessId;
                const pData = state.processes[pid];
                return {
                    processes: {
                        ...state.processes,
                        [pid]: { ...pData, stoppageConfigs: [...pData.stoppageConfigs, config] }
                    }
                };
            }),

            removeStoppageConfig: (id) => set((state) => {
                const pid = state.activeProcessId;
                const pData = state.processes[pid];
                return {
                    processes: {
                        ...state.processes,
                        [pid]: { ...pData, stoppageConfigs: pData.stoppageConfigs.filter(c => c.id !== id) }
                    }
                };
            }),

            recalculateSchedule: () => {
                const state = get();
                const pid = state.activeProcessId;
                const pData = state.processes[pid];

                const { schedule, programStartDate, holidays, manualStops } = pData;
                const articles = useArticleStore.getState().getArticles(pid);
                const rules = useChangeoverStore.getState().getRules(pid);

                const newSchedule = recalculate(schedule, articles, rules, programStartDate, holidays, manualStops);

                set((s) => ({
                    processes: {
                        ...s.processes,
                        [pid]: { ...s.processes[pid], schedule: newSchedule }
                    }
                }));
            },

            undo: () => {
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
                get().recalculateSchedule();
            },

            canUndo: () => {
                const state = get();
                const pid = state.activeProcessId;
                return state.processes[pid].scheduleHistory.length > 0;
            },

            setColumnLabel: (field, label) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, columnLabels: { ...pData.columnLabels, [field]: label } }
                        }
                    };
                });
            },

            setSchedule: (schedule) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], schedule, scheduleHistory: [] }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            setStoppageConfigs: (configs) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], stoppageConfigs: configs }
                        }
                    };
                });
            },

            importColumnLabels: (labels) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], columnLabels: labels }
                        }
                    };
                });
            },

            addHoliday: (date) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    if (pData.holidays.includes(date)) return {};
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, holidays: [...pData.holidays, date].sort() }
                        }
                    };
                });
            },

            removeHoliday: (date) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, holidays: pData.holidays.filter(d => d !== date) }
                        }
                    };
                });
            },

            isHoliday: (date) => {
                const state = get();
                const pid = state.activeProcessId;
                const pData = state.processes[pid];
                const dateStr = format(date, 'yyyy-MM-dd');
                return pData.holidays.includes(dateStr);
            },

            addManualStop: (stop) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, manualStops: [...pData.manualStops, stop] }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            updateManualStop: (id, updates) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    const newStops = pData.manualStops.map(s => s.id === id ? { ...s, ...updates } : s);
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, manualStops: newStops }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            deleteManualStop: (id) => {
                (get() as any)._saveSnapshot();
                set((state) => {
                    const pid = state.activeProcessId;
                    const pData = state.processes[pid];
                    const newStops = pData.manualStops.filter(s => s.id !== id);
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...pData, manualStops: newStops }
                        }
                    };
                });
                get().recalculateSchedule();
            },

            setManualStops: (stops) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], manualStops: stops }
                        }
                    };
                });
            },

            setVisualTargetDate: (date) => {
                set((state) => {
                    const pid = state.activeProcessId;
                    return {
                        processes: {
                            ...state.processes,
                            [pid]: { ...state.processes[pid], visualTargetDate: date }
                        }
                    };
                });
            },

            updateItemEndTime: (itemId, targetEndDate) => {
                const state = get();
                const pid = state.activeProcessId;
                const pData = state.processes[pid];
                const { schedule, programStartDate, holidays, manualStops } = pData;
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
                    const simulated = recalculate(tempSchedule, articles, rules, programStartDate, holidays, manualStops);
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
                set((s) => ({
                    processes: {
                        ...s.processes,
                        [pid]: {
                            ...s.processes[pid],
                            schedule: s.processes[pid].schedule.map((s, idx) => (idx === itemIndex ? { ...s, quantity: Math.round(bestQuantity * 100) / 100 } : s))
                        }
                    }
                }));
                get().recalculateSchedule();
            },
        }),
        {
            name: 'scheduler-storage-multi',
            partialize: (state) => ({
                activeProcessId: state.activeProcessId,
                processes: state.processes,
                activeTab: state.activeTab
            }),
            merge: (persistedState: any, currentState) => {
                const merged = { ...currentState, ...persistedState };

                if (merged.processes) {
                    for (const pid in merged.processes) {
                        const pData = merged.processes[pid];
                        if (typeof pData.programStartDate === 'string') {
                            pData.programStartDate = new Date(pData.programStartDate);
                        }
                        if (pData.manualStops && Array.isArray(pData.manualStops)) {
                            pData.manualStops = pData.manualStops.map((s: any) => ({
                                ...s,
                                start: typeof s.start === 'string' ? new Date(s.start) : s.start
                            }));
                        }
                    }
                }
                return merged;
            },
        }
    )
);
