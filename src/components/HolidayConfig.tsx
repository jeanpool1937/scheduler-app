import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Trash2, Plus } from 'lucide-react';

export const HolidayConfig: React.FC = () => {
    const { holidays } = useStore((state) => state.processes[state.activeProcessId]);
    const { addHoliday, removeHoliday } = useStore();
    const [newHolidayInput, setNewHolidayInput] = useState('');
    const [error, setError] = useState('');

    const handleAddHoliday = () => {
        setError('');

        if (!newHolidayInput.trim()) {
            setError('Por favor ingresa una fecha');
            return;
        }

        try {
            // Parse the input date (expected format: YYYY-MM-DD from input[type="date"])
            const date = new Date(newHolidayInput);

            if (isNaN(date.getTime())) {
                setError('Fecha inválida');
                return;
            }

            const dateStr = format(date, 'yyyy-MM-dd');

            if (holidays.includes(dateStr)) {
                setError('Este feriado ya existe');
                return;
            }

            addHoliday(dateStr);
            setNewHolidayInput('');
        } catch (err) {
            setError('Error al procesar la fecha');
        }
    };

    const handleRemoveHoliday = (dateStr: string) => {
        removeHoliday(dateStr);
    };

    const formatHolidayDisplay = (dateStr: string): string => {
        try {
            const date = parse(dateStr, 'yyyy-MM-dd', new Date());
            return format(date, "EEEE d 'de' MMMM yyyy", { locale: es });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-blue-600" size={24} />
                <h2 className="text-xl font-bold">Configuración de Feriados</h2>
            </div>

            <p className="text-sm text-gray-600 mb-4">
                Los feriados configurados aquí serán excluidos del filtro "Hora Punta" y no se programarán paradas automáticas en estos días.
            </p>

            {/* Add Holiday Form */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agregar Feriado
                </label>
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={newHolidayInput}
                        onChange={(e) => {
                            setNewHolidayInput(e.target.value);
                            setError('');
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleAddHoliday}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    >
                        <Plus size={16} />
                        Agregar
                    </button>
                </div>
                {error && (
                    <p className="text-sm text-red-600 mt-2">{error}</p>
                )}
            </div>

            {/* Holidays List */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Feriados Configurados ({holidays.length})
                </h3>

                {holidays.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                        No hay feriados configurados
                    </p>
                ) : (
                    <div className="space-y-2">
                        {holidays.map((dateStr) => (
                            <div
                                key={dateStr}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                            >
                                <div>
                                    <p className="font-medium text-gray-900 capitalize">
                                        {formatHolidayDisplay(dateStr)}
                                    </p>
                                    <p className="text-xs text-gray-500 font-mono">
                                        {dateStr}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleRemoveHoliday(dateStr)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                                    title="Eliminar feriado"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
