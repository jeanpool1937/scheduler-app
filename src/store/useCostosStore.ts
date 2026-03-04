/**
 * Costos Store (Zustand)
 * Manages fetching the maestro de costos from Supabase.
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface MaestroCostosItem {
    id: string;
    codigo_sap: string;
    codigo_lam: string;
    descripcion: string;
    id_familia_tcm: string;
    ritmo_th: number;
    costo_total_lam_sin_cf: number;
    cambio_medida_horas: number;
}

interface CostosState {
    costos: MaestroCostosItem[];
    isLoading: boolean;
    error: string | null;
    fetchCostos: () => Promise<void>;
    updateCosto: (id: string, updates: Partial<MaestroCostosItem>) => Promise<void>;
    deleteCosto: (id: string) => Promise<void>;
    deleteMultipleCostos: (ids: string[]) => Promise<void>;
    upsertCostos: (items: any[]) => Promise<void>;
}

export const useCostosStore = create<CostosState>((set) => ({
    costos: [],
    isLoading: false,
    error: null,

    fetchCostos: async () => {
        set({ isLoading: true, error: null });
        try {
            const { data, error } = await supabase
                .from('scheduler_maestro_costos')
                .select('*')
                .order('descripcion');

            if (error) throw error;
            set({ costos: data || [] });
        } catch (err: any) {
            console.error('Error fetching costos master:', err);
            set({ error: err.message });
        } finally {
            set({ isLoading: false });
        }
    },

    updateCosto: async (id, updates) => {
        try {
            const { error } = await supabase
                .from('scheduler_maestro_costos')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Actualizamos localmente el store para que la UI se refresque instantaneamente
            set((state) => ({
                costos: state.costos.map((item) => (item.id === id ? { ...item, ...updates } : item))
            }));
        } catch (err: any) {
            console.error('Error updating costo:', err);
            alert('Error al actualizar el costo en la base de datos.');
        }
    },

    deleteCosto: async (id) => {
        try {
            const { error } = await supabase
                .from('scheduler_maestro_costos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            set((state) => ({
                costos: state.costos.filter((item) => item.id !== id)
            }));
        } catch (err: any) {
            console.error('Error deleting costo:', err);
            alert('Error al eliminar el costo.');
        }
    },

    deleteMultipleCostos: async (ids) => {
        try {
            const { error } = await supabase
                .from('scheduler_maestro_costos')
                .delete()
                .in('id', ids);

            if (error) throw error;

            set((state) => ({
                costos: state.costos.filter((item) => !ids.includes(item.id))
            }));
        } catch (err: any) {
            console.error('Error deleting multiple costos:', err);
            alert('Error al eliminar los registros seleccionados.');
        }
    },

    upsertCostos: async (items) => {
        set({ isLoading: true, error: null });
        try {
            const { error } = await supabase
                .from('scheduler_maestro_costos')
                .upsert(items, { onConflict: 'id' });

            if (error) throw error;

            // Refetch to ensure local state is perfectly synced
            const { data, error: fetchError } = await supabase
                .from('scheduler_maestro_costos')
                .select('*')
                .order('descripcion');

            if (fetchError) throw fetchError;
            set({ costos: data || [] });
        } catch (err: any) {
            console.error('Error upserting costos:', err);
            set({ error: err.message });
            throw err;
        } finally {
            set({ isLoading: false });
        }
    }
}));
