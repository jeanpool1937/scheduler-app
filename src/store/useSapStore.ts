import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface SapReportItem {
    sku_id: string;
    descripcion: string;
    stock_hoy: number;
    stock_fin_mes: number; // Projected month-end stock (from sap_reporte_maestro or fallback to stock_actual)
    po_mes_actual: number;
    projected_venta_consumo: number; // Monthly forecast
    // Computed in store for convenience
    venta_diaria: number;
}

interface SapStore {
    sapData: Record<string, SapReportItem>;
    loading: boolean;
    isFetched: boolean;
    lastFetchedAt: number | null;
    fetchSapData: (forceRefresh?: boolean) => Promise<void>;
    getSapItem: (sku: string) => SapReportItem | undefined;
}

const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

export const useSapStore = create<SapStore>((set, get) => ({
    sapData: {},
    loading: false,
    isFetched: false,
    lastFetchedAt: null,

    fetchSapData: async (forceRefresh = false) => {
        // Si ya hay datos en caché cargados hace menos de 8 horas, omitir la consulta
        const { isFetched, lastFetchedAt } = get();
        if (!forceRefresh && isFetched && lastFetchedAt && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
            return;
        }

        set({ loading: true });

        // --- Source 1: sap_plan_inventario_hibrido (stock_actual + adu_diario as fallback) ---
        // Solo columnas necesarias + filtro por país para reducir egress
        const { data: planData } = await supabase
            .from('sap_plan_inventario_hibrido')
            .select('sku_id, descripcion, stock_actual, adu_diario_l30d, adu_hibrido_final')
            .eq('pais', 'Peru');

        // --- Source 2: sap_reporte_maestro (authoritative stock_fin_mes + PO when available) ---
        // 'descripcion' ya viene de planData, no es necesario duplicarla aquí
        const { data: maestroData, error: maestroError } = await supabase
            .from('sap_reporte_maestro')
            .select('sku_id, stock_hoy, stock_fin_mes, po_mes_actual, projected_venta_consumo');

        if (maestroError) {
            console.error('Error fetching SAP reporte maestro:', maestroError);
        }

        // Build map from plan inventario (broader coverage)
        const sapMap: Record<string, SapReportItem> = {};

        planData?.forEach((row: any) => {
            const aduDiario = Number(row.adu_hibrido_final || row.adu_diario_l30d || 0);
            const stockActual = Number(row.stock_actual || 0);
            sapMap[row.sku_id] = {
                sku_id: row.sku_id,
                descripcion: row.descripcion || '',
                stock_hoy: stockActual,
                stock_fin_mes: stockActual,          // default: use current stock as fin-mes estimate
                po_mes_actual: 0,
                projected_venta_consumo: aduDiario * 30,
                venta_diaria: aduDiario,
            };
        });

        // Overwrite/enrich with authoritative sap_reporte_maestro data when available
        maestroData?.forEach((row: any) => {
            const ventaConsumo = Number(row.projected_venta_consumo || 0);
            const ventaDiaria = ventaConsumo / 30;
            sapMap[row.sku_id] = {
                ...(sapMap[row.sku_id] || {}),       // keep plan data if exists
                sku_id: row.sku_id,
                descripcion: sapMap[row.sku_id]?.descripcion || '',
                stock_hoy: Number(row.stock_hoy || 0),
                stock_fin_mes: Number(row.stock_fin_mes || 0),
                po_mes_actual: Number(row.po_mes_actual || 0),
                projected_venta_consumo: ventaConsumo,
                venta_diaria: ventaDiaria || sapMap[row.sku_id]?.venta_diaria || 0,
            };
        });

        set({ sapData: sapMap, loading: false, isFetched: true, lastFetchedAt: Date.now() });
    },

    getSapItem: (sku: string) => {
        const state = get();
        return state.sapData[sku];
    }
}));
