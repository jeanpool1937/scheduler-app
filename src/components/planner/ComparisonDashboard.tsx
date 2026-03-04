import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { PlannerOptimizationResult } from '../../types/planner';
import {
  AlertTriangle, DollarSign, TrendingUp, Scale, CheckCircle2,
  ArrowDown, ArrowUp, Table2, ArrowRightLeft, Zap,
  Clock, Factory, Filter, FileSpreadsheet, Calendar
} from 'lucide-react';

// ─── Design tokens (same as PlannerLayout) ──────────────────────────────────
const MACHINE_COLORS: Record<string, string> = {
  LAM1: '#6366f1',
  LAM2: '#8b5cf6',
  LAM3: '#f59e0b',
};


// ─── Scenario palette ────────────────────────────────────────────────────────
const SCENARIO_COLORS = ['#004DB4', '#8b5cf6', '#f59e0b'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)} M`
    : v >= 1_000 ? `$${(v / 1_000).toFixed(1)} K`
      : `$${v.toFixed(0)}`;

const fmtTons = (v: number) => v.toLocaleString('es-PE', { maximumFractionDigits: 0 });
const fmtH = (v: number) => `${v.toFixed(1)} h`;

// ─── Props ──────────────────────────────────────────────────────────────────
interface ComparisonProps {
  resultA?: PlannerOptimizationResult | null;
  resultB?: PlannerOptimizationResult | null;
  resultC?: PlannerOptimizationResult | null;
  nameA?: string;
  nameB?: string;
  nameC?: string;
}

// ─── Sección card ────────────────────────────────────────────────────────────
const Card: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title, subtitle, icon, children
}) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/30">
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#004DB4] shadow-sm border border-blue-100/50">
        {React.cloneElement(icon as React.ReactElement<any>, { strokeWidth: 1.5 })}
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 font-medium">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────
const ComparisonDashboard: React.FC<ComparisonProps> = ({
  resultA, resultB, resultC,
  nameA = 'Óptimo (Económico)',
  nameB = 'Máx Capacidad',
  nameC = 'Tradicional',
}) => {
  const allScenarios = [
    { id: 'A', name: nameA, data: resultA, color: SCENARIO_COLORS[0] },
    { id: 'B', name: nameB, data: resultB, color: SCENARIO_COLORS[1] },
    { id: 'C', name: nameC, data: resultC, color: SCENARIO_COLORS[2] },
  ];
  const activeScenarios = allScenarios.filter((s) => s.data);

  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [baseId, setBaseId] = useState<string>(activeScenarios[0]?.id || 'A');
  const [targetId, setTargetId] = useState<string>(activeScenarios[1]?.id || 'B');

  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    activeScenarios.forEach((s) => s.data?.monthlyResults?.forEach((mr: any) => set.add(mr.period)));
    return Array.from(set).sort();
  }, [resultA, resultB, resultC]);

  if (activeScenarios.length < 1) return null;

  // ── Métricas por escenario (filtradas por periodo) ──────────────────────
  const metrics = activeScenarios.map((s) => {
    const r = s.data!;
    let allocs = r.allocations;
    let cost = r.totalCost;
    let bkdown = r.breakdown || { productionCost: 0, overtimeCost: 0, peakPowerCost: 0 };
    let unmet = r.unmetDemand;
    let usage = r.machineUsage;
    let baseCap = r.baseCapacity;

    if (selectedPeriod !== 'all' && r.monthlyResults) {
      const md = r.monthlyResults.find((mr: any) => mr.period === selectedPeriod);
      if (md) {
        allocs = md.allocations;
        cost = md.totalCost;
        bkdown = md.breakdown || bkdown;
        unmet = md.unmetDemand;
        usage = md.machineUsage;
        baseCap = md.capacities
          ? Object.fromEntries(Object.entries(md.capacities).map(([k, v]: [string, any]) => [k, v.base]))
          : r.baseCapacity;
      }
    }

    const totalTons = allocs.reduce((acc: number, a: any) => acc + a.quantity, 0);
    const costPerTon = totalTons > 0 ? cost / totalTons : 0;

    const byMachine: Record<string, { tons: number; cost: number; hours: number; base: number }> = {};
    ['LAM1', 'LAM2', 'LAM3'].forEach((m) => {
      const mAllocs = allocs.filter((a: any) => a.machineId === m);
      byMachine[m] = {
        tons: mAllocs.reduce((acc: number, a: any) => acc + a.quantity, 0),
        cost: mAllocs.reduce((acc: number, a: any) => acc + a.cost, 0),
        hours: usage[m] || 0,
        base: baseCap[m] || 0,
      };
    });

    return {
      id: s.id, name: s.name, color: s.color,
      cost, bkdown, totalTons, costPerTon, byMachine,
      unmetTons: unmet.reduce((acc: number, u: any) => acc + u.amount, 0),
    };
  });

  const minCost = Math.min(...metrics.map((m) => m.cost));
  const minCostPerTon = Math.min(...metrics.filter((m) => m.costPerTon > 0).map((m) => m.costPerTon));
  const baseMetric = metrics.find((m) => m.id === 'A');

  const renderDiff = (cur: number, base: number, lowerIsBetter = true) => {
    if (!base || cur === base) return null;
    if (cur === 0 && base === 0) return null;

    const pct = ((cur - base) / Math.abs(base)) * 100;
    if (Math.abs(pct) < 0.01) return null;

    const better = lowerIsBetter ? cur < base : cur > base;
    return (
      <span className={`ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${better ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
        {better ? <ArrowDown size={10} strokeWidth={2.5} /> : <ArrowUp size={10} strokeWidth={2.5} />}
        {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  // ── Chart data ──────────────────────────────────────────────────────────
  const machineIds = ['LAM1', 'LAM2', 'LAM3'];
  const costChart = machineIds.map((m) => {
    const row: Record<string, any> = { name: m };
    activeScenarios.forEach((s) => {
      row[s.name] = metrics.find((x) => x.id === s.id)?.byMachine[m]?.cost ?? 0;
    });
    return row;
  });
  const tonsChart = machineIds.map((m) => {
    const row: Record<string, any> = { name: m };
    activeScenarios.forEach((s) => {
      row[s.name] = metrics.find((x) => x.id === s.id)?.byMachine[m]?.tons ?? 0;
    });
    return row;
  });

  // ── Pivot table (SKU desplazamientos) ───────────────────────────────────
  const affectedSkuIds = useMemo(() => {
    const baseS = activeScenarios.find((s) => s.id === baseId);
    const targetS = activeScenarios.find((s) => s.id === targetId);
    if (!baseS || !targetS || baseId === targetId) return new Set<string>();
    const diffs = new Set<string>();
    const mapA = new Map<string, string>();
    baseS.data!.allocations.forEach((a: any) => mapA.set(`${a.period}::${a.skuId}`, a.machineId));
    const mapB = new Map<string, string>();
    targetS.data!.allocations.forEach((b: any) => {
      mapB.set(`${b.period}::${b.skuId}`, b.machineId);
      const machA = mapA.get(`${b.period}::${b.skuId}`);
      if (!machA || machA !== b.machineId) diffs.add(b.skuId);
    });
    baseS.data!.allocations.forEach((a: any) => {
      if (!mapB.has(`${a.period}::${a.skuId}`)) diffs.add(a.skuId);
    });
    return diffs;
  }, [baseId, targetId, resultA, resultB, resultC]);

  const buildPivot = (data: PlannerOptimizationResult) => {
    const periods = Array.from(new Set(data.allocations.map((a: any) => a.period))).sort() as string[];
    const pivot: Record<string, { desc: string; machines: Record<string, Record<string, number>>; row: Record<string, number> }> = {};
    data.allocations
      .filter((a: any) => affectedSkuIds.has(a.skuId))
      .forEach((a: any) => {
        if (!pivot[a.skuId]) pivot[a.skuId] = { desc: a.skuDesc, machines: {}, row: {} };
        pivot[a.skuId].machines[a.machineId] = pivot[a.skuId].machines[a.machineId] || {};
        pivot[a.skuId].machines[a.machineId][a.period] = (pivot[a.skuId].machines[a.machineId][a.period] || 0) + a.quantity;
        pivot[a.skuId].row[a.period] = (pivot[a.skuId].row[a.period] || 0) + a.quantity;
      });
    return { periods, pivot };
  };

  const renderPivotTable = (scenId: string, label: string, accentColor: string) => {
    const sc = activeScenarios.find((s) => s.id === scenId);
    if (!sc || affectedSkuIds.size === 0) return null;
    const { periods, pivot } = buildPivot(sc.data!);
    const skuIds = Object.keys(pivot).sort();
    if (!skuIds.length) return (
      <div className="py-8 text-center text-sm text-gray-400">Sin cambios de asignación</div>
    );
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100" style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}>
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={15} style={{ color: accentColor }} />
            <span className="text-sm font-semibold text-gray-800">{label}</span>
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{skuIds.length} SKUs con cambios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="p-2 text-left font-semibold min-w-[180px] sticky left-0 bg-gray-50 border-r border-gray-200">Etiqueta de fila</th>
                {periods.map((p) => <th key={p} className="p-2 font-semibold min-w-[56px] whitespace-nowrap">{p}</th>)}
                <th className="p-2 font-bold bg-gray-100 text-gray-700 min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {skuIds.map((skuId) => {
                const d = pivot[skuId];
                const machines = Object.keys(d.machines).sort();
                const skuTotal = periods.reduce((s, p) => s + (d.row[p] || 0), 0);
                return (
                  <React.Fragment key={skuId}>
                    <tr className="font-semibold text-gray-800 bg-blue-50/40">
                      <td className="p-2 text-left sticky left-0 bg-blue-50/40 border-r border-blue-100">
                        <span className="block text-xs font-bold">{skuId}</span>
                        <span className="block text-[10px] font-normal text-gray-500 truncate max-w-[160px]" title={d.desc}>{d.desc}</span>
                      </td>
                      {periods.map((p) => <td key={p} className="p-2">{d.row[p] ? fmtTons(d.row[p]) : ''}</td>)}
                      <td className="p-2 bg-blue-100/30 font-bold">{fmtTons(skuTotal)}</td>
                    </tr>
                    {machines.map((mId) => {
                      const mData = d.machines[mId];
                      const mTotal = periods.reduce((s, p) => s + (mData[p] || 0), 0);
                      return (
                        <tr key={`${skuId}-${mId}`} className="text-gray-500 hover:bg-gray-50">
                          <td className="p-2 text-left pl-5 sticky left-0 bg-white border-r border-gray-100">
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: MACHINE_COLORS[mId] || '#9ca3af' }} />
                            {mId}
                          </td>
                          {periods.map((p) => <td key={p} className="p-2 font-mono">{mData[p] ? fmtTons(mData[p]) : ''}</td>)}
                          <td className="p-2 font-medium">{fmtTons(mTotal)}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              <tr className="font-bold text-white text-xs" style={{ backgroundColor: '#004DB4' }}>
                <td className="p-2.5 text-left sticky left-0" style={{ backgroundColor: '#004DB4' }}>Total general</td>
                {periods.map((p) => {
                  const col = skuIds.reduce((s, sku) => s + (pivot[sku].row[p] || 0), 0);
                  return <td key={p} className="p-2.5">{fmtTons(col)}</td>;
                })}
                <td className="p-2.5" style={{ backgroundColor: '#003899' }}>
                  {fmtTons(skuIds.reduce((s, sku) => s + periods.reduce((s2, p) => s2 + (pivot[sku].row[p] || 0), 0), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* 1. Selector de Periodo */}
      {availablePeriods.length > 0 && (
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-gray-400" />
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Período:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedPeriod('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedPeriod === 'all' ? 'text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={selectedPeriod === 'all' ? { backgroundColor: '#004DB4' } : {}}
            >
              Todo el año
            </button>
            {availablePeriods.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedPeriod === p ? 'text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={selectedPeriod === p ? { backgroundColor: '#004DB4' } : {}}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Resumen comparativo global */}
      <Card title="Resumen Comparativo" subtitle="Diferencias respecto al escenario base (A)" icon={<Scale size={18} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Indicador</th>
                {metrics.map((m) => (
                  <th key={m.id} className={`pb-3 text-center text-xs font-bold uppercase tracking-widest ${m.id === 'A' ? 'bg-blue-50/50 rounded-t-lg pt-1' : ''}`} style={{ color: m.color }}>
                    {m.name}
                    {m.id === 'A' && (
                      <span className="block text-[9px] text-[#004DB4] opacity-70 font-black mt-0.5">ESCENARIO BASE</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Costo Total */}
              <tr className="group hover:bg-gray-50/50 transition-colors">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100"><DollarSign size={16} strokeWidth={1.5} className="text-emerald-600" /></div>
                    <div>
                      <span className="block text-xs font-bold text-gray-800 tracking-tight">Costo Total</span>
                      <span className="block text-[10px] text-gray-400 font-medium">Objetivo: minimizar</span>
                    </div>
                  </div>
                </td>
                {metrics.map((m) => (
                  <td key={m.id} className={`py-4 text-center transition-all ${m.id === 'A' ? 'bg-blue-50/30' : ''}`}>
                    <span className={`text-base font-black ${m.cost === minCost && m.cost > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{fmt$(m.cost)}</span>
                    {m.id !== 'A' && baseMetric && renderDiff(m.cost, baseMetric.cost, true)}
                    {m.cost === minCost && m.cost > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-full border border-emerald-200/50 w-fit mx-auto">
                        <CheckCircle2 size={10} strokeWidth={2.5} /> EL MEJOR
                      </div>
                    )}
                  </td>
                ))}
              </tr>
              {/* Sub-costos */}
              {[
                { icon: <Factory size={12} strokeWidth={1.5} className="text-gray-400" />, label: 'Fabricación', key: 'productionCost' },
                { icon: <Clock size={12} strokeWidth={1.5} className="text-orange-400" />, label: 'Horas Extra', key: 'overtimeCost' },
                { icon: <Zap size={12} strokeWidth={1.5} className="text-red-400" />, label: 'Energía Punta', key: 'peakPowerCost' },
              ].map(({ icon, label, key }) => (
                <tr key={key} className="text-xs">
                  <td className="py-2 pl-9 text-gray-500 flex items-center gap-1.5">{icon}{label}</td>
                  {metrics.map((m) => (
                    <td key={m.id} className={`py-2 text-center font-mono text-gray-600 ${m.id === 'A' ? 'bg-blue-50/30' : ''}`}>
                      {fmt$((m.bkdown as any)[key] || 0)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Costo/ton */}
              <tr className="group hover:bg-amber-50/30 transition-colors">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100"><TrendingUp size={16} strokeWidth={1.5} className="text-amber-600" /></div>
                    <div>
                      <span className="block text-xs font-bold text-gray-800 tracking-tight">Costo / Ton</span>
                      <span className="block text-[10px] text-gray-400 font-medium">Eficiencia promedio</span>
                    </div>
                  </div>
                </td>
                {metrics.map((m) => (
                  <td key={m.id} className={`py-4 text-center transition-all ${m.id === 'A' ? 'bg-blue-50/30' : ''}`}>
                    <span className={`text-base font-black ${m.costPerTon === minCostPerTon && m.costPerTon > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                      {m.costPerTon > 0 ? `$${m.costPerTon.toFixed(2)}` : '–'}
                    </span>
                    {m.id !== 'A' && baseMetric && renderDiff(m.costPerTon, baseMetric.costPerTon, true)}
                  </td>
                ))}
              </tr>

              {/* Producción */}
              <tr className="group hover:bg-gray-50/50 border-t border-gray-100 transition-colors">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100/50"><Scale size={16} strokeWidth={1.5} className="text-[#004DB4]" /></div>
                    <div>
                      <span className="block text-xs font-bold text-gray-800 tracking-tight">Producción Total</span>
                      <span className="block text-[10px] text-gray-400 font-medium">Toneladas procesadas</span>
                    </div>
                  </div>
                </td>
                {metrics.map((m) => (
                  <td key={m.id} className={`py-4 text-center transition-all ${m.id === 'A' ? 'bg-blue-50/30' : ''}`}>
                    <span className="text-base font-black text-gray-900">{fmtTons(m.totalTons)}</span>
                    <span className="text-[10px] text-gray-400 font-black ml-1">TN</span>
                    {m.id !== 'A' && baseMetric && renderDiff(m.totalTons, baseMetric.totalTons, false)}
                  </td>
                ))}
              </tr>

              {/* Por máquina */}
              {['LAM1', 'LAM2', 'LAM3'].map((mId) => (
                <tr key={mId} className="text-xs group hover:bg-gray-50/30 transition-colors">
                  <td className="py-2 pl-9">
                    <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle shadow-sm" style={{ backgroundColor: MACHINE_COLORS[mId] }} />
                    <span className="text-gray-600 font-medium">{mId}</span>
                  </td>
                  {metrics.map((m) => {
                    const info = m.byMachine[mId];
                    const isHP = info.hours > info.base + 0.1;
                    return (
                      <td key={m.id} className={`py-2 text-center transition-all ${m.id === 'A' ? 'bg-blue-50/20' : ''}`}>
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-gray-700 font-bold">{fmtTons(info.tons)} TN</span>
                          <span className="text-[10px] text-gray-400 font-medium">{fmtH(info.hours)}</span>
                          {isHP && (
                            <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-black text-amber-600 bg-amber-100/50 px-1.5 py-0.5 rounded border border-amber-200/50">
                              <Zap size={8} strokeWidth={2.5} className="fill-amber-500" /> HP
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* No atendido */}
              <tr className="group hover:bg-red-50/10 border-t border-gray-100 transition-colors">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center border border-red-100"><AlertTriangle size={16} strokeWidth={1.5} className="text-red-500" /></div>
                    <div>
                      <span className="block text-xs font-bold text-gray-800 tracking-tight">No Atendido</span>
                      <span className="block text-[10px] text-gray-400 font-medium">Demanda sin cubrir</span>
                    </div>
                  </div>
                </td>
                {metrics.map((m) => (
                  <td key={m.id} className={`py-4 text-center transition-all ${m.id === 'A' ? 'bg-blue-50/30' : ''}`}>
                    <span className={`text-base font-black ${m.unmetTons > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {fmtTons(m.unmetTons)} <span className="text-xs font-black">TN</span>
                    </span>
                    {m.unmetTons === 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-full border border-emerald-200/50 w-fit mx-auto">
                        <CheckCircle2 size={10} strokeWidth={2.5} /> 100% CUBIERTO
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3. Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Costos por Máquina" subtitle="Comparativa entre escenarios" icon={<DollarSign size={18} />}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costChart} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: any) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  formatter={(v: any) => [fmt$(v), '']}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: '15px' }} iconType="circle" />
                {activeScenarios.map((s) => (
                  <Bar key={s.id} dataKey={s.name} fill={s.color} radius={[6, 6, 0, 0]} barSize={24} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Volumen por Máquina" subtitle="Toneladas por escenario" icon={<Scale size={18} />}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tonsChart} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip formatter={(v: any) => `${fmtTons(v)} TN`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeScenarios.map((s) => (
                  <Bar key={s.id} dataKey={s.name} fill={s.color} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 4. Tabla pivot de desplazamientos */}
      {activeScenarios.length >= 2 && (
        <Card
          title="Detalle de Desplazamientos de SKU"
          subtitle="SKUs que cambian de asignación de máquina entre escenarios"
          icon={<Table2 size={18} />}
        >
          {/* Selector de escenarios */}
          <div className="flex flex-wrap items-center gap-2 mb-5 pb-4 border-b border-gray-100">
            <span className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1"><Filter size={10} /> Comparar:</span>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="border border-gray-200 text-xs rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {activeScenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ArrowRightLeft size={12} className="text-gray-400" />
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="border border-gray-200 text-xs rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {activeScenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {baseId === targetId ? (
            <p className="text-center text-sm text-gray-400 py-6">Selecciona dos escenarios diferentes para ver los cambios</p>
          ) : (
            <div className="space-y-4">
              {renderPivotTable(baseId, activeScenarios.find((s) => s.id === baseId)?.name || 'Base', MACHINE_COLORS.LAM1)}
              <div className="flex justify-center py-1">
                <div className="bg-gray-100 border border-gray-200 rounded-full p-1.5 text-gray-400">
                  <ArrowDown size={16} />
                </div>
              </div>
              {renderPivotTable(targetId, activeScenarios.find((s) => s.id === targetId)?.name || 'Target', MACHINE_COLORS.LAM2)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default ComparisonDashboard;
