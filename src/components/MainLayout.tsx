import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useStore } from '../store/useStore';
import { ProcessSelector } from './ProcessSelector';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const activeTab = useStore((state) => state.activeTab);

    const getTitle = () => {
        switch (activeTab) {
            case 'scheduler': return 'Programación de Producción';
            case 'visual': return 'Secuencia Diaria';
            case 'database': return 'Base de Datos';
            case 'settings': return 'Configuración';
            default: return '';
        }
    };

    return (
        <div className="flex h-screen bg-[#f8f9fa] overflow-hidden">
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

            <main className="flex-1 overflow-auto transition-all duration-300 relative flex flex-col">
                <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
                    <h1 className="text-xl font-bold text-slate-800">{getTitle()}</h1>
                    <ProcessSelector />
                </header>

                <div className="flex-1 p-6 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};
