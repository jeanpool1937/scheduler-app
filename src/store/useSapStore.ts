import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface SapReportItem {
    sku_id: string;
    descripcion: string;
    stock_hoy: number;
    stock_fin_mes: number; // Projected month-end stock
    po_mes_actual: number;
    projected_venta_consumo: number; // Monthly forecast
    // Computed in store for convenience
    venta_diaria: number;
}

interface SapStore {
    sapData: Record<string, SapReportItem>;
    loading: boolean;
    fetchSapData: () => Promise<void>;
    getSapItem: (sku: string) => SapReportItem | undefined;
}

export const useSapStore = create<SapStore>((set, get) => ({
    sapData: {},
    loading: false,

    fetchSapData: async () => {
        set({ loading: true });
        const { data, error } = await supabase
            .from('sap_reporte_maestro')
            .select('sku_id, descripcion, stock_hoy, stock_fin_mes, po_mes_actual, projected_venta_consumo');

        if (error) {
            console.error('Error fetching SAP data:', error);
            set({ loading: false });
            return;
        }

        const sapMap: Record<string, SapReportItem> = {};
        data?.forEach((row: any) => {
            sapMap[row.sku_id] = {
                sku_id: row.sku_id,
                descripcion: row.descripcion,
                stock_hoy: Number(row.stock_hoy || 0),
                stock_fin_mes: Number(row.stock_fin_mes || 0),
                po_mes_actual: Number(row.po_mes_actual || 0),
                projected_venta_consumo: Number(row.projected_venta_consumo || 0),
                venta_diaria: Number(row.projected_venta_consumo || 0) / 30
            };
        });

        set({ sapData: sapMap, loading: false });
    },

    getSapItem: (sku: string) => {
        const state = get();
        return state.sapData[sku];
    }
}));
