import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useCostosStore, type MaestroCostosItem } from '../../store/useCostosStore';

interface EditCostoModalProps {
    item: MaestroCostosItem;
    onClose: () => void;
}

export const EditCostoModal: React.FC<EditCostoModalProps> = ({ item, onClose }) => {
    const updateCosto = useCostosStore((state) => state.updateCosto);
    const [formData, setFormData] = useState<Partial<MaestroCostosItem>>({
        descripcion: item.descripcion,
        id_familia_tcm: item.id_familia_tcm,
        ritmo_th: item.ritmo_th,
        costo_total_lam_sin_cf: item.costo_total_lam_sin_cf,
        cambio_medida_horas: item.cambio_medida_horas,
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateCosto(item.id, formData);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800">Editar Registro - {item.codigo_sap}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</label>
                        <input
                            type="text"
                            value={formData.descripcion}
                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Familia TCM</label>
                            <input
                                type="text"
                                value={formData.id_familia_tcm}
                                onChange={(e) => setFormData({ ...formData, id_familia_tcm: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ritmo (t/h)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.ritmo_th}
                                onChange={(e) => setFormData({ ...formData, ritmo_th: Number(e.target.value) })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo (Sin CF)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.costo_total_lam_sin_cf}
                                    onChange={(e) => setFormData({ ...formData, costo_total_lam_sin_cf: Number(e.target.value) })}
                                    className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cambio Medida (Hrs)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.cambio_medida_horas}
                                onChange={(e) => setFormData({ ...formData, cambio_medida_horas: Number(e.target.value) })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <Save size={18} />
                            )}
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
