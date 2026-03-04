import React, { useState, useCallback } from 'react';
import { X, UploadCloud, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useCostosStore } from '../../store/useCostosStore';

interface ImportCostosModalProps {
    onClose: () => void;
}

export const ImportCostosModal: React.FC<ImportCostosModalProps> = ({ onClose }) => {
    const upsertCostos = useCostosStore((state) => state.upsertCostos);
    const [preview, setPreview] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [fileName, setFileName] = useState('');

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = ev.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

                // Mapping preview and normalizing keys
                const normalized = jsonData.map(row => {
                    const findValue = (row: any, ...keys: string[]) => {
                        for (const k of keys) {
                            const found = Object.keys(row).find(rk => rk.toLowerCase().includes(k.toLowerCase()));
                            if (found) return row[found];
                        }
                        return null;
                    };

                    const sap = String(findValue(row, 'sap', 'codigo', 'sku') || '');
                    const lam = String(findValue(row, 'lam', 'maquina', 'laminador') || 'LAM1').toUpperCase();

                    return {
                        id: `${sap}-${lam}`,
                        codigo_sap: sap,
                        codigo_lam: lam,
                        descripcion: findValue(row, 'desc', 'material') || '',
                        id_familia_tcm: String(findValue(row, 'fam', 'tcm') || ''),
                        ritmo_th: Number(findValue(row, 'ritmo', 'ton') || 0),
                        costo_total_lam_sin_cf: Number(findValue(row, 'costo') || 0),
                        cambio_medida_horas: Number(findValue(row, 'cambio', 'hora') || 0),
                    };
                }).filter(item => item.codigo_sap);

                setPreview(normalized);
            } catch (error) {
                console.error(error);
                alert('Error al procesar el archivo Excel.');
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const handleImport = async () => {
        setIsProcessing(true);
        try {
            await upsertCostos(preview);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al importar los datos a la base de datos.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FileSpreadsheet className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Importar Maestro de Costos</h3>
                            <p className="text-xs text-slate-500">Actualiza o crea registros desde Excel</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-auto">
                    {preview.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-400 transition-colors bg-slate-50/50">
                            <UploadCloud className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-600 font-bold mb-1">Selecciona o arrastra tu archivo Excel</p>
                            <p className="text-slate-400 text-sm mb-6">Columnas esperadas: SAP, LAM, Descripcion, FAM, Ritmo, Costo, Cambio</p>
                            <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200">
                                <span>Elegir Archivo</span>
                                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="text-blue-600" size={20} />
                                    <div>
                                        <p className="text-sm font-bold text-blue-900">{fileName}</p>
                                        <p className="text-xs text-blue-700">{preview.length} registros listos para procesar</p>
                                    </div>
                                </div>
                                <button onClick={() => setPreview([])} className="text-xs font-bold text-blue-600 hover:underline">Cambiar archivo</button>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-white">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 font-bold text-slate-600 uppercase">ID</th>
                                            <th className="px-3 py-2 font-bold text-slate-600 uppercase">Descripción</th>
                                            <th className="px-3 py-2 font-bold text-slate-600 uppercase text-right">Ritmo</th>
                                            <th className="px-3 py-2 font-bold text-slate-600 uppercase text-right">Costo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {preview.slice(0, 10).map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2 font-medium text-slate-700">{row.id}</td>
                                                <td className="px-3 py-2 text-slate-500 truncate max-w-[200px]">{row.descripcion}</td>
                                                <td className="px-3 py-2 text-right text-slate-600 font-mono">{row.ritmo_th}</td>
                                                <td className="px-3 py-2 text-right text-slate-600 font-mono">${row.costo_total_lam_sin_cf}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 10 && (
                                    <div className="p-2 text-center text-[10px] text-slate-400 border-t border-slate-100 italic">
                                        ... y {preview.length - 10} filas más
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={isProcessing || preview.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <CheckCircle2 size={18} />
                        )}
                        Confirmar e Importar
                    </button>
                </div>
            </div>
        </div>
    );
};
