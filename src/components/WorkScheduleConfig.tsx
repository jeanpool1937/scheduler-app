import React from 'react';
import { useStore } from '../store/useStore';
import { Clock } from 'lucide-react';
import type { WorkSchedule, DaySchedule } from '../types';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Calcula la hora de fin de turno para un día particular.
 */
const getEndTimeLabel = (ds: DaySchedule): string => {
    if (!ds.active || ds.hours <= 0) return '—';
    const totalMinutes = ds.startHour * 60 + ds.startMinute + ds.hours * 60;
    const endHour = Math.floor((totalMinutes % 1440) / 60);
    const endMin = totalMinutes % 60;
    const crossesMidnight = totalMinutes >= 1440;
    const label = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    return crossesMidnight ? `${label} (+1d)` : label;
};

const formatTime = (h: number, m: number): string =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export const WorkScheduleConfig: React.FC = () => {
    const processData = useStore((state) => state.processes[state.activeProcessId]);
    const setWorkSchedule = useStore((state) => state.setWorkSchedule);
    const ws = processData.workSchedule;

    const handleToggle24h = (enabled: boolean) => {
        if (enabled) {
            // 24h continuo
            const days: Record<number, DaySchedule> = {};
            for (let d = 0; d < 7; d++) {
                days[d] = { active: true, hours: 24, startHour: 0, startMinute: 0 };
            }
            setWorkSchedule({ is24h: true, days });
        } else {
            // Esquema personalizado: default 16h 22:00 Dom-Vie
            const days: Record<number, DaySchedule> = {};
            for (let d = 0; d < 7; d++) {
                const isWeekday = d >= 0 && d <= 5; // Dom-Vie
                days[d] = {
                    active: isWeekday,
                    hours: isWeekday ? 16 : 0,
                    startHour: isWeekday ? 22 : 0,
                    startMinute: 0,
                };
            }
            setWorkSchedule({ is24h: false, days });
        }
    };

    const updateDay = (dayIdx: number, patch: Partial<DaySchedule>) => {
        const newDays = { ...ws.days };
        newDays[dayIdx] = { ...newDays[dayIdx], ...patch };
        setWorkSchedule({ ...ws, days: newDays });
    };

    const handleDayActiveToggle = (dayIdx: number) => {
        const current = ws.days[dayIdx];
        if (current.active) {
            // Desactivar día
            updateDay(dayIdx, { active: false, hours: 0 });
        } else {
            // Activar día con valores por defecto razonables
            updateDay(dayIdx, { active: true, hours: 16, startHour: 22, startMinute: 0 });
        }
    };

    const handleHoursChange = (dayIdx: number, hours: number) => {
        const clamped = Math.max(1, Math.min(24, hours));
        updateDay(dayIdx, { hours: clamped });
    };

    const handleStartTimeChange = (dayIdx: number, value: string) => {
        const [h, m] = value.split(':').map(Number);
        updateDay(dayIdx, { startHour: h, startMinute: m || 0 });
    };

    // Verificar si todos los días activos tienen la misma config (para mostrar modo compacto)
    const activeDays = Object.entries(ws.days).filter(([, d]) => d.active);
    const allSameConfig = activeDays.length > 0 && activeDays.every(([, d]) =>
        d.hours === activeDays[0][1].hours &&
        d.startHour === activeDays[0][1].startHour &&
        d.startMinute === activeDays[0][1].startMinute
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
                <Clock className="text-gray-500" />
                <h2 className="text-xl font-bold text-gray-800">Esquema de Trabajo</h2>
            </div>

            {/* Toggle 24h vs Personalizado */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="font-medium text-gray-800">Operación Continua (24h)</p>
                    <p className="text-sm text-gray-500">
                        {ws.is24h ? 'El laminador opera las 24 horas, todos los días' : 'Esquema de trabajo personalizado'}
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={ws.is24h}
                        onChange={(e) => handleToggle24h(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* Panel personalizado con tabla por día */}
            {!ws.is24h && (
                <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {/* Indicador de modo */}
                    {allSameConfig && activeDays.length > 0 && (
                        <div className="bg-blue-50 rounded p-2 border border-blue-200 mb-2">
                            <p className="text-xs text-blue-700">
                                💡 Todos los días activos comparten la misma configuración. Puedes personalizar cada día individualmente abajo.
                            </p>
                        </div>
                    )}

                    {/* Tabla de configuración por día */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-300">
                                    <th className="text-left py-2 px-1 text-gray-600 font-medium">Día</th>
                                    <th className="text-center py-2 px-1 text-gray-600 font-medium">Activo</th>
                                    <th className="text-center py-2 px-1 text-gray-600 font-medium">Horas</th>
                                    <th className="text-center py-2 px-1 text-gray-600 font-medium">Inicio</th>
                                    <th className="text-center py-2 px-1 text-gray-600 font-medium">Fin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DAY_NAMES.map((name, idx) => {
                                    const dayConfig = ws.days[idx];
                                    return (
                                        <tr key={idx} className={`border-b border-gray-100 ${!dayConfig.active ? 'opacity-50' : ''}`}>
                                            <td className="py-2 px-1 font-medium text-gray-800">{name}</td>
                                            <td className="py-2 px-1 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={dayConfig.active}
                                                    onChange={() => handleDayActiveToggle(idx)}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                                                />
                                            </td>
                                            <td className="py-2 px-1 text-center">
                                                {dayConfig.active ? (
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={24}
                                                        value={dayConfig.hours}
                                                        onChange={(e) => handleHoursChange(idx, parseInt(e.target.value) || 16)}
                                                        className="w-14 px-1 py-0.5 border border-gray-300 rounded text-center text-sm"
                                                    />
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-1 text-center">
                                                {dayConfig.active ? (
                                                    <input
                                                        type="time"
                                                        value={formatTime(dayConfig.startHour, dayConfig.startMinute)}
                                                        onChange={(e) => handleStartTimeChange(idx, e.target.value)}
                                                        className="px-1 py-0.5 border border-gray-300 rounded text-sm"
                                                    />
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-1 text-center">
                                                <span className="font-mono text-xs text-gray-600">
                                                    {getEndTimeLabel(dayConfig)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Resumen visual */}
                    <div className="bg-blue-50 rounded p-3 border border-blue-200 mt-2">
                        <p className="text-sm font-medium text-blue-800 mb-1">📋 Resumen:</p>
                        <div className="text-xs text-blue-700 space-y-0.5">
                            {DAY_NAMES.map((name, idx) => {
                                const d = ws.days[idx];
                                if (!d.active) return (
                                    <div key={idx} className="text-gray-400">{name}: No opera</div>
                                );
                                return (
                                    <div key={idx}>
                                        <span className="font-semibold">{name}</span>: {d.hours}h →{' '}
                                        <span className="font-mono">{formatTime(d.startHour, d.startMinute)}</span> a{' '}
                                        <span className="font-mono">{getEndTimeLabel(d)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
