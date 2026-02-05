
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChangeoverRule } from '../types/changeover';

interface ChangeoverStore {
    rules: ChangeoverRule[];
    setRules: (rules: ChangeoverRule[]) => void;
    addRule: (rule: ChangeoverRule) => void;
    updateRule: (index: number, rule: ChangeoverRule) => void;
    deleteRules: (indices: number[]) => void;
}

export const useChangeoverStore = create<ChangeoverStore>()(
    persist(
        (set) => ({
            rules: [],
            setRules: (rules) => set({ rules }),
            addRule: (rule) => set((state) => ({ rules: [...state.rules, rule] })),
            updateRule: (index, rule) => set((state) => {
                const newRules = [...state.rules];
                newRules[index] = rule;
                return { rules: newRules };
            }),
            deleteRules: (indices) => set((state) => {
                const newRules = state.rules.filter((_, i) => !indices.includes(i));
                return { rules: newRules };
            }),
        }),
        {
            name: 'changeover-storage',
        }
    )
);
