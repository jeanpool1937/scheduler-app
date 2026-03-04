/**
 * Planner Store (Zustand)
 * Manages state for the capacity & cost planner module.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    MachineCost,
    PeriodCapacity,
    PlannerOptimizationResult,
    PlannerExcelData,
} from '../types/planner';
import { supabase } from '../lib/supabaseClient';

interface PlannerState {
    // Configuration
    machineCosts: MachineCost[];
    capacitySchedule: PeriodCapacity[];

    // Data
    excelData: PlannerExcelData | null;
    pasteText: string;
    fileName: string;

    // Results
    resultA: PlannerOptimizationResult | null;
    resultB: PlannerOptimizationResult | null;
    resultC: PlannerOptimizationResult | null;

    // UI State
    activeView: 'config' | 'data' | 'results';
    selectedMonth: string | null; // 'YYYY-MM'
    isOptimizing: boolean;

    // Actions
    setMachineCosts: (costs: MachineCost[]) => void;
    setCapacitySchedule: (schedule: PeriodCapacity[]) => void;
    setExcelData: (data: PlannerExcelData | null, fileName: string) => void;
    setResults: (
        a: PlannerOptimizationResult | null,
        b: PlannerOptimizationResult | null,
        c: PlannerOptimizationResult | null
    ) => void;
    setActiveView: (view: 'config' | 'data' | 'results') => void;
    setSelectedMonth: (month: string | null) => void;
    setIsOptimizing: (val: boolean) => void;
    clearResults: () => void;
    setPasteText: (text: string) => void;
    fetchSavedState: () => Promise<void>;
    saveState: () => Promise<void>;
}

const DEFAULT_COSTS: MachineCost[] = [
    { id: 'LAM1', peakPowerCost: 144000, overtimeRate: 300.0 },
    { id: 'LAM2', peakPowerCost: 124600, overtimeRate: 450.0 },
    { id: 'LAM3', peakPowerCost: 42525, overtimeRate: 300.0 },
];

const DEFAULT_CAPACITY_SCHEDULE: PeriodCapacity[] = [
    { period: '2026-01', peakHours: 84, machines: { LAM1: { total: 409.1, base: 325.1 }, LAM2: { total: 554.9, base: 470.9 }, LAM3: { total: 509.4, base: 425.4 } } },
    { period: '2026-02', peakHours: 76, machines: { LAM1: { total: 399.5, base: 323.5 }, LAM2: { total: 516.2, base: 440.2 }, LAM3: { total: 460.5, base: 384.5 } } },
    { period: '2026-03', peakHours: 84, machines: { LAM1: { total: 419.0, base: 335.0 }, LAM2: { total: 558.7, base: 474.7 }, LAM3: { total: 511.3, base: 427.3 } } },
    { period: '2026-04', peakHours: 80, machines: { LAM1: { total: 401.0, base: 321.0 }, LAM2: { total: 537.1, base: 457.1 }, LAM3: { total: 495.8, base: 415.8 } } },
    { period: '2026-05', peakHours: 84, machines: { LAM1: { total: 559.0, base: 475.0 }, LAM2: { total: 549.8, base: 465.8 }, LAM3: { total: 526.8, base: 442.8 } } },
    { period: '2026-06', peakHours: 80, machines: { LAM1: { total: 521.2, base: 441.2 }, LAM2: { total: 533.3, base: 453.3 }, LAM3: { total: 489.7, base: 409.7 } } },
    { period: '2026-07', peakHours: 88, machines: { LAM1: { total: 601.6, base: 513.6 }, LAM2: { total: 575.3, base: 487.3 }, LAM3: { total: 524.8, base: 436.8 } } },
    { period: '2026-08', peakHours: 80, machines: { LAM1: { total: 624.2, base: 544.2 }, LAM2: { total: 579.0, base: 499.0 }, LAM3: { total: 533.3, base: 453.3 } } },
    { period: '2026-09', peakHours: 88, machines: { LAM1: { total: 587.4, base: 499.4 }, LAM2: { total: 524.2, base: 436.2 }, LAM3: { total: 491.5, base: 403.5 } } },
    { period: '2026-10', peakHours: 84, machines: { LAM1: { total: 596.6, base: 512.6 }, LAM2: { total: 563.2, base: 479.2 }, LAM3: { total: 519.2, base: 435.2 } } },
    { period: '2026-11', peakHours: 80, machines: { LAM1: { total: 516.3, base: 436.3 }, LAM2: { total: 540.0, base: 460.0 }, LAM3: { total: 498.6, base: 418.6 } } },
    { period: '2026-12', peakHours: 80, machines: { LAM1: { total: 620.5, base: 540.5 }, LAM2: { total: 588.1, base: 508.1 }, LAM3: { total: 532.3, base: 452.3 } } },
];

export const usePlannerStore = create<PlannerState>()(
    persist(
        (set, get) => ({
            machineCosts: DEFAULT_COSTS,
            capacitySchedule: DEFAULT_CAPACITY_SCHEDULE,
            fileName: '',
            pasteText: '',
            excelData: null,
            resultA: null,
            resultB: null,
            resultC: null,
            activeView: 'config',
            selectedMonth: null,
            isOptimizing: false,

            setMachineCosts: (costs) => set({ machineCosts: costs }),
            setCapacitySchedule: (schedule) => set({ capacitySchedule: schedule }),
            setExcelData: (data, fileName) => set({ excelData: data, fileName }),
            setResults: (a, b, c) => set({ resultA: a, resultB: b, resultC: c, activeView: 'results' }),
            setActiveView: (view) => set({ activeView: view }),
            setSelectedMonth: (month) => set({ selectedMonth: month }),
            setIsOptimizing: (val) => set({ isOptimizing: val }),
            clearResults: () => set({ resultA: null, resultB: null, resultC: null }),
            setPasteText: (text) => set({ pasteText: text }),

            fetchSavedState: async () => {
                try {
                    const { data, error } = await supabase
                        .from('scheduler_planner_state')
                        .select('*')
                        .eq('id', 1)
                        .single();

                    if (error && error.code !== 'PGRST116') {
                        console.error('Error fetching planner state:', error);
                        return;
                    }

                    if (data) {
                        set({
                            pasteText: data.raw_tsv_data || '',
                            excelData: data.parsed_data as PlannerExcelData | null,
                            resultA: data.results_a as PlannerOptimizationResult | null,
                            resultB: data.results_b as PlannerOptimizationResult | null,
                            resultC: data.results_c as PlannerOptimizationResult | null,
                            // If there are results, let the user see them
                            activeView: data.results_a ? 'results' : 'data'
                        });
                    }
                } catch (err) {
                    console.error('Exception fetching planner state', err);
                }
            },

            saveState: async () => {
                try {
                    const { pasteText, excelData, resultA, resultB, resultC } = get();
                    const { error } = await supabase
                        .from('scheduler_planner_state')
                        .upsert(
                            {
                                id: 1,
                                raw_tsv_data: pasteText,
                                parsed_data: excelData,
                                results_a: resultA,
                                results_b: resultB,
                                results_c: resultC,
                                updated_at: new Date().toISOString()
                            },
                            { onConflict: 'id' }
                        );

                    if (error) {
                        console.error('Error saving planner state to Supabase:', error);
                    }
                } catch (err) {
                    console.error('Exception saving planner state to Supabase', err);
                }
            },
        }),
        {
            name: 'planner-store',
            partialize: (state) => ({
                machineCosts: state.machineCosts,
                capacitySchedule: state.capacitySchedule,
                activeView: state.activeView,
                excelData: state.excelData,
                pasteText: state.pasteText,
                resultA: state.resultA,
                resultB: state.resultB,
                resultC: state.resultC,
            }),
        }
    )
);
