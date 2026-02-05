
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import { useChangeoverStore } from '../store/useChangeoverStore';
import { Plus, Trash2, Settings, Download, Database } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const SettingsPanel: React.FC = () => {
    const { stoppageConfigs, addStoppageConfig, removeStoppageConfig, schedule, programStartDate } = useStore();
    const { articles } = useArticleStore();
    const { rules: changeovers } = useChangeoverStore();
    const [newLabel, setNewLabel] = useState('');

    const handleAdd = () => {
        if (!newLabel.trim()) return;

        const id = uuidv4();
        addStoppageConfig({
            id,
            colId: `stop_${id.substr(0, 8)}`,
            label: newLabel,
            defaultDuration: 0
        });
        setNewLabel('');
    };

    const handleExportBackup = () => {
        const fullBackup = {
            timestamp: new Date().toISOString(),
            config: {
                stoppageConfigs,
                programStartDate
            },
            schedule,
            database: {
                articles,
                changeovers
            }
        };

        const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_scheduler_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
            {/* Stoppages Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                    <Settings className="text-gray-500" />
                    <h2 className="text-xl font-bold text-gray-800">Configuración de Paradas</h2>
                </div>

                <p className="text-gray-600 mb-4">
                    Define las columnas de paradas que aparecerán en el programador (ej. Cambio de Medida, Mantenimiento).
                </p>

                <div className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Nombre de la Parada (ej. Cambio Utillaje)"
                        className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button
                        onClick={handleAdd}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <Plus size={18} /> Agregar
                    </button>
                </div>

                <div className="space-y-2">
                    {stoppageConfigs.map(config => (
                        <div key={config.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                            <span className="font-medium text-gray-700">{config.label}</span>
                            <button
                                onClick={() => removeStoppageConfig(config.id)}
                                className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition"
                                title="Eliminar columna"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}

                    {stoppageConfigs.length === 0 && (
                        <p className="text-center text-gray-400 italic py-4">No hay columnas de parada configuradas.</p>
                    )}
                </div>
            </div>

            {/* Backup & Data Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                    <Database className="text-gray-500" />
                    <h2 className="text-xl font-bold text-gray-800">Copia de Seguridad</h2>
                </div>

                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-medium text-gray-800">Descargar Copia Completa</p>
                        <p className="text-sm text-gray-500">
                            Guarda un archivo JSON con toda la programación, configuración y bases de datos actuales.
                        </p>
                    </div>
                    <button
                        onClick={handleExportBackup}
                        className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-900 transition flex items-center gap-2"
                    >
                        <Download size={18} /> Exportar Todo
                    </button>
                </div>
            </div>
        </div>
    );
};
