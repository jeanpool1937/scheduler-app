import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { PlannerOptimizationResult } from '../../types/planner';
import {
  AlertTriangle, TrendingUp, Scale, CheckCircle2,
  ArrowDown, ArrowUp, Table2, ArrowRightLeft, Zap,
  Clock, FileSpreadsheet,
  Trophy, ChevronRight, BarChart3
} from 'lucide-react';

// ─── Design tokens (same as PlannerLayout) ──────────────────────────────────
const SCENARIO_COLORS = ['#004DB4', '#8b5cf6', '#f59e0b'];
const MACHINE_COLORS: Record<string, string> = {
  LAM1: '#6366f1',
  LAM2: '#8b5cf6',
  LAM3: '#f59e0b',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtTons = (v: number) => v.toLocaleString('es-PE', { maximumFractionDigits: 0 });
const fmt$ = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)} M`
    : v >= 1_000 ? `$${(v / 1_000).toFixed(1)} K`
      : `$${v.toFixed(0)}`;

// ─── Props ──────────────────────────────────────────────────────────────────
interface ComparisonProps {
  resultA?: PlannerOptimizationResult | null;
  resultB?: PlannerOptimizationResult | null;
  resultC?: PlannerOptimizationResult | null;
  nameA?: string;
  nameB?: string;
  nameC?: string;
}

// ─── New Premium Card Component ──────────────────────────────────────────────
const PremiumCard: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title, subtitle, icon, children, className = ""
}) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${className}`}>
    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-50 bg-gray-50/20">
      <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[#004DB4]">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 20, strokeWidth: 1.5 })}
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">{subtitle}</p>}
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

  // ── Métricas por escenario ──────────────────────────────────────────────
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
  const winner = metrics.find(m => m.cost === minCost);
  const baseMetric = metrics.find((m) => m.id === 'A');

  const renderDiff = (cur: number, base: number, lowerIsBetter = true) => {
    if (!base || cur === base) return null;
    const pct = ((cur - base) / Math.abs(base)) * 100;
    if (Math.abs(pct) < 0.01) return null;
    const better = lowerIsBetter ? cur < base : cur > base;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${better ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
        {better ? <ArrowDown size={10} strokeWidth={3} /> : <ArrowUp size={10} strokeWidth={3} />}
        {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-12">

      {/* ── HERO BANNER (ESTILO HOME) ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#004DB4] to-indigo-800 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-bold uppercase tracking-wider">
              <Trophy size={14} className="text-amber-400" /> Dashboard de Resultados
            </div>
            <h1 className="text-3xl font-black tracking-tight">Análisis de Optimización</h1>
            <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
              Resumen comparativo de los escenarios generados. El modelo ha identificado el escenario <span className="text-white font-bold underline underline-offset-4 decoration-emerald-400">"{winner?.name}"</span> como el más eficiente.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-blue-200 tracking-widest">Costo Mínimo</p>
              <p className="text-3xl font-black tracking-tighter">{fmt$(minCost)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={24} className="text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl" />
      </div>

      {/* ── PERIOD CLUSTERS (ESTILO HOME) ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-white border border-gray-100 p-1.5 rounded-2xl shadow-sm">
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedPeriod === 'all' ? 'bg-[#004DB4] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Anual 2026
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex gap-1">
            {availablePeriods.slice(0, 4).map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedPeriod === p ? 'bg-[#004DB4] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            ))}
            {availablePeriods.length > 4 && (
              <div className="relative group">
                <button className="px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:bg-gray-50 flex items-center gap-1">
                  Más <ChevronRight size={14} />
                </button>
                <div className="absolute top-full left-0 mt-2 hidden group-hover:grid grid-cols-3 gap-1 bg-white border border-gray-100 p-2 rounded-xl shadow-xl z-50 w-64">
                  {availablePeriods.slice(4).map(p => (
                    <button
                      key={p}
                      onClick={() => setSelectedPeriod(p)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold text-center ${selectedPeriod === p ? 'bg-[#004DB4] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SCENARIO CARDS (ESTILO HOME MÓDULOS) ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((m, idx) => (
          <div key={m.id} className={`group relative bg-white rounded-3xl border-2 transition-all p-8 flex flex-col gap-6 hover:shadow-xl hover:-translate-y-1 ${m.id === 'A' ? 'border-[#004DB4]' : 'border-gray-50 hover:border-blue-100'}`}>
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${m.color}15`, color: m.color }}>
                {idx === 0 ? <Zap size={28} /> : idx === 1 ? <Scale size={28} /> : <FileSpreadsheet size={28} />}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Escenario</span>
                <span className="text-xl font-black tracking-tight" style={{ color: m.color }}>{m.name}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-end justify-between border-b border-gray-50 pb-4">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase">Costo Total</p>
                  <p className="text-2xl font-black text-gray-900 tracking-tighter">{fmt$(m.cost)}</p>
                </div>
                {m.id !== 'A' && baseMetric && (
                  <div className="mb-1">{renderDiff(m.cost, baseMetric.cost)}</div>
                )}
                {m.id === 'A' && (
                  <span className="mb-1 px-3 py-1 rounded-full bg-blue-50 text-[10px] font-black text-[#004DB4] border border-blue-100">BASE</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Tonelaje</p>
                  <p className="text-sm font-bold text-gray-700">{fmtTons(m.totalTons)} <span className="text-[10px] font-medium text-gray-400">TN</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Eficiencia</p>
                  <p className="text-sm font-bold text-gray-700">${m.costPerTon.toFixed(1)} <span className="text-[10px] font-medium text-gray-400">/TN</span></p>
                </div>
              </div>
            </div>

            <button className="w-full py-3 rounded-2xl bg-gray-50 text-gray-500 text-xs font-bold group-hover:bg-[#004DB4] group-hover:text-white transition-all flex items-center justify-center gap-2">
              Ver detalle técnico <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ── TECHNICAL TABS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Gráfico de Costos */}
        <PremiumCard title="Análisis de Costos" subtitle="Desglose por escenario y máquina" icon={<BarChart3 />}>
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={useMemo(() => ['LAM1', 'LAM2', 'LAM3'].map(m => {
                const row: any = { name: m };
                activeScenarios.forEach(s => {
                  row[s.name] = metrics.find(x => x.id === s.id)?.byMachine[m]?.cost ?? 0;
                });
                return row;
              }), [metrics])} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                {activeScenarios.map((s) => (
                  <Bar key={s.id} dataKey={s.name} fill={s.color} radius={[8, 8, 0, 0]} barSize={20} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        {/* Tabla de Indicadores */}
        <PremiumCard title="Detalle de Indicadores" subtitle="Comparativa técnica profunda" icon={<Table2 />}>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr className="text-[10px] font-black text-gray-400 bg-gray-50/50 uppercase tracking-widest">
                  <td className="py-2 px-4">KPI</td>
                  {metrics.map(m => <td key={m.id} className="py-2 px-4 text-center">{m.name}</td>)}
                </tr>

                {/* Costo Total row with highlight */}
                <tr className="font-bold text-gray-900 group hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Costo Total
                  </td>
                  {metrics.map(m => (
                    <td key={m.id} className="py-4 px-4 text-center font-black">
                      {fmt$(m.cost)}
                    </td>
                  ))}
                </tr>

                {[
                  { label: 'Energía Punta', key: 'peakPowerCost', icon: <Zap size={12} className="text-amber-500" /> },
                  { label: 'Horas Extra', key: 'overtimeCost', icon: <Clock size={12} className="text-blue-500" /> },
                  { label: 'No Atendido', key: 'unmetTons', suffix: ' TN', icon: <AlertTriangle size={12} className="text-red-500" /> }
                ].map(item => (
                  <tr key={item.key} className="text-gray-500 hover:bg-gray-50/30 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-2">
                      {item.icon} {item.label}
                    </td>
                    {metrics.map(m => (
                      <td key={m.id} className="py-3 px-4 text-center font-mono text-xs font-bold">
                        {item.key === 'unmetTons' ? `${fmtTons(m.unmetTons)}${item.suffix}` : fmt$((m.bkdown as any)[item.key] || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>

      </div>

      {/* ── DETAIL PIVOT ──────────────────────────────────────────────────── */}
      {activeScenarios.length >= 2 && (
        <PremiumCard
          title="Desplazamientos de SKU"
          subtitle="Análisis de movimiento de carga entre máquinas"
          icon={<ArrowRightLeft />}
        >
          <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
              <select value={baseId} onChange={e => setBaseId(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none px-2 py-1">
                {activeScenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gray-100 text-[#004DB4]">
                <ArrowRightLeft size={14} />
              </div>
              <select value={targetId} onChange={e => setTargetId(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none px-2 py-1">
                {activeScenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400">Selecciona el escenario base para ver cómo se redistribuyó el tonelaje.</p>
          </div>

          <div className="flex flex-col gap-6">

            {/* Comparación Base vs Target */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const buildPivot = (data: PlannerOptimizationResult) => {
                  const diffs = new Set<string>();
                  const mapBase = new Map<string, string>();
                  activeScenarios.find(s => s.id === baseId)?.data?.allocations.forEach((a: any) => mapBase.set(`${a.period}::${a.skuId}`, a.machineId));
                  const mapTarget = new Map<string, string>();
                  activeScenarios.find(s => s.id === targetId)?.data?.allocations.forEach((a: any) => mapTarget.set(`${a.period}::${a.skuId}`, a.machineId));

                  const allSkus = new Set([...Array.from(mapBase.keys()), ...Array.from(mapTarget.keys())]);
                  allSkus.forEach(key => {
                    if (mapBase.get(key) !== mapTarget.get(key)) diffs.add(key.split('::')[1]);
                  });

                  const pivot: any = {};
                  data.allocations.filter((a: any) => diffs.has(a.skuId)).forEach((a: any) => {
                    if (!pivot[a.skuId]) pivot[a.skuId] = { desc: a.skuDesc, machines: {} };
                    pivot[a.skuId].machines[a.machineId] = (pivot[a.skuId].machines[a.machineId] || 0) + a.quantity;
                  });
                  return { pivot, diffs };
                };

                const renderMiniTable = (scenId: string) => {
                  const sc = activeScenarios.find(s => s.id === scenId);
                  if (!sc) return null;
                  const { pivot } = buildPivot(sc.data!);
                  return (
                    <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} /> {sc.name}
                      </p>
                      <div className="space-y-2">
                        {Object.keys(pivot).slice(0, 5).map(skuId => (
                          <div key={skuId} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg shadow-sm border border-gray-100/50">
                            <span className="font-bold text-gray-700">{skuId}</span>
                            <div className="flex gap-2">
                              {Object.keys(pivot[skuId].machines).map(mId => (
                                <span key={mId} className="px-1.5 py-0.5 rounded-md text-[9px] font-black text-white" style={{ backgroundColor: MACHINE_COLORS[mId] || '#6b7280' }}>{mId}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {Object.keys(pivot).length > 5 && (
                          <p className="text-[10px] text-center text-gray-400 italic">Y {Object.keys(pivot).length - 5} SKUs más...</p>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {renderMiniTable(baseId)}
                    {renderMiniTable(targetId)}
                  </>
                );
              })()}
            </div>

            <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/30">
              <FileSpreadsheet className="text-[#004DB4] mb-3 opacity-20" size={40} strokeWidth={1.5} />
              <p className="text-sm font-bold text-gray-400">Desglose avanzado disponible en reportes</p>
              <button className="mt-4 px-8 py-2.5 bg-[#004DB4] rounded-xl shadow-lg shadow-blue-900/10 text-xs font-black text-white hover:bg-blue-700 transition-all flex items-center gap-2">
                <TrendingUp size={14} /> ANALIZAR TODOS LOS CAMBIOS
              </button>
            </div>
          </div>
        </PremiumCard>
      )}

    </div>
  );
};

export default ComparisonDashboard;
