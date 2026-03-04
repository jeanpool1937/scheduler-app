
import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { PlannerOptimizationResult } from '../../types/planner';
import { AlertTriangle, DollarSign, Scale, CheckCircle2, ArrowDown, ArrowUp, Minus, Table2, ArrowRightLeft, Factory, Zap, Clock, Filter, FileSpreadsheet, Calendar, TrendingUp } from 'lucide-react';

interface ComparisonProps {
  resultA?: PlannerOptimizationResult | null;
  resultB?: PlannerOptimizationResult | null;
  resultC?: PlannerOptimizationResult | null;
  nameA?: string;
  nameB?: string;
  nameC?: string;
}

const ComparisonDashboard: React.FC<ComparisonProps> = ({
  resultA,
  resultB,
  resultC,
  nameA = "Escenario Óptimo",
  nameB = "Trabajando en HP",
  nameC = "Sin HP"
}) => {

  // Filter valid results to iterate easily
  const activeScenarios = [
    { id: 'A', name: nameA, data: resultA, color: '#94a3b8' }, // Slate (Base)
    { id: 'B', name: nameB, data: resultB, color: '#3b82f6' }, // Blue
    { id: 'C', name: nameC, data: resultC, color: '#10b981' }  // Emerald
  ].filter((s: any) => s.data);

  // State for Comparison Selectors
  const [baseId, setBaseId] = useState<string>(activeScenarios[0]?.id || 'A');
  const [targetId, setTargetId] = useState<string>(activeScenarios[1]?.id || 'B');

  // State for Period Filter
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  // Extract all available periods from data
  const availablePeriods = useMemo(() => {
    const periodsSet = new Set<string>();
    activeScenarios.forEach((s: any) => {
      if (s.data?.monthlyResults) {
        s.data.monthlyResults.forEach((mr: any) => periodsSet.add(mr.period));
      }
    });
    return Array.from(periodsSet).sort();
  }, [resultA, resultB, resultC]);

  // Helper for number formatting
  const formatMoney = (val: number) => val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const formatTons = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const formatHours = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const formatCostPerTon = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (activeScenarios.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white rounded-2xl border border-dashed border-slate-300">
        <div className="p-4 bg-slate-100 text-slate-400 rounded-full mb-4">
          <Scale size={48} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Comparativa no disponible</h3>
        <p className="text-slate-500 max-w-md">
          Se requieren al menos 2 escenarios cargados para realizar una comparación. Por favor carga datos en las pestañas individuales primero.
        </p>
      </div>
    );
  }

  // --- Metrics Calculation ---
  const metrics = activeScenarios.map((s: any) => {
    const r = s.data!;

    // Filter data based on selected period
    let filteredAllocations = r.allocations;
    let filteredCost = r.totalCost;
    let filteredBreakdown = r.breakdown || { productionCost: 0, overtimeCost: 0, peakPowerCost: 0 };
    let filteredUnmetDemand = r.unmetDemand;
    let filteredMachineUsage = r.machineUsage;
    let filteredBaseCapacity = r.baseCapacity;

    if (selectedPeriod !== 'all' && r.monthlyResults) {
      const monthlyData = r.monthlyResults.find((mr: any) => mr.period === selectedPeriod);
      if (monthlyData) {
        filteredAllocations = monthlyData.allocations;
        filteredCost = monthlyData.totalCost;
        filteredBreakdown = monthlyData.breakdown || { productionCost: 0, overtimeCost: 0, peakPowerCost: 0 };
        filteredUnmetDemand = monthlyData.unmetDemand;
        filteredMachineUsage = monthlyData.machineUsage;
        filteredBaseCapacity = monthlyData.capacities ?
          Object.fromEntries(Object.entries(monthlyData.capacities).map(([k, v]: [string, any]) => [k, v.base])) :
          r.baseCapacity;
      } else {
        // If no data for selected period, show zeros
        filteredAllocations = [];
        filteredCost = 0;
        filteredBreakdown = { productionCost: 0, overtimeCost: 0, peakPowerCost: 0 };
        filteredUnmetDemand = [];
        filteredMachineUsage = {};
        filteredBaseCapacity = r.baseCapacity;
      }
    }

    const totalTons = filteredAllocations.reduce((sum: any, i: any) => sum + i.quantity, 0);
    const costPerTon = totalTons > 0 ? filteredCost / totalTons : 0;

    return {
      id: s.id,
      name: s.name,
      totalCost: filteredCost,
      breakdown: filteredBreakdown,
      totalTons: totalTons,
      unmetTons: filteredUnmetDemand.reduce((sum: any, i: any) => sum + i.amount, 0),
      costPerTon: costPerTon,
      machineTons: {
        LAM1: filteredAllocations.filter((a: any) => a.machineId === 'LAM1').reduce((sum: any, i: any) => sum + i.quantity, 0),
        LAM2: filteredAllocations.filter((a: any) => a.machineId === 'LAM2').reduce((sum: any, i: any) => sum + i.quantity, 0),
        LAM3: filteredAllocations.filter((a: any) => a.machineId === 'LAM3').reduce((sum: any, i: any) => sum + i.quantity, 0),
      },
      machineCosts: {
        LAM1: filteredAllocations.filter((a: any) => a.machineId === 'LAM1').reduce((sum: any, i: any) => sum + i.cost, 0),
        LAM2: filteredAllocations.filter((a: any) => a.machineId === 'LAM2').reduce((sum: any, i: any) => sum + i.cost, 0),
        LAM3: filteredAllocations.filter((a: any) => a.machineId === 'LAM3').reduce((sum: any, i: any) => sum + i.cost, 0),
      },
      machineUsage: filteredMachineUsage,
      baseCapacity: filteredBaseCapacity,
      color: s.color
    };
  });

  const baseline = metrics.find((m: any) => m.id === 'A');
  const minCost = Math.min(...metrics.map((m: any) => m.totalCost));
  const maxTons = Math.max(...metrics.map((m: any) => m.totalTons));
  const minUnmet = Math.min(...metrics.map((m: any) => m.unmetTons));
  const minCostPerTon = Math.min(...metrics.filter((m: any) => m.costPerTon > 0).map((m: any) => m.costPerTon));

  // --- Helper to Render Differential vs A ---
  const renderDiff = (currentValue: number, type: 'cost' | 'tons' | 'unmet' | 'costPerTon', scenarioId: string) => {
    if (scenarioId === 'A' || !baseline) return null;

    let baseValue = 0;
    if (type === 'cost') baseValue = baseline.totalCost;
    if (type === 'tons') baseValue = baseline.totalTons;
    if (type === 'unmet') baseValue = baseline.unmetTons;
    if (type === 'costPerTon') baseValue = baseline.costPerTon;

    if (baseValue === 0 && currentValue === 0) return <span className="text-[10px] text-slate-400 mt-1 block">- Igual a Base -</span>;
    if (currentValue === baseValue) return <span className="text-[10px] text-slate-400 mt-1 block flex items-center justify-center gap-1"><Minus size={10} /> vs A</span>;

    const diff = currentValue - baseValue;
    const percent = baseValue !== 0 ? (diff / baseValue) * 100 : 100;
    const absDiff = Math.abs(diff);
    const absPercent = Math.abs(percent);

    let colorClass = 'text-slate-500';
    let bgColorClass = 'bg-slate-50';
    let Icon = Minus;

    if (type === 'cost' || type === 'costPerTon') {
      if (diff < 0) { colorClass = 'text-emerald-600'; bgColorClass = 'bg-emerald-50'; Icon = ArrowDown; }
      else { colorClass = 'text-red-600'; bgColorClass = 'bg-red-50'; Icon = ArrowUp; }
    } else if (type === 'unmet') {
      if (diff < 0) { colorClass = 'text-emerald-600'; bgColorClass = 'bg-emerald-50'; Icon = ArrowDown; }
      else { colorClass = 'text-red-600'; bgColorClass = 'bg-red-50'; Icon = ArrowUp; }
    } else {
      if (diff > 0) { colorClass = 'text-blue-600'; bgColorClass = 'bg-blue-50'; Icon = ArrowUp; }
      else { colorClass = 'text-orange-600'; bgColorClass = 'bg-orange-50'; Icon = ArrowDown; }
    }

    const valFormatted = (type === 'cost' || type === 'costPerTon') ? formatMoney(absDiff) : formatTons(absDiff);

    return (
      <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${bgColorClass} ${colorClass}`}>
        <Icon size={12} className="mr-1" />
        <span>{(type === 'cost' || type === 'costPerTon') ? '$' : ''}{valFormatted}</span>
        <span className="ml-1 opacity-80">({absPercent.toFixed(1)}%)</span>
      </div>
    );
  };

  // --- 1. Chart Data Preparation ---
  const allMachineIds = new Set<string>();
  activeScenarios.forEach((s: any) => {
    Object.keys(s.data!.totalCapacity).forEach((id: any) => allMachineIds.add(id));
  });
  const machineIds = Array.from(allMachineIds).sort();

  const costChartData = machineIds.map((m: any) => {
    const row: Record<string, any> = { name: m };
    activeScenarios.forEach((s: any) => {
      const cost = s.data!.allocations
        .filter((a: any) => a.machineId === m)
        .reduce((sum: any, a: any) => sum + a.cost, 0);
      row[s.name] = cost;
    });
    return row;
  });

  const tonsChartData = machineIds.map((m: any) => {
    const row: Record<string, any> = { name: m };
    activeScenarios.forEach((s: any) => {
      const qty = s.data!.allocations
        .filter((a: any) => a.machineId === m)
        .reduce((sum: any, a: any) => sum + a.quantity, 0);
      row[s.name] = qty;
    });
    return row;
  });

  const specificMachines = ['LAM1', 'LAM2', 'LAM3'];

  // --- Logic for Detailed Pivot Table ---

  // 1. Identify SKUs that have differences
  const affectedSkuIds = useMemo(() => {
    const baseS = activeScenarios.find((s: any) => s.id === baseId);
    const targetS = activeScenarios.find((s: any) => s.id === targetId);
    if (!baseS || !targetS || baseId === targetId) return new Set<string>();

    const diffs = new Set<string>();

    // Create map of A: Key=Period+SKU -> Value=Machine
    const mapA = new Map<string, string>();
    baseS.data!.allocations.forEach((a: any) => mapA.set(`${a.period}::${a.skuId}`, a.machineId));

    // Check B against A
    targetS.data!.allocations.forEach((b: any) => {
      const key = `${b.period}::${b.skuId}`;
      const machA = mapA.get(key);
      if (machA && machA !== b.machineId) {
        diffs.add(b.skuId);
      } else if (!machA) {
        // In B but not A (rare in this model unless demand changed, but possible if unmet in A vs met in B)
        diffs.add(b.skuId);
      }
    });

    // Check for things in A but not B (e.g. became unmet in B)
    const mapB = new Map<string, string>();
    targetS.data!.allocations.forEach((b: any) => mapB.set(`${b.period}::${b.skuId}`, b.machineId));
    baseS.data!.allocations.forEach((a: any) => {
      const key = `${a.period}::${a.skuId}`;
      if (!mapB.has(key)) diffs.add(a.skuId);
    });

    return diffs;
  }, [baseId, targetId, resultA, resultB, resultC]);

  // 2. Helper to transform data for the table
  const getScenarioPivotData = (scenarioData: PlannerOptimizationResult) => {
    // Collect all periods sorted
    const periods = Array.from(new Set(scenarioData.allocations.map((a: any) => a.period))).sort();

    // Filter allocations for affected SKUs
    const relevantAllocations = scenarioData.allocations.filter((a: any) => affectedSkuIds.has(a.skuId));

    // Structure: SKU -> { desc, machines: { MachineID: { Period: Qty } }, totalRow: { Period: Qty } }
    const pivot: Record<string, any> = {};

    relevantAllocations.forEach((a: any) => {
      if (!pivot[a.skuId]) {
        pivot[a.skuId] = {
          desc: a.skuDesc,
          machines: {},
          totalRow: {}
        };
      }

      // Init machine row if needed
      if (!pivot[a.skuId].machines[a.machineId]) {
        pivot[a.skuId].machines[a.machineId] = {};
      }

      // Add qty to machine/period cell
      const currentVal = pivot[a.skuId].machines[a.machineId][a.period] || 0;
      pivot[a.skuId].machines[a.machineId][a.period] = currentVal + a.quantity;

      // Add to SKU total row
      const currentTotal = pivot[a.skuId].totalRow[a.period] || 0;
      pivot[a.skuId].totalRow[a.period] = currentTotal + a.quantity;
    });

    return { periods, pivot };
  };

  const renderScenarioTable = (scenarioId: string, title: string, colorClass: string) => {
    const scenario = activeScenarios.find((s: any) => s.id === scenarioId);
    if (!scenario || affectedSkuIds.size === 0) return null;

    const { periods, pivot } = getScenarioPivotData(scenario.data!);
    const skuIds = Object.keys(pivot).sort(); // Could sort by total volume if needed

    if (skuIds.length === 0) return (
      <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-lg">
        Sin cambios en asignación de máquinas.
      </div>
    );

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
        <div className={`px-4 py-3 border-b border-slate-200 ${colorClass} bg-opacity-10 flex justify-between items-center`}>
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet size={16} /> {title}
          </h4>
          <span className="text-xs font-semibold text-slate-500 uppercase bg-white/50 px-2 py-0.5 rounded">
            {skuIds.length} SKUs con cambios
          </span>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/50 text-slate-500 border-b border-slate-200">
                <th className="p-2 text-left font-bold min-w-[200px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Etiquetas de fila
                </th>
                {periods.map((p: any) => (
                  <th key={p} className="p-2 font-semibold min-w-[60px] whitespace-nowrap">{p}</th>
                ))}
                <th className="p-2 font-bold bg-slate-100 text-slate-700 min-w-[80px]">Total general</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skuIds.map((skuId: any) => {
                const data = pivot[skuId];
                const machines = Object.keys(data.machines).sort();
                const skuTotalAllPeriods = periods.reduce((sum: any, p: any) => sum + (data.totalRow[p] || 0), 0);

                return (
                  <React.Fragment key={skuId}>
                    {/* SKU Summary Row */}
                    <tr className="bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors font-bold text-slate-800">
                      <td className="p-2 text-left sticky left-0 bg-indigo-50/30 z-10 border-r border-indigo-100 flex flex-col justify-center">
                        <span>{skuId}</span>
                        <span className="text-[10px] font-normal text-slate-500 truncate max-w-[180px]" title={data.desc}>
                          {data.desc}
                        </span>
                      </td>
                      {periods.map((p: any) => (
                        <td key={p} className="p-2">{data.totalRow[p] ? formatTons(data.totalRow[p]) : ''}</td>
                      ))}
                      <td className="p-2 bg-indigo-100/30 text-slate-900">{formatTons(skuTotalAllPeriods)}</td>
                    </tr>

                    {/* Machine Detail Rows */}
                    {machines.map((mId: any) => {
                      const mData = data.machines[mId];
                      const mTotal = periods.reduce((sum: any, p: any) => sum + (mData[p] || 0), 0);

                      return (
                        <tr key={`${skuId}-${mId}`} className="text-slate-600 hover:bg-slate-50">
                          <td className="p-2 text-left pl-6 sticky left-0 bg-white z-10 border-r border-slate-100 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            {mId}
                          </td>
                          {periods.map((p: any) => (
                            <td key={p} className="p-2 font-mono text-slate-500">
                              {mData[p] ? formatTons(mData[p]) : ''}
                            </td>
                          ))}
                          <td className="p-2 font-medium bg-slate-50/50">{formatTons(mTotal)}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Grand Total Row for Table */}
              <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-300">
                <td className="p-3 text-left sticky left-0 bg-slate-800 z-10">Total general</td>
                {periods.map((p: any) => {
                  const colTotal = skuIds.reduce((sum: any, sku: any) => sum + (pivot[sku].totalRow[p] || 0), 0);
                  return <td key={p} className="p-3">{formatTons(colTotal)}</td>
                })}
                <td className="p-3 bg-slate-900">
                  {formatTons(skuIds.reduce((sum: any, sku: any) => {
                    return sum + periods.reduce((s: any, p: any) => s + (pivot[sku].totalRow[p] || 0), 0)
                  }, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-8 animate-fade-in pb-12">

      {/* 1. Scenario Summary Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Scale size={20} className="text-indigo-600" />
                Resumen Comparativo Global
              </h3>
              <p className="text-sm text-slate-500 mt-1">Comparación directa de indicadores clave. Diferenciales calculados respecto al <strong>Escenario Óptimo (Base)</strong>.</p>
            </div>

            {/* Period Selector */}
            {availablePeriods.length > 0 && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <Calendar size={16} className="text-indigo-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Período:</span>
                <div className="relative">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="appearance-none bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold rounded-md py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="all">📅 Todo el Año</option>
                    {availablePeriods.map((p: any) => (
                      <option key={p} value={p}>
                        {new Date(p + '-01T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, (c: any) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  <ArrowDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-1/4">Indicador</th>
                {metrics.map((m: any) => (
                  <th key={m.id} className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-1/4" style={{ color: m.color === '#94a3b8' ? '#64748b' : m.color }}>
                    {m.name} {m.id === 'A' && <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] ml-1">BASE</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Total Cost Row */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-4 flex items-center gap-3 font-medium text-slate-700 bg-slate-50/30">
                  <div className="p-2 bg-green-100 text-green-700 rounded-lg"><DollarSign size={18} /></div>
                  <div>
                    <span className="block text-sm font-bold">Costo Total</span>
                    <span className="text-xs text-slate-400">Objetivo: Minimizar</span>
                  </div>
                </td>
                {metrics.map((m: any) => (
                  <td key={m.id} className="p-4 text-center align-top bg-slate-50/30">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`text-lg font-bold ${m.totalCost === minCost ? 'text-green-600' : 'text-slate-700'}`}>
                        ${formatMoney(m.totalCost)}
                      </span>
                      {renderDiff(m.totalCost, 'cost', m.id)}

                      {m.totalCost === minCost && (
                        <span className="mt-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} /> Mejor Opción
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Detail Rows: Costs */}
              <tr className="text-sm">
                <td className="p-3 pl-14 text-slate-600 flex items-center gap-2">
                  <Factory size={14} className="text-slate-400" /> Costo Fabricación
                </td>
                {metrics.map((m: any) => (
                  <td key={m.id} className="p-3 text-center text-slate-600 font-mono">
                    ${formatMoney(m.breakdown.productionCost)}
                  </td>
                ))}
              </tr>
              <tr className="text-sm">
                <td className="p-3 pl-14 text-slate-600 flex items-center gap-2">
                  <Clock size={14} className="text-orange-400" /> Costo Horas Extra
                </td>
                {metrics.map((m: any) => (
                  <td key={m.id} className="p-3 text-center text-slate-600 font-mono">
                    ${formatMoney(m.breakdown.overtimeCost)}
                  </td>
                ))}
              </tr>
              <tr className="text-sm">
                <td className="p-3 pl-14 text-slate-600 flex items-center gap-2">
                  <Zap size={14} className="text-red-400" /> Costo Energía (Potencia)
                </td>
                {metrics.map((m: any) => (
                  <td key={m.id} className="p-3 text-center text-slate-600 font-mono">
                    ${formatMoney(m.breakdown.peakPowerCost)}
                  </td>
                ))}
              </tr>

              {/* Cost Per Ton Row */}
              <tr className="hover:bg-slate-50 transition-colors border-t border-slate-200">
                <td className="p-4 flex items-center gap-3 font-medium text-slate-700 bg-amber-50/30">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg"><TrendingUp size={18} /></div>
                  <div>
                    <span className="block text-sm font-bold">Costo por Tonelaje</span>
                    <span className="text-xs text-slate-400">$/Ton promedio</span>
                  </div>
                </td>
                {metrics.map((m: any) => (
                  <td key={m.id} className="p-4 text-center align-top bg-amber-50/30">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`text-lg font-bold ${m.costPerTon === minCostPerTon && m.costPerTon > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                        ${m.costPerTon > 0 ? formatCostPerTon(m.costPerTon) : '-'}
                      </span>
                      {renderDiff(m.costPerTon, 'costPerTon', m.id)}

                      {m.costPerTon === minCostPerTon && m.costPerTon > 0 && (
                        <span className="mt-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} /> Más Eficiente
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Divider */}
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={4} className="py-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Métricas de Producción</td>
              </tr>

              {/* Tons Row */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-4 flex items-center gap-3 font-medium text-slate-700">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Scale size={18} /></div>
                  <div>
                    <span className="block text-sm font-bold">Producción Total (Ton)</span>
                    <span className="text-xs text-slate-400">Volumen procesado</span>
                  </div>
                </td>
                {metrics.map((m: any) => (
                  <td key={m.id} className="p-4 text-center align-top">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`text-lg font-bold ${m.totalTons === maxTons ? 'text-blue-600' : 'text-slate-700'}`}>
                        {formatTons(m.totalTons)}
                      </span>
                      {renderDiff(m.totalTons, 'tons', m.id)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Machine Details Rows */}
              {specificMachines.map((machine: any) => (
                <tr key={machine} className="text-sm border-t border-slate-50">
                  <td className="p-3 pl-14 text-slate-600 flex items-center gap-2">
                    <span className="w-1 h-4 bg-slate-300 rounded-full"></span>
                    {machine}
                  </td>
                  {metrics.map((m: any) => {
                    const tons = m.machineTons[machine as keyof typeof m.machineTons] || 0;
                    const cost = m.machineCosts[machine as keyof typeof m.machineCosts] || 0;
                    const costPerTonMachine = tons > 0 ? cost / tons : 0;
                    const hours = m.machineUsage[machine] || 0;
                    const baseCap = m.baseCapacity[machine] || 0;
                    // Tolerance for floating point math
                    const isHP = hours > baseCap + 0.1;

                    return (
                      <td key={m.id} className="p-3 text-center align-top">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-slate-600 font-mono">
                            {formatTons(tons)} t
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatHours(hours)} h
                          </span>
                          {costPerTonMachine > 0 && (
                            <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Costo por tonelada de esta máquina">
                              ${formatCostPerTon(costPerTonMachine)}/t
                            </span>
                          )}
                          {isHP && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Horas Punta: Excede capacidad base">
                              <Zap size={8} className="fill-amber-500" /> HP
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Unmet Row */}
              <tr className="hover:bg-slate-50 transition-colors border-t border-slate-200">
                <td className="p-4 flex items-center gap-3 font-medium text-slate-700">
                  <div className="p-2 bg-red-100 text-red-700 rounded-lg"><AlertTriangle size={18} /></div>
                  <div>
                    <span className="block text-sm font-bold">No Atendido (Ton)</span>
                    <span className="text-xs text-slate-400">Demanda perdida por capacidad</span>
                  </div>
                </td>
                {metrics.map((m: any) => (
                  <td key={m.id} className="p-4 text-center align-top">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`text-lg font-bold ${m.unmetTons > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {formatTons(m.unmetTons)}
                      </span>
                      {renderDiff(m.unmetTons, 'unmet', m.id)}

                      {m.unmetTons === minUnmet && m.unmetTons === 0 && (
                        <span className="mt-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} /> Cumplimiento Total
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Comparative Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <DollarSign size={20} className="text-green-600" /> Comparativa de Costos por Máquina
          </h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(val: any) => `$${(val / 1000).toLocaleString('en-US')}k`} />
                <Tooltip formatter={(val: any) => `$${formatMoney(val)}`} />
                <Legend />
                {activeScenarios.map((s: any) => (
                  <Bar key={s.id} dataKey={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <Scale size={20} className="text-blue-600" /> Comparativa de Volumen (Ton) por Máquina
          </h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tonsChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(val: any) => `${formatTons(val)} t`} />
                <Legend />
                {activeScenarios.map((s: any) => (
                  <Bar key={s.id} dataKey={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Detailed Pivot Tables Section (Excel Style) */}
      <div className="flex flex-col gap-6">

        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <Table2 size={20} className="text-indigo-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-800 uppercase">Detalle de Desplazamientos</h4>
              <p className="text-xs text-slate-500">Muestra solo SKUs con asignaciones diferentes entre escenarios</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-400 px-2 uppercase tracking-wide flex items-center gap-1">
              <Filter size={10} /> Comparar:
            </span>

            <div className="relative">
              <select
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                className="appearance-none bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md py-1.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
              >
                {activeScenarios.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ArrowDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <span className="text-slate-400 text-xs font-bold px-1"><ArrowRightLeft size={12} /></span>

            <div className="relative">
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="appearance-none bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md py-1.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
              >
                {activeScenarios.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ArrowDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Pivot Tables */}
        {baseId === targetId ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-slate-400 text-center bg-white rounded-xl border border-dashed border-slate-300">
            <p>Selecciona dos escenarios diferentes para analizar los cambios.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {/* Table for Base Scenario */}
            {renderScenarioTable(baseId, activeScenarios.find((s: any) => s.id === baseId)?.name || 'Base', 'bg-slate-200')}

            {/* Arrow Divider */}
            <div className="flex justify-center -my-4 relative z-10">
              <div className="bg-white border border-slate-200 rounded-full p-2 text-slate-400 shadow-sm">
                <ArrowDown size={24} />
              </div>
            </div>

            {/* Table for Target Scenario */}
            {renderScenarioTable(targetId, activeScenarios.find((s: any) => s.id === targetId)?.name || 'Target', 'bg-blue-200')}
          </div>
        )}

      </div>

    </div>
  );
};

export default ComparisonDashboard;
