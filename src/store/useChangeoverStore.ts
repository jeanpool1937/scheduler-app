import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChangeoverRule } from '../types/changeover';
import type { ProcessId } from '../types';

interface ChangeoverStore {
    // Stores: Record<ProcessId, ChangeoverRule[]>
    rulesByProcess: Record<ProcessId, ChangeoverRule[]>;

    // Actions require processId
    setRules: (processId: ProcessId, rules: ChangeoverRule[]) => void;
    addRule: (processId: ProcessId, rule: ChangeoverRule) => void;
    updateRule: (processId: ProcessId, index: number, rule: ChangeoverRule) => void;
    deleteRules: (processId: ProcessId, indices: number[]) => void;

    // Helper
    getRules: (processId: ProcessId) => ChangeoverRule[];
}

const initialRulesState: Record<ProcessId, ChangeoverRule[]> = {
    'laminador1': [],
    'laminador2': [],
    'laminador3': [],
};

export const useChangeoverStore = create<ChangeoverStore>()(
    persist(
        (set, get) => ({
            rulesByProcess: initialRulesState,

            getRules: (processId) => get().rulesByProcess[processId] || [],

            setRules: (processId, rules) => set((state) => ({
                rulesByProcess: {
                    ...state.rulesByProcess,
                    [processId]: rules
                }
            })),

            addRule: (processId, rule) => set((state) => ({
                rulesByProcess: {
                    ...state.rulesByProcess,
                    [processId]: [...(state.rulesByProcess[processId] || []), rule]
                }
            })),

            updateRule: (processId, index, rule) => set((state) => {
                const currentList = state.rulesByProcess[processId] || [];
                const newList = [...currentList];
                newList[index] = rule;
                return {
                    rulesByProcess: {
                        ...state.rulesByProcess,
                        [processId]: newList
                    }
                };
            }),

            deleteRules: (processId, indices) => set((state) => {
                const currentList = state.rulesByProcess[processId] || [];
                const newList = currentList.filter((_, i) => !indices.includes(i));
                return {
                    rulesByProcess: {
                        ...state.rulesByProcess,
                        [processId]: newList
                    }
                };
            }),
        }),
        {
            name: 'changeover-storage-multi',
            partialize: (state) => ({ rulesByProcess: state.rulesByProcess }),
        }
    )
);
