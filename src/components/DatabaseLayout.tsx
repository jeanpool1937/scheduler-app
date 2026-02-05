
import React, { useState } from 'react';
import { ArticleMaster } from './ArticleMaster';
import { ChangeoverMaster } from './ChangeoverMaster';
import { Table, ArrowRightLeft } from 'lucide-react';

export const DatabaseLayout: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<'articles' | 'changeovers'>('articles');

    return (
        <div className="h-full flex flex-col">
            {/* Sub-navigation */}
            <div className="flex bg-white border-b px-4">
                <button
                    onClick={() => setActiveSubTab('articles')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'articles'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Table size={16} />
                    Maestro Artículos
                </button>
                <button
                    onClick={() => setActiveSubTab('changeovers')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'changeovers'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <ArrowRightLeft size={16} />
                    Matriz de Cambios
                </button>
            </div>

            {/* Content Content */}
            <div className="flex-1 overflow-hidden">
                {activeSubTab === 'articles' && <ArticleMaster />}
                {activeSubTab === 'changeovers' && <ChangeoverMaster />}
            </div>
        </div>
    );
};
