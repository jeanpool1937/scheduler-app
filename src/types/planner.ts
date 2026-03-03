// Planner Module Types
// These types define the data structures for the capacity & cost optimizer.

export interface MachineCost {
    id: string;           // 'LAM1', 'LAM2', 'LAM3'
    peakPowerCost: number; // Costo Fijo Potencia Coincidente ($)
    overtimeRate: number;  // Tasa Extra Calc. ($/h)
}

export interface PeriodCapacity {
    period: string; // YYYY-MM
    peakHours: number;
    machines: {
        [machineId: string]: {
            total: number;
            base: number;
        };
    };
}

export interface PlannerProductionResult {
    period: string;
    skuId: string;
    skuDesc: string;
    machineId: string;
    quantity: number;
    cost: number;
    timeUsed: number;
    isOvertime?: boolean;
}

export interface PlannerMonthlyResult {
    period: string;
    allocations: PlannerProductionResult[];
    unmetDemand: { skuId: string; skuDesc: string; amount: number }[];
    totalCost: number;
    machineUsage: { [key: string]: number };
    capacities: { [machineId: string]: { base: number; total: number } };
    breakdown: {
        productionCost: number;
        overtimeCost: number;
        peakPowerCost: number;
    };
}

export interface PlannerOptimizationResult {
    scenarioName: string;
    allocations: PlannerProductionResult[];
    unmetDemand: { skuId: string; skuDesc: string; amount: number }[];
    totalCost: number;
    breakdown: {
        productionCost: number;
        overtimeCost: number;
        peakPowerCost: number;
    };
    machineUsage: { [key: string]: number };
    totalCapacity: { [key: string]: number };
    baseCapacity: { [key: string]: number };
    monthlyResults: PlannerMonthlyResult[];
    rawInputs: {
        costs: { [sku: string]: { [machine: string]: number } };
        times: { [sku: string]: { [machine: string]: number } };
        compatibility: { [sku: string]: { [machine: string]: number } };
    };
}

export interface PlannerExcelData {
    Demanda: any[];
    Periodos: any[];
    Tiempos: any[];
    Compatibilidad: any[];
    Costos: any[];
}

export type OptimizationMode = 'smart' | 'force_peak' | 'base_only';
