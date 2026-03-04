import React, { useState, useCallback } from 'react';
import {
    Settings,

    BarChart3,
    Play,
    DollarSign,
    FileSpreadsheet,
    Zap,
    TrendingUp,
    Send,
    Check,
    Calendar,
    Loader2,
    ClipboardList,
} from 'lucide-react';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useCostosStore } from '../../store/useCostosStore';
import { useStore } from '../../store/useStore';
import { runPlannerOptimization, getPlannerSampleData } from '../../utils/plannerOptimization';
import type { MachineCost, PeriodCapacity, PlannerExcelData } from '../../types/planner';
import ComparisonDashboard from './ComparisonDashboard';
// ─── Helpers ────────────────────────────────────────────────────────────
const formatMoney = (val: number) =>
    val >= 1000000
        ? `$${(val / 1000000).toFixed(2)} M`
        : val >= 1000
            ? `$${(val / 1000).toFixed(1)} K`
            : `$${val.toFixed(0)} `;

const formatHours = (val: number) => `${val.toFixed(1)} h`;
const formatTons = (val: number) =>
    val >= 1000 ? `${(val / 1000).toFixed(1)}K TN` : `${val.toFixed(0)} TN`;

const MACHINE_COLORS: Record<string, string> = {
    LAM1: '#6366f1',
    LAM2: '#8b5cf6',
    LAM3: '#f59e0b',
};

const MACHINE_BG: Record<string, string> = {
    LAM1: 'bg-indigo-50 border-indigo-200',
    LAM2: 'bg-violet-50 border-violet-200',
    LAM3: 'bg-amber-50 border-amber-200',
};

