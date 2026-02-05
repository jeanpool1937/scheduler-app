
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Article } from '../types/article';

interface ArticleStore {
    articles: Article[];
    setArticles: (articles: Article[]) => void;
    addArticle: (article: Article) => void;
    updateArticle: (index: number, article: Article) => void;
    deleteArticle: (index: number) => void;
    deleteArticles: (indices: number[]) => void;
}

export const useArticleStore = create<ArticleStore>()(
    persist(
        (set) => ({
            articles: [],
            setArticles: (articles) => set({ articles }),
            addArticle: (article) => set((state) => ({ articles: [...state.articles, article] })),
            updateArticle: (index, article) => set((state) => {
                const newArticles = [...state.articles];
                newArticles[index] = article;
                return { articles: newArticles };
            }),
            deleteArticle: (index) => set((state) => {
                const newArticles = [...state.articles];
                newArticles.splice(index, 1);
                return { articles: newArticles };
            }),
            deleteArticles: (indices) => set((state) => {
                const newArticles = state.articles.filter((_, i) => !indices.includes(i));
                return { articles: newArticles };
            }),
        }),
        {
            name: 'article-storage',
        }
    )
);
