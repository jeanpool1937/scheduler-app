import React, { useMemo } from 'react';
import { Lightbulb, X } from 'lucide-react';

interface SequencerStats {
    totalTime: number; // in hours
    totalTonnage: number;
    changeovers: number;
    avgChangeoverTime: number; // in minutes
    skus: string[];
    quantities: number[];
    changeoverIds: string[];
}

interface SmartExplainerProps {
    stats: SequencerStats;
    onClose: () => void;
}

export const SmartExplainer: React.FC<SmartExplainerProps> = ({ stats, onClose }) => {

    const narrative = useMemo(() => {
        const lines: string[] = [];
        const { totalTonnage, avgChangeoverTime, changeovers, quantities, changeoverIds } = stats;

        // --- Data Analyzer Module ---

        // 1. Product Mix Analysis
        const changeoverMap = new Map<string, number>();
        for (let i = 0; i < changeoverIds.length; i++) {
            const id = changeoverIds[i];
            const qty = quantities[i];
            changeoverMap.set(id, (changeoverMap.get(id) || 0) + qty);
        }

        let dominantFamily = '';
        let maxQty = 0;
        changeoverMap.forEach((qty, id) => {
            if (qty > maxQty) {
                maxQty = qty;
                dominantFamily = id;
            }
        });

        const concentration = totalTonnage > 0 ? (maxQty / totalTonnage) * 100 : 0;
        const uniqueFamilies = changeoverMap.size;

        if (concentration > 50) {
            lines.push(`📊 **Análisis del Mix:** El pool de producción está altamente concentrado. La familia de calibre **'${dominantFamily === 'S/N' ? 'Mixta' : dominantFamily}'** representa el **${concentration.toFixed(1)}%** del total a procesar (${maxQty.toLocaleString()} TN).`);
        } else {
            lines.push(`📊 **Análisis del Mix:** Alta fragmentación detectada. El mix se distribuye en **${uniqueFamilies}** familias de calibres distintos, lo que supone un reto algorítmico mayor. La familia líder ('${dominantFamily === 'S/N' ? 'Mixta' : dominantFamily}') ocupa solo el **${concentration.toFixed(1)}%** del plan.`);
        }

        // 2. Efficiency & Setup Impact
        if (avgChangeoverTime < 30) {
            lines.push(`🚀 **Eficiencia Lograda:** El motor genético logró agrupar estratégicamente los calibres, aplastando el promedio de setup a solo **${avgChangeoverTime.toFixed(1)} min** por cambio secuencial.`);
        } else if (avgChangeoverTime > 60) {
            lines.push(`⚠️ **Costos de Setup:** Pese a la optimización, la incompatibilidad entre las ${uniqueFamilies} familias forzó secuencias de **${avgChangeoverTime.toFixed(1)} min** en promedio por cambio. Evaluar viabilidad de aplazar SKUs aislados.`);
        } else {
            lines.push(`✅ **Estabilidad Térmico-Mecánica:** Se logró un flujo estandarizado con cambios promediando **~${avgChangeoverTime.toFixed(1)} min**. La secuencia contuvo exitosamente los saltos de calibre extremos.`);
        }

        // 3. Strategic AI Insight
        if (changeovers < uniqueFamilies * 2) {
            lines.push(`💡 **Estrategia del Optimizador:** El Algoritmo agrupó intensivamente el bloque de mayor tonelaje (Familia ${dominantFamily}), limitando las transiciones mecánicas a estrictamente puentes inter-familia para **reducir el desperdicio de ajuste y tiempo muerto**. `);
        } else if (concentration > 30) {
            lines.push(`💡 **Estrategia del Optimizador:** Dada la predominancia del perfil '${dominantFamily}', la secuencia ancló estos pedidos como núcleo central y distribuyó los SKUs minoritarios en las colas (extremos) para priorizar inercia ininterrumpida.`);
        } else {
            lines.push(`💡 **Estrategia del Optimizador:** Frente a la alta variabilidad del mix, la heurística balanceó intercalando SKUs compatibles metalúrgicamente minimizando las penalidades del costo cruzado (Cross-Changeover penalty).`);
        }

        return lines;
    }, [stats]);

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 shadow-lg mb-4 relative animate-in fade-in slide-in-from-top-4 duration-500">
            <button
                onClick={onClose}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={18} />
            </button>

            <div className="flex items-start gap-4">
                <div className="bg-white p-2 rounded-full shadow-sm text-indigo-600 mt-1">
                    <Lightbulb size={24} />
                </div>

                <div className="flex-1">
                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                        Antigravity AI Insight
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">BETA</span>
                    </h3>

                    <div className="space-y-2">
                        {narrative.map((line, idx) => (
                            <p key={idx} className="text-slate-700 text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
