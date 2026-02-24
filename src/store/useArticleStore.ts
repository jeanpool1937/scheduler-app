import { create } from 'zustand';
import type { Article } from '../types/article';
import type { ProcessId } from '../types';
import { supabase } from '../lib/supabaseClient';

interface ArticleStore {
    articlesByProcess: Record<ProcessId, Article[]>;
    loading: boolean;

    // Actions
    fetchArticles: (processId: ProcessId) => Promise<void>;
    fetchAllArticles: () => Promise<void>;
    addArticle: (processId: ProcessId, article: Article) => Promise<void>;
    setArticles: (processId: ProcessId, articles: Article[]) => Promise<void>;
    updateArticle: (processId: ProcessId, id: string, article: Partial<Article>) => Promise<void>;
    deleteArticle: (processId: ProcessId, id: string) => Promise<void>;
    deleteArticles: (processId: ProcessId, ids: string[]) => Promise<void>;

    // Legacy support or quick helper
    getArticles: (processId: ProcessId) => Article[];
}

const initialArticlesState: Record<ProcessId, Article[]> = {
    'laminador1': [],
    'laminador2': [],
    'laminador3': [],
};

// Map DB row to Article type
const mapFromDb = (row: any): Article => ({
    skuLaminacion: row.sku_laminacion,
    ending: row.ending,
    codigoProgramacion: row.codigo_programacion,
    descripcion: row.descripcion,
    skuPalanquilla: row.sku_palanquilla,
    calidadPalanquilla: row.calidad_palanquilla,
    ritmoTH: Number(row.ritmo_th),
    rendimientoMetalico: Number(row.rendimiento_metalico),
    fam: row.fam,
    aciertoCalibracion: Number(row.acierto_calibracion),
    idTablaCambioMedida: row.id_tabla_cambio_medida,
    pesoPalanquilla: Number(row.peso_palanquilla),
    almacenDestino: row.almacen_destino,
    comentarios: row.comentarios,
    // Store id for faster updates
    id: row.id
});

// Map Article type to DB row
const mapToDb = (processId: ProcessId, article: Partial<Article>) => ({
    process_id: processId,
    sku_laminacion: article.skuLaminacion,
    ending: article.ending,
    codigo_programacion: article.codigoProgramacion,
    descripcion: article.descripcion,
    sku_palanquilla: article.skuPalanquilla,
    calidad_palanquilla: article.calidadPalanquilla,
    ritmo_th: article.ritmoTH,
    rendimiento_metalico: article.rendimientoMetalico,
    fam: article.fam,
    acierto_calibracion: article.aciertoCalibracion,
    id_tabla_cambio_medida: article.idTablaCambioMedida,
    peso_palanquilla: article.pesoPalanquilla,
    almacen_destino: article.almacenDestino,
    comentarios: article.comentarios,
});

export const useArticleStore = create<ArticleStore>((set, get) => ({
    articlesByProcess: initialArticlesState,
    loading: false,

    getArticles: (processId) => get().articlesByProcess[processId] || [],

    fetchArticles: async (processId) => {
        set({ loading: true });
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('scheduler_articles')
                .select('*')
                .eq('process_id', processId)
                .range(from, from + step - 1);

            if (error) {
                console.error(`Error fetching articles for ${processId}:`, error);
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

        const articles = allData.map(mapFromDb);
        set((state) => ({
            articlesByProcess: {
                ...state.articlesByProcess,
                [processId]: articles
            },
            loading: false
        }));
    },

    fetchAllArticles: async () => {
        set({ loading: true });
        const { data, error } = await supabase
            .from('scheduler_articles')
            .select('*');

        if (error) {
            console.error('Error fetching all articles:', error);
            set({ loading: false });
            return;
        }

        const grouped: Record<ProcessId, Article[]> = {
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

        set({ articlesByProcess: grouped, loading: false });
    },

    addArticle: async (processId, article) => {
        const { data, error } = await supabase
            .from('scheduler_articles')
            .insert(mapToDb(processId, article))
            .select()
            .single();

        if (error) {
            console.error('Error adding article:', error);
            return;
        }

        set((state) => ({
            articlesByProcess: {
                ...state.articlesByProcess,
                [processId]: [...(state.articlesByProcess[processId] || []), mapFromDb(data)]
            }
        }));
    },

    setArticles: async (processId, articles) => {
        set({ loading: true });
        // 1. Delete existing for this process
        const { error: delError } = await supabase
            .from('scheduler_articles')
            .delete()
            .eq('process_id', processId);

        if (delError) {
            console.error('Error deleting old articles:', delError);
            set({ loading: false });
            return;
        }

        // 2. Insert new
        const toInsert = articles.map(a => mapToDb(processId, a));
        const { data, error } = await supabase
            .from('scheduler_articles')
            .insert(toInsert)
            .select();

        if (error) {
            console.error('Error inserting articles:', error);
            set({ loading: false });
            return;
        }

        set((state) => ({
            articlesByProcess: {
                ...state.articlesByProcess,
                [processId]: (data || []).map(mapFromDb)
            },
            loading: false
        }));
    },

    updateArticle: async (processId, id, article) => {
        const { data, error } = await supabase
            .from('scheduler_articles')
            .update(mapToDb(processId, article))
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating article:', error);
            return;
        }

        set((state) => ({
            articlesByProcess: {
                ...state.articlesByProcess,
                [processId]: (state.articlesByProcess[processId] || []).map(a =>
                    (a as any).id === id ? mapFromDb(data) : a
                )
            }
        }));
    },

    deleteArticle: async (processId, id) => {
        const { error } = await supabase
            .from('scheduler_articles')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting article:', error);
            return;
        }

        set((state) => ({
            articlesByProcess: {
                ...state.articlesByProcess,
                [processId]: (state.articlesByProcess[processId] || []).filter(a => (a as any).id !== id)
            }
        }));
    },

    deleteArticles: async (processId, ids) => {
        const { error } = await supabase
            .from('scheduler_articles')
            .delete()
            .in('id', ids);

        if (error) {
            console.error('Error deleting articles:', error);
            return;
        }

        set((state) => ({
            articlesByProcess: {
                ...state.articlesByProcess,
                [processId]: (state.articlesByProcess[processId] || []).filter(a => !ids.includes((a as any).id))
            }
        }));
    },
}));
