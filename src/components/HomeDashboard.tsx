import React from 'react';
import {
    BarChart3,
    Sparkles,
    LayoutDashboard,
    Calendar,
    Database,
    Settings,
    ArrowRight,
    TrendingUp,
    Zap,
    Clock,
    Archive,
    Sliders
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { TabId } from '../types';

interface AppCard {
    id: TabId;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ElementType;
    accentIcon: React.ElementType;
    gradient: string;
    iconBg: string;
    stat?: string;
    statLabel?: string;
}

const APP_CARDS: AppCard[] = [
    {
        id: 'planner',
        title: 'Planificador',
        subtitle: 'Capacidad y Costos',
        description: 'Administra el calendario de capacidades, costos de máquina y optimiza el plan de producción mensual por laminador.',
        icon: BarChart3,
        accentIcon: TrendingUp,
        gradient: 'from-blue-600 to-indigo-700',
        iconBg: 'bg-blue-50',
        stat: '2026',
        statLabel: 'Año activo',
    },
    {
        id: 'sequencer',
        title: 'Secuenciador',
        subtitle: 'Optimización de Secuencia',
        description: 'Optimiza el orden de producción con algoritmos genéticos para minimizar cambios de medida y maximizar ventas.',
        icon: Sparkles,
        accentIcon: Zap,
        gradient: 'from-violet-600 to-purple-700',
        iconBg: 'bg-violet-50',
        stat: 'IA',
        statLabel: 'Motor óptimo',
    },
    {
        id: 'scheduler',
        title: 'Plan Mensual',
        subtitle: 'Programación de Producción',
        description: 'Gestiona el programa de producción mensual con SKUs, cantidades, paradas y tiempos de cambio por proceso.',
        icon: LayoutDashboard,
        accentIcon: Clock,
        gradient: 'from-emerald-600 to-teal-700',
        iconBg: 'bg-emerald-50',
        stat: '3',
        statLabel: 'Laminadores',
    },
    {
        id: 'visual',
        title: 'Secuencia Diaria',
        subtitle: 'Vista Gantt Diaria',
        description: 'Visualiza la secuencia de producción día a día en un diagrama Gantt interactivo con marcadores de paradas y cambios.',
        icon: Calendar,
        accentIcon: Calendar,
        gradient: 'from-orange-500 to-amber-600',
        iconBg: 'bg-orange-50',
        stat: 'Gantt',
        statLabel: 'Visualización',
    },
    {
        id: 'database',
        title: 'Base de Datos',
        subtitle: 'Gestión de Datos Maestros',
        description: 'Administra artículos, reglas de cambio de medida, datos SAP de producción y sincronización con la base de datos.',
        icon: Database,
        accentIcon: Archive,
        gradient: 'from-slate-600 to-slate-800',
        iconBg: 'bg-slate-50',
        stat: 'SAP',
        statLabel: 'Integrado',
    },
    {
        id: 'settings',
        title: 'Configuración',
        subtitle: 'Ajustes del Sistema',
        description: 'Configura horarios de trabajo, días festivos, paradas programadas y parámetros generales por proceso.',
        icon: Settings,
        accentIcon: Sliders,
        gradient: 'from-rose-500 to-pink-700',
        iconBg: 'bg-rose-50',
        stat: '24/7',
        statLabel: 'Monitoreo',
    },
];

export const HomeDashboard: React.FC = () => {
    const { setActiveTab } = useStore();
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <div className="home-dashboard">
            {/* Hero Section */}
            <div className="home-hero">
                <div className="home-hero-content">
                    <p className="home-greeting">{greeting} 👋</p>
                    <h1 className="home-title">Sistema de Planificación</h1>
                    <p className="home-subtitle">
                        Laminación · Aceros Arequipa
                    </p>
                    <p className="home-description">
                        Selecciona una aplicación para comenzar a trabajar. Cada módulo está diseñado
                        para optimizar una etapa del proceso de producción.
                    </p>
                </div>
                <div className="home-hero-badge">
                    <span className="home-badge-dot" />
                    Sistema activo
                </div>
            </div>

            {/* Cards Grid */}
            <div className="home-grid">
                {APP_CARDS.map((card) => {
                    const Icon = card.icon;
                    const AccentIcon = card.accentIcon;
                    return (
                        <button
                            key={card.id}
                            className="home-card"
                            onClick={() => setActiveTab(card.id)}
                        >
                            {/* Card top bar */}
                            <div className={`home-card-bar bg-gradient-to-r ${card.gradient}`} />

                            <div className="home-card-body">
                                {/* Icon + Stat */}
                                <div className="home-card-top">
                                    <div className={`home-card-icon ${card.iconBg}`}>
                                        <Icon size={24} className="home-card-icon-svg" />
                                    </div>
                                    {card.stat && (
                                        <div className="home-card-stat">
                                            <span className="home-card-stat-value">{card.stat}</span>
                                            <span className="home-card-stat-label">{card.statLabel}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Title */}
                                <div className="home-card-title-block">
                                    <h2 className="home-card-title">{card.title}</h2>
                                    <p className="home-card-subtitle">{card.subtitle}</p>
                                </div>

                                {/* Description */}
                                <p className="home-card-description">{card.description}</p>

                                {/* Footer */}
                                <div className="home-card-footer">
                                    <div className="home-card-accent">
                                        <AccentIcon size={13} />
                                        <span>Abrir módulo</span>
                                    </div>
                                    <div className={`home-card-arrow bg-gradient-to-r ${card.gradient}`}>
                                        <ArrowRight size={14} />
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
