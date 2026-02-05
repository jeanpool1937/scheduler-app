
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, ProductionScheduleItem, StoppageConfig } from '../types';
import type { Article } from '../types/article';
import { useArticleStore } from './useArticleStore';
import { useChangeoverStore } from './useChangeoverStore';
import type { ChangeoverRule } from '../types/changeover';
import { addMinutes } from 'date-fns';


// Helper: Extract length (in meters) from description like "BACO A615-G60 1/2" X 9M"
const extractLengthFromDescription = (desc: string | undefined): string | null => {
    if (!desc) return null;
    // Match patterns like "X 9M", "X 12M", "x 6M" at the end or within
    const match = desc.match(/X\s*(\d+(?:\.\d+)?)\s?M/i);
    return match ? match[1] : null;
};


const recalculate = (
    items: ProductionScheduleItem[],
    articles: Article[],
    rules: ChangeoverRule[],
    startDate: Date
): ProductionScheduleItem[] => {
    let currentTime = new Date(startDate);
    const sorted = [...items].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    return sorted.map((item, index) => {
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

        // 1.2 Calculate Quality Change (Cambio Calidad)
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

        // 1.3 Calculate Stop Change (Cambio de Tope) - Length change only
        // Applies when: no changeover, no quality change, but length differs
        let stopChangeMinutes = 0;
        if (index > 0 && changeoverMinutes === 0 && qualityChangeMinutes === 0) {
            const prevItem = sorted[index - 1];
            const prevArticle = articles.find(a => a.codigoProgramacion === prevItem.skuCode);

            const currentLength = extractLengthFromDescription(article?.descripcion);
            const prevLength = extractLengthFromDescription(prevArticle?.descripcion);

            if (currentLength && prevLength && currentLength !== prevLength) {
                stopChangeMinutes = 10; // 10 minutes for stop change
            }
        }

        // 1.5 Calculate Adjustment (Acierto y Calibracion)
        let adjustmentMinutes = 0;
        if (changeoverMinutes > 0) {
            adjustmentMinutes = (article?.aciertoCalibracion || 0) * 60;
        }

        // 2. Calculate Production
        let prodMinutes = 0;
        if (pace > 0 && item.quantity > 0) {
            prodMinutes = (item.quantity / pace) * 60;
        }

        // 3. Stoppages
        const stoppageMinutes = Object.values(item['stoppages'] || {}).reduce((acc, val) => acc + (val || 0), 0);

        // 4. Determine Times
        const start = new Date(currentTime);
        const totalDuration = changeoverMinutes + qualityChangeMinutes + stopChangeMinutes + adjustmentMinutes + prodMinutes + stoppageMinutes;
        const end = addMinutes(start, totalDuration);

        currentTime = end;

        return {
            ...item,
            calculatedPace: pace,
            productionTimeMinutes: prodMinutes,
            changeoverMinutes,
            qualityChangeMinutes,
            stopChangeMinutes,
            adjustmentMinutes,
            startTime: start,
            endTime: end,
        };
    });
};

const initialStoppages: StoppageConfig[] = [
    { id: 's1', colId: 'col_change', label: 'Cambio Medida', defaultDuration: 0 },
    { id: 's2', colId: 'col_maint', label: 'Mantenimiento', defaultDuration: 0 },
];

interface CalendarState {
    programStartDate: Date;
    setProgramStartDate: (date: Date) => void;
}

export const useStore = create<AppState & CalendarState>()(
    persist(
        (set, get) => ({
            programStartDate: new Date(),
            schedule: [],
            stoppageConfigs: initialStoppages,
            // Removed internal masterData, handled by useArticleStore now

            setProgramStartDate: (date) => {
                set({ programStartDate: date });
                get().recalculateSchedule();
            },

            // Removed addSku, updateSku, deleteSku (handled in useArticleStore)
            // But we need to keep interface compatible if Types demand it, 
            // likely we need to update types/index.ts too.
            // For now, removing them from implementation.

            addScheduleItem: (item) => {
                set((state) => ({
                    schedule: [...state.schedule, item]
                }));
                get().recalculateSchedule();
            },

            addScheduleItems: (items) => {
                set((state) => ({
                    schedule: [...state.schedule, ...items]
                }));
                get().recalculateSchedule();
            },

            updateScheduleItem: (id, updates) => {
                set((state) => ({
                    schedule: state.schedule.map((s) => (s.id === id ? { ...s, ...updates } : s))
                }));
                get().recalculateSchedule();
            },

            deleteScheduleItem: (id) => {
                set((state) => ({
                    schedule: state.schedule.filter(s => s.id !== id)
                }));
                get().recalculateSchedule();
            },

            clearSchedule: () => {
                set({ schedule: [] });
            },

            reorderSchedule: (newOrder) => {
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
                const { schedule, programStartDate } = get();
                // Access the external store synchronously
                const articles = useArticleStore.getState().articles;
                const rules = useChangeoverStore.getState().rules;
                const newSchedule = recalculate(schedule, articles, rules, programStartDate);
                set({ schedule: newSchedule });
            },
        }),
        {
            name: 'scheduler-storage', // Key in localStorage
            partialize: (state) => ({
                schedule: state.schedule,
                stoppageConfigs: state.stoppageConfigs,
                programStartDate: state.programStartDate
            }),
        }
    )
);
