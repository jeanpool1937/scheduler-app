
export interface SkuMaster {
  id: string;
  code: string; // Codigo Producto
  name: string; // Descripcion
  pace: number; // Ritmo (ton/hora)
  yield: number; // Rendimiento (%)
  // Adding other fields from the excel image useful for context
  hoursCom1ra?: number;
  quality?: string;
  weight?: number;
}

export interface StoppageConfig {
  id: string;
  label: string;
  defaultDuration: number;
  colId: string; // For AG Grid column mapping
}

export interface ProductionScheduleItem {
  id: string;
  sequenceOrder: number;
  skuCode: string; // FK
  quantity: number; // Toneladas

  // Calculated
  calculatedPace: number;
  productionTimeMinutes: number;
  changeoverMinutes?: number; // Calculated from Changeover Matrix
  qualityChangeMinutes?: number; // Calculated: 60 mins if same measure but diff quality
  stopChangeMinutes?: number; // Calculated: 10 mins if same measure+quality but diff length
  adjustmentMinutes?: number; // Acierto y Calibracion

  // Dynamic Stoppages: key is stoppageId, value is minutes
  stoppages: Record<string, number>;

  startTime: Date;
  endTime: Date;
}

export interface AppState {
  schedule: ProductionScheduleItem[];
  stoppageConfigs: StoppageConfig[];

  // Actions

  updateScheduleItem: (id: string, updates: Partial<ProductionScheduleItem>) => void;
  addScheduleItem: (item: ProductionScheduleItem) => void;
  addScheduleItems: (items: ProductionScheduleItem[]) => void;
  deleteScheduleItem: (id: string) => void;
  clearSchedule: () => void;
  reorderSchedule: (newOrder: ProductionScheduleItem[]) => void;

  addStoppageConfig: (config: StoppageConfig) => void;
  removeStoppageConfig: (id: string) => void;

  recalculateSchedule: () => void;
}
