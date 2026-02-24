import { create } from 'zustand';
import type { ChangeoverRule } from '../types/changeover';
import type { ProcessId } from '../types';
import { supabase } from '../lib/supabaseClient';

interface ChangeoverStore {
    rulesByProcess: Record<ProcessId, ChangeoverRule[]>;
    loading: boolean;

    // Actions
    fetchRules: (processId: ProcessId) => Promise<void>;
    fetchAllRules: () => Promise<void>;
    setRules: (processId: ProcessId, rules: ChangeoverRule[]) => Promise<void>;
    addRule: (processId: ProcessId, rule: ChangeoverRule) => Promise<void>;
    updateRule: (processId: ProcessId, id: string, rule: Partial<ChangeoverRule>) => Promise<void>;
    deleteRules: (processId: ProcessId, ids: string[]) => Promise<void>;

    // Helper
    getRules: (processId: ProcessId) => ChangeoverRule[];
}

const initialRulesState: Record<ProcessId, ChangeoverRule[]> = {
    'laminador1': [],
    'laminador2': [],
    'laminador3': [],
};

const mapFromDb = (row: any): ChangeoverRule => ({
    fromId: row.from_id,
    toId: row.to_id,
    durationHours: Number(row.duration_hours),
    id: row.id
});

const mapToDb = (processId: ProcessId, rule: Partial<ChangeoverRule>) => ({
    process_id: processId,
    from_id: rule.fromId,
    to_id: rule.toId,
    duration_hours: rule.durationHours,
});

export const useChangeoverStore = create<ChangeoverStore>((set, get) => ({
    rulesByProcess: initialRulesState,
    loading: false,

    getRules: (processId) => get().rulesByProcess[processId] || [],

    fetchRules: async (processId) => {
        set({ loading: true });
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('scheduler_changeover_rules')
                .select('*')
                .eq('process_id', processId)
                .range(from, from + step - 1);

            if (error) {
                console.error('Error fetching rules:', error);
                set({ loading: false });
                return;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += step;
                if (data.length < step) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        const rules = allData.map(mapFromDb);
        set((state) => ({
            rulesByProcess: {
                ...state.rulesByProcess,
                [processId]: rules
            },
            loading: false
        }));
    },

    fetchAllRules: async () => {
        set({ loading: true });
        const { data, error } = await supabase
            .from('scheduler_changeover_rules')
            .select('*');

        if (error) {
            console.error('Error fetching all rules:', error);
            set({ loading: false });
            return;
        }

        const grouped: Record<ProcessId, ChangeoverRule[]> = {
            'laminador1': [],
            'laminador2': [],
            'laminador3': [],
        };

        (data || []).forEach(row => {
            const pId = row.process_id as ProcessId;
            if (grouped[pId]) {
                grouped[pId].push(mapFromDb(row));
            }
        });

        set({ rulesByProcess: grouped, loading: false });
    },

    setRules: async (processId, rules) => {
        // Bulk replace for a process
        set({ loading: true });

        // 1. Delete existing
        const { error: delError } = await supabase
            .from('scheduler_changeover_rules')
            .delete()
            .eq('process_id', processId);

        if (delError) {
            console.error('Error deleting old rules:', delError);
            set({ loading: false });
            return;
        }

        // 2. Insert new
        const toInsert = rules.map(r => mapToDb(processId, r));
        const { data, error } = await supabase
            .from('scheduler_changeover_rules')
            .insert(toInsert)
            .select();

        if (error) {
            console.error('Error inserting rules:', error);
            set({ loading: false });
            return;
        }

        set((state) => ({
            rulesByProcess: {
                ...state.rulesByProcess,
                [processId]: (data || []).map(mapFromDb)
            },
            loading: false
        }));
    },

    addRule: async (processId, rule) => {
        const { data, error } = await supabase
            .from('scheduler_changeover_rules')
            .insert(mapToDb(processId, rule))
            .select()
            .single();

        if (error) {
            console.error('Error adding rule:', error);
            return;
        }

        set((state) => ({
            rulesByProcess: {
                ...state.rulesByProcess,
                [processId]: [...(state.rulesByProcess[processId] || []), mapFromDb(data)]
            }
        }));
    },

    updateRule: async (processId, id, rule) => {
        const { data, error } = await supabase
            .from('scheduler_changeover_rules')
            .update(mapToDb(processId, rule))
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating rule:', error);
            return;
        }

        set((state) => ({
            rulesByProcess: {
                ...state.rulesByProcess,
                [processId]: (state.rulesByProcess[processId] || []).map(r =>
                    (r as any).id === id ? mapFromDb(data) : r
                )
            }
        }));
    },

    deleteRules: async (processId, ids) => {
        const { error } = await supabase
            .from('scheduler_changeover_rules')
            .delete()
            .in('id', ids);

        if (error) {
            console.error('Error deleting rules:', error);
            return;
        }

        set((state) => ({
            rulesByProcess: {
                ...state.rulesByProcess,
                [processId]: (state.rulesByProcess[processId] || []).filter(r => !ids.includes((r as any).id))
            }
        }));
    },
}));
