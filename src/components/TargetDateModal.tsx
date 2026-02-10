import React, { useState, useEffect } from 'react';
import { X, CalendarClock, Calculator } from 'lucide-react';
import { format } from 'date-fns';

interface TargetDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (date: Date) => void;
    initialDate?: Date;
    minDate?: Date;
    itemName?: string;
}

export const TargetDateModal: React.FC<TargetDateModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialDate,
    minDate,
    itemName
}) => {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && initialDate) {
            try {
                setSelectedDate(format(initialDate, "yyyy-MM-dd'T'HH:mm"));
            } catch (e) {
                setSelectedDate('');
            }
            setError(null);
        }
    }, [isOpen, initialDate]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!selectedDate) {
            setError('Por favor seleccione una fecha y hora.');
            return;
        }

        const dateObj = new Date(selectedDate);
        if (isNaN(dateObj.getTime())) {
            setError('Fecha inválida.');
            return;
        }

        if (minDate && dateObj <= minDate) {
            setError(`La fecha fin debe ser posterior al inicio (${format(minDate, 'dd/MM HH:mm')}).`);
            return;
        }

        onSave(dateObj);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <CalendarClock size={20} />
                        <h3 className="font-bold text-lg">Definir Fecha Fin Objetivo</h3>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p>El sistema calculará automáticamente la <strong>Cantidad (Ton)</strong> necesaria para que la orden:</p>
                        <p className="font-medium text-blue-800 mt-1">{itemName || 'Seleccionada'}</p>
                        <p>finalice exactamente en la fecha indicada.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Nueva Fecha Fin</label>
                        <input
                            type="datetime-local"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-lg"
                            value={selectedDate}
                            onChange={(e) => {
                                setSelectedDate(e.target.value);
                                setError(null);
                            }}
                        />
                        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                    </div>

                    {minDate && (
                        <p className="text-xs text-gray-500">
                            * Fecha de Inicio actual: {format(minDate, 'dd/MM/yyyy HH:mm')}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <Calculator size={18} />
                        Calcular y Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
