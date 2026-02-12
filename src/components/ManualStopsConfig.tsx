import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';
import { Plus, Trash2, Calendar, Clock, Timer, Tag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { ManualStop } from '../types';

export const ManualStopsConfig: React.FC = () => {
    const { manualStops } = useStore((state) => state.processes[state.activeProcessId]);
    const { addManualStop, deleteManualStop } = useStore();

    const [newStop, setNewStop] = useState<{
        date: string;
        time: string;
        duration: number;
        label: string;
    }>({
        date: '',
        time: '08:00',
        duration: 60,
        label: ''
    });

    const handleAdd = () => {
        if (!newStop.date || !newStop.time || newStop.duration <= 0 || !newStop.label.trim()) {
            alert('Por favor complete todos los campos correctamente.');
            return;
        }

        const startDateTime = new Date(`${newStop.date}T${newStop.time}`);

        const stop: ManualStop = {
            id: uuidv4(),
            start: startDateTime,
            durationMinutes: newStop.duration,
            label: newStop.label.trim()
        };

        addManualStop(stop);
        setNewStop({ ...newStop, label: '', duration: 60 });
    };

    const handleDelete = (id: string) => {
        if (confirm('¿Está seguro de eliminar esta parada manual?')) {
            deleteManualStop(id);
        }
    };

    const sortedStops = [...manualStops].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Plus size={16} />
                    Agregar Parada Manual
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Fecha y Hora</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Calendar size={14} className="absolute left-2 top-2.5 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full pl-8 p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newStop.date}
                                    onChange={e => setNewStop({ ...newStop, date: e.target.value })}
                                />
                            </div>
                            <div className="relative w-32">
                                <Clock size={14} className="absolute left-2 top-2.5 text-gray-400" />
                                <input
                                    type="time"
                                    className="w-full pl-8 p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newStop.time}
                                    onChange={e => setNewStop({ ...newStop, time: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Duración (min)</label>
                        <div className="relative">
                            <Timer size={14} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                                type="number"
                                min="1"
                                className="w-full pl-8 p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newStop.duration}
                                onChange={e => setNewStop({ ...newStop, duration: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Motivo</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Tag size={14} className="absolute left-2 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Ej. Mantenimiento Preventivo, Limpieza, etc."
                                    className="w-full pl-8 p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newStop.label}
                                    onChange={e => setNewStop({ ...newStop, label: e.target.value })}
                                />
                            </div>
                            <button
                                onClick={handleAdd}
                                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Paradas Configuradas ({manualStops.length})</h3>

                {sortedStops.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No hay paradas manuales configuradas.</p>
                ) : (
                    <div className="block w-full overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                                    <th className="p-2 font-medium">Fecha</th>
                                    <th className="p-2 font-medium">Hora</th>
                                    <th className="p-2 font-medium">Duración</th>
                                    <th className="p-2 font-medium">Motivo</th>
                                    <th className="p-2 font-medium w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStops.map(stop => (
                                    <tr key={stop.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                        <td className="p-2 text-gray-800">
                                            {format(new Date(stop.start), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="p-2 text-gray-800 font-medium">
                                            {format(new Date(stop.start), 'HH:mm')}
                                        </td>
                                        <td className="p-2 text-gray-600">
                                            {stop.durationMinutes} min
                                        </td>
                                        <td className="p-2 text-gray-800">
                                            {stop.label}
                                        </td>
                                        <td className="p-2 text-right">
                                            <button
                                                onClick={() => handleDelete(stop.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
