import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Weight, TrendingUp, AlertTriangle } from 'lucide-react';

export const KPIDashboard: React.FC = () => {
    const { schedule } = useStore((state) => state.processes[state.activeProcessId]);

    const stats = useMemo(() => {
        const totalTons = schedule.reduce((sum, item) => sum + (item.quantity || 0), 0);

        const totalProdTime = schedule.reduce((sum, item) => sum + (item.productionTimeMinutes || 0), 0);
        const totalChangeover = schedule.reduce((sum, item) => sum + (item.changeoverMinutes || 0), 0);
        const totalStoppages = schedule.reduce((sum, item) => {
            const stops = item.stoppages ? Object.values(item.stoppages).reduce((a, b) => a + b, 0) : 0;
            return sum + stops;
        }, 0);

        const totalTime = totalProdTime + totalChangeover + totalStoppages;
        const efficiency = totalTime > 0 ? (totalProdTime / totalTime) * 100 : 0;

        // Count changeovers > 60 mins as "alerts" (example rule)
        const criticalAlerts = schedule.filter(item => (item.changeoverMinutes || 0) > 60).length;

        return {
            totalTons,
            efficiency,
            criticalAlerts
        };
    }, [schedule]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Card 1: Total Tonnage */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
                <div>
                    <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Tonelaje Total</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">{stats.totalTons.toLocaleString()}</span>
                        <span className="text-sm text-gray-400">Ton</span>
                    </div>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg text-[#004DB4]">
                    <Weight size={20} />
                </div>
            </div>

            {/* Card 2: Efficiency */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
                <div>
                    <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Eficiencia Est.</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">{stats.efficiency.toFixed(1)}%</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stats.efficiency > 85 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {stats.efficiency > 85 ? 'Óptimo' : 'Revisar'}
                        </span>
                    </div>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <TrendingUp size={20} />
                </div>
            </div>

            {/* Card 3: Critical Alerts */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
                <div>
                    <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Alertas Críticas</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">{stats.criticalAlerts}</span>
                        <span className="text-sm text-gray-400">Cambios Largos</span>
                    </div>
                </div>
                <div className={`p-2 rounded-lg ${stats.criticalAlerts > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <AlertTriangle size={20} />
                </div>
            </div>
        </div>
    );
};