// ─── Config Panel ───────────────────────────────────────────────────────
const ConfigPanel: React.FC = () => {
    const { machineCosts, setMachineCosts, capacitySchedule, setCapacitySchedule } = usePlannerStore();
    const [localCosts, setLocalCosts] = useState<MachineCost[]>(machineCosts);
    const [localSchedule, setLocalSchedule] = useState<PeriodCapacity[]>(capacitySchedule);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setMachineCosts(localCosts);
        setCapacitySchedule(localSchedule);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const updateCost = (idx: number, field: keyof MachineCost, value: number) => {
        const updated = [...localCosts];
        (updated[idx] as any)[field] = value;
        setLocalCosts(updated);
    };

    const updateCapacity = (periodIdx: number, machineId: string, field: 'total' | 'base', value: number) => {
        const updated = [...localSchedule];
        updated[periodIdx] = {
            ...updated[periodIdx],
            machines: {
                ...updated[periodIdx].machines,
                [machineId]: {
                    ...updated[periodIdx].machines[machineId],
                    [field]: value,
                },
            },
        };
        if (field === 'total') {
            updated[periodIdx].machines[machineId].base = value - updated[periodIdx].peakHours;
        }
        setLocalSchedule(updated);
    };

    const updatePeakHours = (periodIdx: number, value: number) => {
        const updated = [...localSchedule];
        updated[periodIdx] = { ...updated[periodIdx], peakHours: value };
        Object.keys(updated[periodIdx].machines).forEach((mId) => {
            updated[periodIdx].machines[mId].base = updated[periodIdx].machines[mId].total - value;
        });
        setLocalSchedule(updated);
    };

    return (
        <div className="space-y-6">
            {/* Costos de Máquina */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Costos de Máquina</h3>
                        <p className="text-sm text-gray-500">Configuración de costos por equipo</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {localCosts.map((cost, idx) => (
                        <div key={cost.id} className={`rounded - xl border p - 4 ${MACHINE_BG[cost.id] || 'bg-gray-50 border-gray-200'} `}>
                            <div className="flex items-center gap-2 mb-3">
                                <span
                                    className="px-2 py-1 rounded-md text-xs font-bold text-white"
                                    style={{ backgroundColor: MACHINE_COLORS[cost.id] || '#6b7280' }}
                                >
                                    {cost.id}
                                </span>
                                <span className="font-semibold text-gray-800">{cost.id}</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Potencia</label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-gray-400 text-sm">$</span>
                                        <input
                                            type="number"
                                            value={cost.peakPowerCost}
                                            onChange={(e) => updateCost(idx, 'peakPowerCost', Number(e.target.value))}
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-lg font-bold bg-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tasa H. Extra</label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-gray-400 text-sm">$</span>
                                        <input
                                            type="number"
                                            value={cost.overtimeRate}
                                            onChange={(e) => updateCost(idx, 'overtimeRate', Number(e.target.value))}
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-lg font-bold bg-white"
                                        />
                                        <span className="text-gray-400 text-sm">/h</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Calendario de Capacidades */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Calendario de Capacidades 2026</h3>
                            <p className="text-sm text-gray-500">Horas disponibles por periodo y máquina</p>
                        </div>
                    </div>
                    <div className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 font-medium">
                        Fórmula: Base = Total - Hora Punta
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-3 font-medium text-gray-500">Periodo</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-500">H. Punta</th>
                                {localCosts.map((c) => (
                                    <th key={c.id} colSpan={2} className="text-center py-2 px-3 font-medium" style={{ color: MACHINE_COLORS[c.id] }}>
                                        {c.id}
                                    </th>
                                ))}
                            </tr>
                            <tr className="border-b border-gray-100 text-xs text-gray-400">
                                <th></th>
                                <th></th>
                                {localCosts.map((c) => (
                                    <React.Fragment key={c.id}>
                                        <th className="py-1 px-2">Total</th>
                                        <th className="py-1 px-2">Base</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {localSchedule.map((row, pIdx) => (
                                <tr key={row.period} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="py-2 px-3 font-medium text-gray-700">{row.period}</td>
                                    <td className="py-2 px-3">
                                        <input
                                            type="number"
                                            value={row.peakHours}
                                            onChange={(e) => updatePeakHours(pIdx, Number(e.target.value))}
                                            className="w-16 text-center px-1 py-0.5 border border-gray-200 rounded bg-white text-sm"
                                        />
                                    </td>
                                    {localCosts.map((c) => {
                                        const cap = row.machines[c.id] || { total: 0, base: 0 };
                                        return (
                                            <React.Fragment key={c.id}>
                                                <td className="py-2 px-2">
                                                    <input
                                                        type="number"
                                                        value={cap.total}
                                                        onChange={(e) => updateCapacity(pIdx, c.id, 'total', Number(e.target.value))}
                                                        className="w-20 text-center px-1 py-0.5 border border-gray-200 rounded bg-white text-sm"
                                                    />
                                                </td>
                                                <td className="py-2 px-2 text-gray-400 text-center">{cap.base.toFixed(1)}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className={`flex items - center gap - 2 px - 6 py - 3 rounded - xl font - semibold text - white transition - all shadow - lg hover: shadow - xl ${saved ? 'bg-emerald-500' : 'bg-[#004DB4] hover:bg-[#003d94]'
                        } `}
                >
                    {saved ? <Check className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                    {saved ? 'Guardado' : 'Guardar Todo'}
                </button>
            </div>
        </div>
    );
};

// ─── Data Upload Panel ──────────────────────────────────────────────────
const DataPanel: React.FC = () => {
    const { setExcelData, excelData, pasteText, setPasteText, saveState } = usePlannerStore();

    const handlePasteData = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const text = e.target.value;
            setPasteText(text);

            if (!text.trim()) {
                setExcelData(null, '');
                return;
            }

            try {
                // Parse TSV (Tab-Separated Values)
                const rows = text.split(/\r?\n/).filter((row) => row.trim() !== '');
                if (rows.length < 2) {
                    return; // Wait for more data
                }

                const headers = rows[0].split('\t').map((h) => h.trim());
                if (headers.length < 2) {
                    return; // It doesn't look like TSV
                }

                const parsedData: any[] = [];

                for (let i = 1; i < rows.length; i++) {
                    const cols = rows[i].split('\t');
                    if (cols.length === 1 && cols[0].trim() === '') continue;

                    const rowObj: any = {};
                    for (let j = 0; j < headers.length; j++) {
                        rowObj[headers[j]] = cols[j] ? cols[j].trim() : '';
                    }
                    parsedData.push(rowObj);
                }

                if (parsedData.length > 0) {
                    const parsed: PlannerExcelData = {
                        Demanda: parsedData,
                        Periodos: parsedData,
                    };
                    setExcelData(parsed, 'datos_pegados.tsv');
                    setTimeout(() => saveState(), 100);
                }
            } catch (error) {
                console.error('Error parsing pasted data:', error);
            }
        },
        [setExcelData, saveState, setPasteText]
    );

    const handleLoadSample = () => {
        const sample = getPlannerSampleData();
        setExcelData(sample, 'datos_muestra.tsv');
        setPasteText('DATOS_DE_MUESTRA_CARGADOS');
        setTimeout(() => saveState(), 100);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Carga de Datos</h3>
                        <p className="text-sm text-gray-500">Pega directamente la tabla de Excel (Ctrl+C / Ctrl+V). Costos y Tiempos de las máquinas se asumen desde el Maestro BD.</p>
                    </div>
                </div>

                <div className="relative">
                    <textarea
                        value={pasteText}
                        onChange={handlePasteData}
                        placeholder="Pega los datos de la demanda y periodos aquí copiados desde Excel..."
                        className="w-full h-48 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl focus:border-violet-500 focus:ring-2 outline-none resize-y font-mono text-sm text-gray-700 placeholder-gray-400 whitespace-pre"
                        spellCheck={false}
                    />
                </div>

                {excelData && pasteText && (
                    <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm text-emerald-700 font-medium">
                            {excelData.Periodos.length} registros detectados y procesados correctamente.
                        </span>
                    </div>
                )}

                <div className="mt-6 flex items-center gap-3">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <span className="text-xs text-gray-400 uppercase font-medium">o usa datos de ejemplo</span>
                    <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <div className="mt-4 text-center">
                    <button
                        onClick={handleLoadSample}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors font-medium border border-violet-200"
                    >
                        <Zap className="w-4 h-4" />
                        Cargar Datos de Muestra
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Results Panel ──────────────────────────────────────────────────────
const ResultsPanel: React.FC = () => {
    const { resultA, resultB, resultC, selectedMonth, setSelectedMonth } = usePlannerStore();
    const setActiveTab = useStore((s) => s.setActiveTab);
    const [sentMonths, setSentMonths] = useState<Record<string, boolean>>({});

    if (!resultA) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <BarChart3 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Ejecuta la optimización para ver los resultados aquí</p>
            </div>
        );
    }

    const activeResult = resultA; // Primary scenario
    const months = activeResult.monthlyResults.map((m) => m.period);

    const filteredMonth = selectedMonth
        ? activeResult.monthlyResults.find((m) => m.period === selectedMonth)
        : null;

    const handleSendToSequencer = async (month: string) => {
        if (!filteredMonth) return;

        // Group allocations by machine
        const byMachine: Record<string, { skuCode: string; quantity: number }[]> = {};
        filteredMonth.allocations.forEach((a) => {
            if (!byMachine[a.machineId]) byMachine[a.machineId] = [];
            byMachine[a.machineId].push({
                skuCode: a.skuId,
                quantity: a.quantity,
            });
        });

        // Map LAM1/LAM2/LAM3 to processIds
        const machineToProcess: Record<string, 'laminador1' | 'laminador2' | 'laminador3'> = {
            LAM1: 'laminador1',
            LAM2: 'laminador2',
            LAM3: 'laminador3',
        };

        const importFn = useStore.getState().importPlannerToSequencer;

        for (const [machineId, items] of Object.entries(byMachine)) {
            const processId = machineToProcess[machineId];
            if (!processId) continue;

            const draftItems = items.map((item) => ({
                id: crypto.randomUUID(),
                skuCode: item.skuCode,
                quantity: item.quantity,
            }));

            await importFn(processId, draftItems);
        }

        setSentMonths((prev) => ({ ...prev, [month]: true }));
        setTimeout(() => {
            setActiveTab('sequencer');
        }, 1500);
    };

    return (
        <div className="space-y-6">
            <ComparisonDashboard
                resultA={resultA}
                resultB={resultB}
                resultC={resultC}
                nameA="Óptimo (Económico)"
                nameB="Máx Capacidad"
                nameC="Tradicional"
            />
            {/* Month Selector + Transfer */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Send className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Enviar al Secuenciador</h3>
                            <p className="text-sm text-gray-500">Selecciona un mes para transferir la asignación</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    {months.map((m) => (
                        <button
                            key={m}
                            onClick={() => setSelectedMonth(m)}
                            className={`px - 4 py - 2 rounded - lg text - sm font - medium transition - all ${selectedMonth === m
                                    ? 'bg-[#004DB4] text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                } `}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                {filteredMonth && (
                    <div className="space-y-4">
                        {/* Monthly allocation table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 px-3 font-medium text-gray-500">SKU</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-500">Descripción</th>
                                        <th className="text-center py-2 px-3 font-medium text-gray-500">Laminador</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-500">Cantidad</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-500">Horas</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-500">Costo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMonth.allocations.map((a, i) => (
                                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                                            <td className="py-2 px-3 font-mono text-xs">{a.skuId}</td>
                                            <td className="py-2 px-3 text-gray-700">{a.skuDesc || '—'}</td>
                                            <td className="py-2 px-3 text-center">
                                                <span
                                                    className="px-2 py-0.5 rounded text-xs font-bold text-white"
                                                    style={{ backgroundColor: MACHINE_COLORS[a.machineId] || '#6b7280' }}
                                                >
                                                    {a.machineId}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-semibold">{formatTons(a.quantity)}</td>
                                            <td className="py-2 px-3 text-right text-gray-500">{formatHours(a.timeUsed)}</td>
                                            <td className="py-2 px-3 text-right text-gray-500">{formatMoney(a.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Send button */}
                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button
                                onClick={() => handleSendToSequencer(selectedMonth!)}
                                disabled={!!sentMonths[selectedMonth!]}
                                className={`flex items - center gap - 2 px - 6 py - 3 rounded - xl font - semibold text - white transition - all shadow - lg hover: shadow - xl ${sentMonths[selectedMonth!]
                                        ? 'bg-emerald-500 cursor-default'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                    } `}
                            >
                                {sentMonths[selectedMonth!] ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Enviado al Secuenciador
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Enviar {selectedMonth} al Secuenciador
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

// ─── Main Layout ────────────────────────────────────────────────────────
export const PlannerLayout: React.FC = () => {
    const {
        activeView,
        setActiveView,
        excelData,
        isOptimizing,
        setIsOptimizing,
        setResults,
        machineCosts,
        capacitySchedule,
        fetchSavedState,
        saveState
    } = usePlannerStore();
    const { costos } = useCostosStore();

    // Cargar estado desde Supabase al montar el componente
    React.useEffect(() => {
        fetchSavedState();
    }, [fetchSavedState]);

    const views = [
        { id: 'config' as const, label: 'Maestro Capacidad', icon: Settings },
        { id: 'data' as const, label: 'Carga de Datos', icon: FileSpreadsheet },
        { id: 'results' as const, label: 'Resultados', icon: TrendingUp },
    ];

    const handleOptimize = async () => {
        if (!excelData) {
            alert('Primero carga los datos en la pestaña "Carga de Datos".');
            return;
        }
        setIsOptimizing(true);

        // Agregamos un peque\u00f1o retraso para que UI se actualice a "Optimizando..."
        setTimeout(() => {
            try {
                console.log('Iniciando optimizaci\u00f3n LP...', { machineCosts, capacitySchedule });
                const { resultA, resultB, resultC } = runPlannerOptimization(
                    excelData!,
                    costos,
                    machineCosts,
                    capacitySchedule
                );
                console.log('Optimizaci\u00f3n terminada', { resultA });
                setResults(resultA, resultB, resultC);
                // Auto-guardado de resultados LP en BD
                setTimeout(() => {
                    saveState();
                }, 500);
            } catch (err: any) {
                console.error('Optimization error:', err);
                alert(`Error en la optimizaci\u00f3n: ${err.message} `);
            } finally {
                setIsOptimizing(false);
            }
        }, 100);
    };

    return (
        <div className="space-y-6">
            {/* Tab Selector + Optimize Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                    {views.map((v) => (
                        <button
                            key={v.id}
                            onClick={() => setActiveView(v.id)}
                            className={`flex items - center gap - 2 px - 4 py - 2.5 rounded - lg text - sm font - medium transition - all ${activeView === v.id
                                    ? 'bg-[#004DB4] text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                } `}
                        >
                            <v.icon className="w-4 h-4" />
                            {v.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleOptimize}
                    disabled={isOptimizing || !excelData}
                    className={`flex items - center gap - 2 px - 6 py - 3 rounded - xl font - semibold text - white shadow - lg hover: shadow - xl transition - all ${isOptimizing
                            ? 'bg-gray-400 cursor-wait'
                            : excelData
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                                : 'bg-gray-300 cursor-not-allowed'
                        } `}
                >
                    {isOptimizing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Optimizando...
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5" />
                            Optimizar
                        </>
                    )}
                </button>
            </div>

            {/* Content */}
            {activeView === 'config' && <ConfigPanel />}
            {activeView === 'data' && <DataPanel />}
            {activeView === 'results' && <ResultsPanel />}
        </div>
    );
};
