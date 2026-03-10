import React from 'react';
import { useStore } from '../store/useStore';
import { Clock, Loader, Layers, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import type { AutoStoppageRule, ProcessAutoStoppages } from '../types';

export const AutoStoppageConfig: React.FC = () => {
    const activeProcessId = useStore((state) => state.activeProcessId);
    const processData = useStore((state) => state.processes[activeProcessId]);
    const updateAutoStoppageRule = useStore((state) => state.updateAutoStoppageRule);

    if (!processData?.autoStoppageRules) {
        return (
            <div className="flex items-center justify-center p-6 text-zinc-500 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                <Loader className="w-5 h-5 animate-spin mr-2" />
                <span>Cargando configuración de paradas automáticas...</span>
            </div>
        );
    }

    const rules = processData.autoStoppageRules;

    const RuleEditor = ({
        type,
        rule,
        icon,
        title,
        description
    }: {
        type: keyof ProcessAutoStoppages;
        rule: AutoStoppageRule;
        icon: React.ReactNode;
        title: string;
        description: string;
    }) => {
        const handleUpdate = (updates: Partial<AutoStoppageRule>) => {
            updateAutoStoppageRule(type, updates);
        };

        const timeString = `${rule.hour.toString().padStart(2, '0')}:${rule.minute.toString().padStart(2, '0')}`;

        return (
            <div className={`p-4 rounded-xl border transition-colors ${rule.enabled ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-3 items-center">
                        <div className={`p-2 rounded-lg ${rule.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                            {icon}
                        </div>
                        <div>
                            <h3 className={`font-semibold ${rule.enabled ? 'text-indigo-900' : 'text-gray-600'}`}>{title}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleUpdate({ enabled: !rule.enabled })}
                        className={`text-2xl transition-colors ${rule.enabled ? 'text-indigo-600' : 'text-gray-400'}`}
                        title={rule.enabled ? 'Desactivar regla' : 'Activar regla'}
                    >
                        {rule.enabled ? <ToggleRight /> : <ToggleLeft />}
                    </button>
                </div>

                {rule.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-indigo-100/50">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Hora de Ejecución</label>
                            <input
                                type="time"
                                value={timeString}
                                onChange={(e) => {
                                    const [h, m] = e.target.value.split(':').map(Number);
                                    if (!isNaN(h) && !isNaN(m)) {
                                        handleUpdate({ hour: h, minute: m });
                                    }
                                }}
                                className="w-full text-sm rounded bg-white border border-gray-300 px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Duración (minutos)</label>
                            <input
                                type="number"
                                min="0"
                                value={rule.durationMinutes}
                                onChange={(e) => handleUpdate({ durationMinutes: Number(e.target.value) })}
                                className="w-full text-sm rounded bg-white border border-gray-300 px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="sm:col-span-2 bg-blue-50/50 rounded p-3 border border-blue-100 mt-2">
                            <div className="flex items-start gap-2 text-xs text-blue-800">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium mb-1">Condición de Ejecución</p>
                                    <p>Se ejecutará si no ha habido al menos
                                        <input
                                            type="number"
                                            value={rule.minStoppageTrigger}
                                            onChange={(e) => handleUpdate({ minStoppageTrigger: Number(e.target.value) })}
                                            className="w-12 mx-1 text-center rounded border border-blue-200 bg-white py-0.5 px-1"
                                        />
                                        minutos de parada en las
                                        <input
                                            type="number"
                                            value={rule.windowHours}
                                            onChange={(e) => handleUpdate({ windowHours: Number(e.target.value) })}
                                            className="w-12 mx-1 text-center rounded border border-blue-200 bg-white py-0.5 px-1"
                                        />
                                        horas previas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-500" />
                Paradas Programadas (Diarias)
            </h2>

            <p className="text-sm text-gray-600 mb-6">
                Configura los eventos fijos que ocurren todos los días productivos en este laminador.
                El programador validará si deben insertarse según las reglas de cobertura.
            </p>

            <div className="space-y-4">
                <RuleEditor
                    type="ringChange"
                    rule={rules.ringChange}
                    icon={<Layers className="w-5 h-5" />}
                    title="Cambio de Anillo"
                    description="Parada típica para recambio de anillos de laminación."
                />

                <RuleEditor
                    type="channelChange"
                    rule={rules.channelChange}
                    icon={<Layers className="w-5 h-5" />}
                    title="Cambio de Canal"
                    description="Preparación de los canales en horarios de menor actividad."
                />
            </div>
        </div>
    );
};
