
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import { useChangeoverStore } from '../store/useChangeoverStore';
import { useSapStore } from '../store/useSapStore';
import { Play, RotateCcw, Settings2, BarChart3, Clock, Gauge, TrendingDown, CheckCircle2, Trash2, Plus, ArrowDownToLine, LayoutList } from 'lucide-react';
import { SmartExplainer } from './SmartExplainer';

interface DraftItem {
    id: string;
    skuCode: string;
    description: string;
    quantity: number;
    idTablaCambioMedida: string;
    // New Fields for Optimization
    ritmo: number;
    stockInicial: number;
    ventaDiaria: number;
    diasStock: number;
    diasFabricacion: number;
    poMes: number;
}

export const ProductionSequencer: React.FC = () => {
    const activeProcessId = useStore((state) => state.activeProcessId);
    const processData = useStore((state) => state.processes[activeProcessId]);
    const addScheduleItems = useStore((state) => state.addScheduleItems);
    const setSchedule = useStore((state) => state.setSchedule);
    const recalculateSchedule = useStore((state) => state.recalculateSchedule);
    const articles = useArticleStore((state) => state.getArticles(activeProcessId));
    const rules = useChangeoverStore((state) => state.getRules(activeProcessId));
    const saveSequencerConfig = useStore((state) => state.saveSequencerConfig);

    const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<any>(null);
    const workerRef = useRef<Worker | null>(null);

    // Params state
    const [params, setParams] = useState({
        poblacion: 100,
        generaciones: 250,
        pesoVenta: 0.5,
        costoVP: 100,
        costoTC: 5000,
        tasaMutacion: 0.15,
        tasaElitismo: 0.1
    });

    useEffect(() => {
        return () => {
            if (workerRef.current) workerRef.current.terminate();
        };
    }, []);

    const idCambiosUnicos = useMemo(() => {
        return Array.from(new Set(draftItems.map(it => it.idTablaCambioMedida).filter(Boolean))) as string[];
    }, [draftItems]);

    const fetchSapData = useSapStore((state) => state.fetchSapData);
    const sapData = useSapStore((state) => state.sapData);

    useEffect(() => {
        fetchSapData();
    }, []);

    // Load saved config on mount or process change
    useEffect(() => {
        if (processData.sequencerConfig) {
            if (processData.sequencerConfig.draftItems) setDraftItems(processData.sequencerConfig.draftItems);
            if (processData.sequencerConfig.params) setParams(processData.sequencerConfig.params);
            if (processData.sequencerConfig.lastResult) setResult(processData.sequencerConfig.lastResult);
        }
    }, [activeProcessId]);

    // Save config on changes (debounced)
    useEffect(() => {
        const timeout = setTimeout(() => {
            saveSequencerConfig({
                draftItems,
                params,
                lastResult: result
            });
        }, 2000);
        return () => clearTimeout(timeout);
    }, [draftItems, params, result, saveSequencerConfig]);


    // ... (rest of state)

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text');
        if (!text) return;

        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const newDraftItems: DraftItem[] = rows.map((row) => {
            const cols = row.split('\t'); // TSV from Excel
            if (cols.length < 2) return null;

            // Extract SKU (Col 1) and Quantity (Col 3 or 2 depending on structure)
            const rawSku = String(cols[0] || '').trim();
            const rawQty = (cols.length >= 3 ? cols[2] : cols[1]) || '0';

            // Cleanup Quantity: remove thousand separators, handle decimal dots
            const cleanQty = Number(rawQty.replace(/[^\d.-]/g, ''));

            if (!rawSku || isNaN(cleanQty)) return null;

            // Match with master articles
            const art = articles.find(a =>
                String(a.codigoProgramacion || '').trim() === rawSku ||
                String(a.skuLaminacion || '').trim() === rawSku
            );

            // Match with SAP data
            const sapItem = sapData[rawSku] || (art && (sapData[art.codigoProgramacion || ''] || sapData[art.skuLaminacion || '']));

            const pace = art?.ritmoTH || 0;
            const productionTimeDays = pace > 0 ? (cleanQty / pace) / 24 : 0;
            const dailySale = sapItem?.venta_diaria || 0;
            const stock = sapItem?.stock_fin_mes || 0; // Using Projected Month-End Stock for Next Month Planning
            const daysStock = dailySale > 0 ? stock / dailySale : 999;

            return {
                id: crypto.randomUUID(),
                skuCode: rawSku,
                description: art?.descripcion || sapItem?.descripcion || 'SKU No Encontrado',
                quantity: cleanQty,
                idTablaCambioMedida: art?.idTablaCambioMedida || 'S/N',
                ritmo: pace,
                stockInicial: stock,
                ventaDiaria: dailySale,
                diasStock: daysStock,
                diasFabricacion: productionTimeDays,
                poMes: sapItem?.po_mes_actual || 0
            };
        }).filter(Boolean) as DraftItem[];

        if (newDraftItems.length > 0) {
            setDraftItems([...draftItems, ...newDraftItems]);
        }
    };

    const handleRun = () => {
        if (draftItems.length === 0) {
            alert("No hay ítems para optimizar. Importa SKUs primero.");
            return;
        }

        setIsCalculating(true);
        // ... (rest of logic) ...
        const idToIndexMap: Record<string, number> = {};
        idCambiosUnicos.forEach((id, idx) => { idToIndexMap[id] = idx; });

        const matrixSize = idCambiosUnicos.length;
        const matrix: number[][] = Array(matrixSize).fill(0).map(() => Array(matrixSize).fill(0));

        rules.forEach(rule => {
            const fromIdx = idToIndexMap[String(rule.fromId).trim()];
            const toIdx = idToIndexMap[String(rule.toId).trim()];
            if (fromIdx !== undefined && toIdx !== undefined) {
                matrix[fromIdx][toIdx] = rule.durationHours || 0;
            }
        });

        const produccionTn = draftItems.map(it => it.quantity);
        const itemVentaDiaria = draftItems.map(it => it.ventaDiaria);
        const itemDiasStock = draftItems.map(it => it.diasStock);
        const itemDiasFabricacion = draftItems.map(it => it.diasFabricacion);
        const itemIdCambiosIdx = draftItems.map(it => idToIndexMap[it.idTablaCambioMedida]);

        try {
            // ... (worker instantiation) ...
            workerRef.current = new Worker(new URL('../utils/sequencerWorker.ts', import.meta.url), { type: 'module' });

            workerRef.current.onmessage = (e) => {
                const { type, progress, result: workerResult } = e.data;
                if (type === 'progress') setProgress(progress);
                else if (type === 'complete') {
                    setResult(workerResult);
                    setIsCalculating(false);
                    workerRef.current?.terminate();
                }
            };

            workerRef.current.postMessage({
                type: 'run',
                params: {
                    matrizCambioMedida: matrix,
                    ventaDiaria: itemVentaDiaria,
                    diasStock: itemDiasStock,
                    diasFabricacion: itemDiasFabricacion,
                    tamanoLote: produccionTn,
                    produccionTn: produccionTn,
                    skus: draftItems.map(it => it.skuCode),
                    descripciones: draftItems.map(it => it.description),
                    ids: draftItems.map(it => it.id),
                    idCambios: itemIdCambiosIdx,
                    originalIdCambios: draftItems.map(it => it.idTablaCambioMedida),
                    horasDia: 24,
                    pesoVenta: params.pesoVenta,
                    costoToneladaPerdida: params.costoVP,
                    costoHoraCambio: params.costoTC,
                    tamanoPoblacion: params.poblacion,
                    numGeneraciones: params.generaciones,
                    tasaMutacion: params.tasaMutacion,
                    tasaElitismo: params.tasaElitismo
                }
            });
        } catch (e) {
            console.error(e);
            setIsCalculating(false);
        }
    };

    const handleApply = (mode: 'replace' | 'append') => {
        if (!result) return;

        const optimizedItems = result.secuencia.map((item: any, idx: number) => {
            const draftId = result.params_ids[item.sku];
            const draft = draftItems.find(d => d.id === draftId);
            return {
                id: crypto.randomUUID(), // New DB ID
                skuCode: draft?.skuCode || '',
                quantity: draft?.quantity || 0,
                sequenceOrder: idx + (mode === 'append' ? processData.schedule.length : 0),
                stoppages: {}
            };
        });

        if (mode === 'replace') {
            setSchedule(optimizedItems);
        } else {
            addScheduleItems(optimizedItems);
        }

        recalculateSchedule();
        alert(`¡Secuencia ${mode === 'replace' ? 'reemplazada' : 'añadida'} correctamente al Plan Mensual!`);
        setResult(null);
        setDraftItems([]);
    };

    return (
        <div className="flex flex-col gap-6 p-2 h-full overflow-y-auto outline-none" onPaste={handlePaste} tabIndex={0}>
            {/* Control Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                            Optimización de Secuencia
                        </h2>
                        <p className="text-sm text-gray-500">Importa SKUs, optimiza el orden y envíalos al Plan Mensual</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg shadow-sm text-xs font-black animate-pulse uppercase tracking-widest">
                            <LayoutList size={14} /> Pega con Ctrl+V
                        </div>
                        <button onClick={() => { setDraftItems([]); setResult(null); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100 shadow-sm" title="Limpiar todo">
                            <Trash2 size={20} />
                        </button>
                        <div className="h-10 w-px bg-gray-200 mx-1"></div>
                        <button onClick={handleRun} disabled={isCalculating || draftItems.length === 0}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-md ${isCalculating || draftItems.length === 0 ? 'bg-gray-100 text-gray-400' : 'bg-[#004DB4] text-white hover:bg-[#003d91]'}`}>
                            {isCalculating ? <RotateCcw className="animate-spin" size={18} /> : <Play size={18} />}
                            {isCalculating ? 'Calculando...' : 'Optimizar'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Settings2 size={14} /> Configuración Algoritmo</span>
                        <div className="grid grid-cols-2 gap-3">
                            <div><span className="text-[10px] font-bold text-gray-400 uppercase">Población</span><input type="number" value={params.poblacion} onChange={(e) => setParams({ ...params, poblacion: parseInt(e.target.value) })} className="mt-1 block w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm outline-none" /></div>
                            <div><span className="text-[10px] font-bold text-gray-400 uppercase">Generaciones</span><input type="number" value={params.generaciones} onChange={(e) => setParams({ ...params, generaciones: parseInt(e.target.value) })} className="mt-1 block w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm outline-none" /></div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2"><BarChart3 size={14} /> Priorización</span>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-blue-600 uppercase">T. Cambio</span>
                            <span className="text-xs font-black text-gray-700">{(1 - params.pesoVenta).toFixed(1)} / {params.pesoVenta.toFixed(1)}</span>
                            <span className="text-[10px] font-bold text-red-600 uppercase">V. Perdida</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.1" value={params.pesoVenta} onChange={(e) => setParams({ ...params, pesoVenta: parseFloat(e.target.value) })} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                    <div className="border-l border-gray-100 pl-6 flex flex-col justify-center gap-2">
                        <div className="flex items-center gap-3 text-sm">
                            <div className="w-32 text-gray-400 font-bold uppercase text-[10px]">Items Borrador:</div>
                            <div className="font-black text-blue-600">{draftItems.length}</div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <div className="w-32 text-gray-400 font-bold uppercase text-[10px]">Medidas Matriz:</div>
                            <div className="font-black text-green-600">{idCambiosUnicos.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {isCalculating ? (
                <div className="flex-1 bg-white p-12 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center min-h-[400px]">
                    <div className="relative w-40 h-40 flex items-center justify-center mb-8">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100" />
                            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-blue-600 transition-all duration-300" strokeDasharray={Math.PI * 140} strokeDashoffset={Math.PI * 140 * (1 - progress / 100)} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black text-gray-800">{progress}%</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Calculando</span>
                        </div>
                    </div>
                </div>
            ) : result ? (
                <div className="space-y-6 pb-12 animate-in slide-in-from-bottom-4">
                    {/* Innovation Strategy: Smart Explainer */}
                    <SmartExplainer
                        stats={{
                            totalTime: result.tiempoProduccionTotal * 24 + result.tiempoTotalCambio,
                            totalTonnage: result.params_cant.reduce((a: any, b: any) => a + b, 0),
                            changeovers: result.secuencia.length,
                            avgChangeoverTime: result.tiempoTotalCambio / result.secuencia.length * 60
                        }}
                        onClose={() => { }}
                    />

                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 text-blue-50 group-hover:text-blue-100 transition-colors"><Clock size={40} /></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">T. Cambio Muerto</span>
                            <div className="text-2xl font-black text-blue-600">{(result.tiempoTotalCambio).toFixed(1)} h</div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 text-green-50 group-hover:text-green-100 transition-colors"><Gauge size={40} /></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Eficiencia</span>
                            <div className="text-2xl font-black text-green-600">{((result.tiempoProduccionTotal * 24 / (result.tiempoProduccionTotal * 24 + result.tiempoTotalCambio)) * 100).toFixed(1)}%</div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 text-orange-50 group-hover:text-orange-100 transition-colors"><TrendingDown size={40} /></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ahorro Estimado</span>
                            <div className="text-2xl font-black text-orange-600">${(Math.abs(result.costoTotal / 10)).toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-br from-[#004DB4] to-[#003d91] p-5 rounded-xl shadow-lg flex flex-col justify-center items-center text-white gap-3 group relative overflow-hidden">
                            <div className="flex gap-2 w-full relative z-10">
                                <button onClick={() => handleApply('append')} className="flex-1 bg-white/10 hover:bg-white/20 p-2 rounded text-[10px] font-bold uppercase transition-all flex flex-col items-center gap-1">
                                    <Plus size={14} /> Añadir
                                </button>
                                <button onClick={() => handleApply('replace')} className="flex-1 bg-white/20 hover:bg-white/30 p-2 rounded text-[10px] font-bold uppercase transition-all flex flex-col items-center gap-1">
                                    <ArrowDownToLine size={14} /> Reemplazar
                                </button>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest opacity-70">Sincronizar con Plan</span>
                            <Clock className="absolute -bottom-4 -right-4 text-white/10 w-20 h-20 rotate-12" />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Secuencia Optimizada</span>
                            <CheckCircle2 size={16} className="text-green-500" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Orden</th>
                                        <th className="px-6 py-3">SKU</th>
                                        <th className="px-6 py-3">Descripción</th>
                                        <th className="px-6 py-3 text-right">Cant. (Tn)</th>
                                        <th className="px-6 py-3">ID Cambio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.secuencia.map((item: any, idx: number) => {
                                        const originalIdx = item.sku;
                                        return (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-6 py-3 font-bold text-slate-400">{idx + 1}</td>
                                                <td className="px-6 py-3 font-bold text-slate-800 tracking-tight">{result.params_skus[originalIdx]}</td>
                                                <td className="px-6 py-3 text-slate-500 uppercase text-[10px] font-medium">{result.params_desc[originalIdx]}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold text-blue-700">{result.params_cant[originalIdx].toLocaleString()}</td>
                                                <td className="px-6 py-3">
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
                                                        {result.params_idCambios[originalIdx]}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : draftItems.length > 0 ? (
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col animate-in fade-in">
                    <div className="px-6 py-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <LayoutList size={18} className="text-blue-600" />
                            <h3 className="font-bold text-slate-700">Items en Borrador</h3>
                        </div>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase">Listo para Optimizar</span>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">#</th>
                                    <th className="px-6 py-3">SKU</th>
                                    <th className="px-6 py-3">Descripción</th>
                                    <th className="px-6 py-3 text-right">Cant. (Tn)</th>
                                    <th className="px-6 py-3 text-right">Stock (Fin Mes)</th>
                                    <th className="px-6 py-3 text-right">Venta Diaria</th>
                                    <th className="px-6 py-3 text-right">Días Stock</th>
                                    <th className="px-6 py-3 text-right">Días Fab.</th>
                                    <th className="px-6 py-3">ID Cambio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {draftItems.map((it, idx) => (
                                    <tr key={it.id} className="border-b border-slate-50 hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                                        <td className="px-6 py-2.5 font-bold text-slate-700 tracking-tight">{it.skuCode}</td>
                                        <td className="px-6 py-2.5 text-slate-400 text-[10px] uppercase truncate max-w-[200px]" title={it.description}>{it.description}</td>
                                        <td className="px-6 py-2.5 text-right font-mono text-slate-600 font-bold">{it.quantity.toLocaleString()}</td>

                                        <td className="px-6 py-2.5 text-right font-mono text-xs">{it.stockInicial.toFixed(1)}</td>
                                        <td className="px-6 py-2.5 text-right font-mono text-xs">{it.ventaDiaria.toFixed(3)}</td>
                                        <td className={`px-6 py-2.5 text-right font-mono text-xs font-bold ${it.diasStock < 7 ? 'text-red-500' : 'text-green-600'}`}>
                                            {it.diasStock > 365 ? '>365' : it.diasStock.toFixed(1)}
                                        </td>
                                        <td className="px-6 py-2.5 text-right font-mono text-xs">{it.diasFabricacion.toFixed(2)} d</td>

                                        <td className="px-6 py-2.5">
                                            <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-400">{it.idTablaCambioMedida}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex-1 bg-white p-16 rounded-xl shadow-sm border border-gray-100 border-dashed flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
                    <div className="bg-slate-50 p-8 rounded-full mb-6 border border-slate-100 animate-bounce">
                        <LayoutList size={64} className="text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Listo para Pegar</h3>
                    <p className="text-slate-500 max-w-sm text-sm">
                        Copia tus datos de Excel (3 columnas) y presiona <b>Ctrl + V</b> en esta pantalla para cargar la demanda.
                    </p>
                </div>
            )}
        </div>
    );
};
