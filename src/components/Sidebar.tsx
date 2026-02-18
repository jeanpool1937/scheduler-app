import React from 'react';
import {
    LayoutDashboard,
    Calendar,
    Database,
    Settings,
    ChevronLeft,
    ChevronRight,
    Factory,
    Sparkles
} from 'lucide-react';
import { useStore } from '../store/useStore';

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
    const { activeTab, setActiveTab } = useStore();

    const menuItems = [
        { id: 'sequencer', label: 'Secuenciador', icon: Sparkles },
        { id: 'scheduler', label: 'Plan Mensual', icon: LayoutDashboard },
        { id: 'visual', label: 'Secuencia Diaria', icon: Calendar },
        { id: 'database', label: 'Base de Datos', icon: Database },
        { id: 'settings', label: 'Configuración', icon: Settings },
    ];

    return (
        <div
            className={`
                bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300 z-20 relative
                ${collapsed ? 'w-16' : 'w-64'}
            `}
        >
            {/* Header / Logo Area */}
            <div className="h-16 flex items-center px-4 border-b border-gray-100">
                <div className="bg-[#004DB4] p-2 rounded-lg text-white shrink-0">
                    <Factory size={20} />
                </div>
                {!collapsed && (
                    <div className="ml-3 overflow-hidden whitespace-nowrap">
                        <h1 className="font-bold text-gray-800 text-sm">Laminación</h1>
                        <p className="text-xs text-gray-500">Aceros Arequipa</p>
                    </div>
                )}
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50 text-gray-500 z-30"
            >
                {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Navigation Items */}
            <nav className="flex-1 py-6 px-2 space-y-1">
                {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            title={collapsed ? item.label : ''}
                            className={`
                                w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors
                                ${isActive
                                    ? 'bg-[#e6f0ff] text-[#004DB4]'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }
                                ${collapsed ? 'justify-center' : 'justify-start'}
                            `}
                        >
                            <item.icon size={20} className={isActive ? 'text-[#004DB4]' : 'text-gray-400'} />
                            {!collapsed && (
                                <span className="ml-3">{item.label}</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* User Profile / Footer - Placeholder */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                        AA
                    </div>
                    {!collapsed && (
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-700">Usuario PCP</p>
                            <p className="text-xs text-gray-400">Planificador</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
