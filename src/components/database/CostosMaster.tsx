import React, { useEffect, useState } from 'react';
import { Search, Loader2, Trash2, Download, Upload, Edit, FileSpreadsheet } from 'lucide-react';
import { useCostosStore } from '../../store/useCostosStore';
import { useStore } from '../../store/useStore';
import { EditCostoModal } from './EditCostoModal';
import { ImportCostosModal } from './ImportCostosModal';

export const CostosMaster: React.FC = () => {
    const { costos, isLoading, error, fetchCostos } = useCostosStore();
    const activeProcessId = useStore((state) => state.activeProcessId);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<any>(null);

    // Map the UI processId to the DB processId format
    const getDbProcessId = () => {
        if (activeProcessId === 'laminador1') return 'LAM1';
        if (activeProcessId === 'laminador2') return 'LAM2';
        if (activeProcessId === 'laminador3') return 'LAM3';
        return '';
    };

    useEffect(() => {
        fetchCostos();
    }, [fetchCostos]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500">
                <p>Error cargando maestro de costos:</p>
                <p className="font-mono mt-2">{error}</p>
            </div>
        );
    }

    const lamCode = getDbProcessId();
    // Filter by active laminator and search term
    const filteredCostos = costos.filter(
        (c) =>
            c.codigo_lam === lamCode &&
            (c.codigo_sap.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredCostos.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectItem = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} registros?`)) {
            await useCostosStore.getState().deleteMultipleCostos(selectedIds);
            setSelectedIds([]);
        }
    };

    const handleExport = () => {
        const headers = ["ID", "Código SAP", "Laminador", "Descripción", "Familia TCM", "Ritmo (t/h)", "Costo (Sin CF)", "Cambio Medida (h)"];
        const rows = filteredCostos.map(c => [
            c.id, c.codigo_sap, c.codigo_lam, c.descripcion, c.id_familia_tcm, c.ritmo_th, c.costo_total_lam_sin_cf, c.cambio_medida_horas
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `maestro_costos_${lamCode}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="bg-white border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">
                        Maestro de Costos y Tiempos - {lamCode}
                    </h2>
                    <p className="text-sm text-slate-500">
                        Base de datos de costos de producción, ritmos y familias TCM (Sincronizado con BD)
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Buscar SKU o Descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors text-sm font-medium"
                    >
                        <Upload size={16} />
                        Importar
                    </button>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors text-sm font-medium"
                    >
                        <Download size={16} />
                        Exportar
                    </button>

                    <div className="h-8 w-px bg-slate-200 mx-1"></div>

                    {selectedIds.length > 0 ? (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors text-sm font-bold shadow-sm"
                        >
                            <Trash2 size={16} />
                            Eliminar ({selectedIds.length})
                        </button>
                    ) : (
                        <div className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium whitespace-nowrap">
                            {filteredCostos.length} Registros
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length > 0 && selectedIds.length === filteredCostos.length}
                                        onChange={handleSelectAll}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase w-24">Código SAP</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase min-w-[300px]">Descripción</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase text-center">Familia TCM</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase text-right">Ritmo (t/h)</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase text-right">Costo Total(Sin CF)</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase text-right">Cambio Medida(Hrs)</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCostos.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                        No se encontraron costos para {lamCode} o la búsqueda no coincide.
                                    </td>
                                </tr>
                            ) : (
                                filteredCostos.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`hover:bg-blue-50/30 transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <td className="px-4 py-2.5">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => handleSelectItem(item.id)}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-sm font-medium text-slate-700">
                                            {item.codigo_sap}
                                        </td>
                                        <td className="px-4 py-2.5 text-sm text-slate-600">{item.descripcion}</td>
                                        <td className="px-4 py-2.5 text-sm text-slate-600 text-center">
                                            <span className="bg-slate-100 px-2.5 py-1 rounded text-xs font-medium text-slate-700">
                                                {item.id_familia_tcm || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-sm text-slate-700 text-right font-mono">
                                            {item.ritmo_th ? item.ritmo_th.toFixed(2) : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-sm text-slate-700 text-right font-mono text-emerald-600">
                                            {item.costo_total_lam_sin_cf ? `$${item.costo_total_lam_sin_cf.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-sm text-slate-700 text-right font-mono text-orange-600">
                                            {item.cambio_medida_horas ? `${item.cambio_medida_horas.toFixed(2)}h` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setCurrentItem(item);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('¿Eliminar este registro?')) {
                                                            useCostosStore.getState().deleteCosto(item.id);
                                                        }
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {isEditModalOpen && currentItem && (
                <EditCostoModal
                    item={currentItem}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setCurrentItem(null);
                    }}
                />
            )}

            {isImportModalOpen && (
                <ImportCostosModal
                    onClose={() => setIsImportModalOpen(false)}
                />
            )}
        </div>
    );
};
