import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Article } from '../types/article';
import type { ProcessId } from '../types';

interface ArticleStore {
    // Stores: Record<ProcessId, Article[]>
    // We'll initialize with empty arrays for all known processes
    articlesByProcess: Record<ProcessId, Article[]>;

    // Actions now require processId to know which list to update
    setArticles: (processId: ProcessId, articles: Article[]) => void;
    addArticle: (processId: ProcessId, article: Article) => void;
    updateArticle: (processId: ProcessId, index: number, article: Article) => void;
    deleteArticle: (processId: ProcessId, index: number) => void;
    deleteArticles: (processId: ProcessId, indices: number[]) => void;

    // Helper to get articles for current process
    getArticles: (processId: ProcessId) => Article[];
}

const initialArticlesState: Record<ProcessId, Article[]> = {
    'laminador1': [],
    'laminador2': [],
    'laminador3': [],
};

export const useArticleStore = create<ArticleStore>()(
    persist(
        (set, get) => ({
            articlesByProcess: initialArticlesState,

            getArticles: (processId) => get().articlesByProcess[processId] || [],

            setArticles: (processId, articles) => set((state) => ({
                articlesByProcess: {
                    ...state.articlesByProcess,
                    [processId]: articles
                }
            })),

            addArticle: (processId, article) => set((state) => ({
                articlesByProcess: {
                    ...state.articlesByProcess,
                    [processId]: [...(state.articlesByProcess[processId] || []), article]
                }
            })),

            updateArticle: (processId, index, article) => set((state) => {
                const currentList = state.articlesByProcess[processId] || [];
                const newList = [...currentList];
                newList[index] = article;
                return {
                    articlesByProcess: {
                        ...state.articlesByProcess,
                        [processId]: newList
                    }
                };
            }),

            deleteArticle: (processId, index) => set((state) => {
                const currentList = state.articlesByProcess[processId] || [];
                const newList = [...currentList];
                newList.splice(index, 1);
                return {
                    articlesByProcess: {
                        ...state.articlesByProcess,
                        [processId]: newList
                    }
                };
            }),

            deleteArticles: (processId, indices) => set((state) => {
                const currentList = state.articlesByProcess[processId] || [];
                const newList = currentList.filter((_, i) => !indices.includes(i));
                return {
                    articlesByProcess: {
                        ...state.articlesByProcess,
                        [processId]: newList
                    }
                };
            }),
        }),
        {
            name: 'article-storage-multi', // New storage key to avoid conflicts/bad hydration
            partialize: (state) => ({ articlesByProcess: state.articlesByProcess }),
        }
    )
);
