
import React from 'react';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import { useChangeoverStore } from '../store/useChangeoverStore';
import { Download, Database, Upload } from 'lucide-react';
import { HolidayConfig } from './HolidayConfig';
import { ManualStopsConfig } from './ManualStopsConfig';
import { WorkScheduleConfig } from './WorkScheduleConfig';

export const SettingsPanel: React.FC = () => {
    const activeProcessId = useStore((state) => state.activeProcessId);
    const processData = useStore((state) => state.processes[state.activeProcessId]);

    const {
        stoppageConfigs,
        programStartDate,
        columnLabels,
        schedule,
        manualStops,
        workSchedule
    } = processData;

    const {
        setStoppageConfigs,
        setProgramStartDate,
        importColumnLabels,
        setSchedule,
        setManualStops,
        setWorkSchedule
    } = useStore();
    const articles = useArticleStore((state) => state.getArticles(activeProcessId));
    const { setArticles } = useArticleStore();
    const changeovers = useChangeoverStore((state) => state.getRules(activeProcessId));
    const { setRules } = useChangeoverStore();

    const processNames: Record<string, string> = {
        laminador1: 'Laminador 1',
        laminador2: 'Laminador 2',
        laminador3: 'Laminador 3',
    };

    const handleExportBackup = () => {
        const fullBackup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            processId: activeProcessId,
            processName: processNames[activeProcessId] || activeProcessId,
            config: {
                stoppageConfigs,
                programStartDate,
                columnLabels,
                manualStops,
                workSchedule
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
        const fileName = `backup_${processNames[activeProcessId] || activeProcessId}_${new Date().toISOString().slice(0, 10)}.json`;
        a.download = fileName.replace(/\s+/g, '_'); // Replace spaces with underscores for filename safety
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target?.result as string);

                // Validate basic structure
                if (!backup.version || !backup.config || !backup.schedule || !backup.database) {
                    alert('❌ Archivo de respaldo inválido. Asegúrate de usar un archivo exportado desde esta aplicación.');
                    return;
                }

                // Import configuration
                if (backup.config.stoppageConfigs) {
                    setStoppageConfigs(backup.config.stoppageConfigs);
                }
                if (backup.config.programStartDate) {
                    setProgramStartDate(new Date(backup.config.programStartDate));
                }
                if (backup.config.columnLabels) {
                    importColumnLabels(backup.config.columnLabels);
                }
                if (backup.config.manualStops) {
                    // Rehydrate dates from JSON strings
                    const rehydrated = backup.config.manualStops.map((s: any) => ({
                        ...s,
                        start: new Date(s.start)
                    }));
                    setManualStops(rehydrated);
                }
                if (backup.config.workSchedule) {
                    setWorkSchedule(backup.config.workSchedule);
                }

                // Import schedule
                if (backup.schedule) {
                    setSchedule(backup.schedule);
                }

                // Import databases
                if (backup.database.articles) {
                    setArticles(activeProcessId, backup.database.articles);
                }
                if (backup.database.changeovers) {
                    setRules(activeProcessId, backup.database.changeovers);
                }

                alert('✅ Datos importados correctamente. La aplicación se recargará.');

                // Reload to ensure all components update
                setTimeout(() => window.location.reload(), 500);

            } catch (error) {
                console.error('Error importing backup:', error);
                alert('❌ Error al importar el archivo. Verifica que sea un archivo JSON válido.');
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // Reset input
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-6 max-w-2xl mx-auto space-y-8">


                {/* Backup & Data Management */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-2 mb-6 border-b pb-4">
                        <Database className="text-gray-500" />
                        <h2 className="text-xl font-bold text-gray-800">Copia de Seguridad</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* Export */}
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-medium text-gray-800">Descargar Copia Completa</p>
                                <p className="text-sm text-gray-500">
                                    Guarda un archivo JSON con toda la programación, configuración y bases de datos.
                                </p>
                            </div>
                            <button
                                onClick={handleExportBackup}
                                className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-900 transition flex items-center gap-2"
                            >
                                <Download size={18} /> Exportar
                            </button>
                        </div>

                        {/* Import */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                            <div>
                                <p className="font-medium text-gray-800">Importar Copia Completa</p>
                                <p className="text-sm text-gray-500">
                                    Carga un archivo de respaldo para restaurar todos tus datos.
                                </p>
                            </div>
                            <label className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition flex items-center gap-2 cursor-pointer">
                                <Upload size={18} /> Importar
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportBackup}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Work Schedule Configuration */}
                <WorkScheduleConfig />

                {/* Holidays Configuration */}
                <HolidayConfig />

                {/* Manual Stops Configuration */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-6">Paradas Programadas Manuales</h2>
                    <ManualStopsConfig />
                </div>
            </div>
        </div>
    );
};
