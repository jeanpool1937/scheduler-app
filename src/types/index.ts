
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
  ringChangeMinutes?: number; // Calculated: Daily at 18:30 if no >60min stoppage in prev 7h
  channelChangeMinutes?: number; // Calculated: Daily at 6:30 AM
  adjustmentMinutes?: number; // Acierto y Calibracion

  // Dynamic Stoppages: key is stoppageId, value is minutes
  stoppages: Record<string, number>;

  startTime: Date;
  endTime: Date;

  // Simulation Results
  computedStart?: Date;
  computedEnd?: Date;
  segments?: {
    type: 'production' | 'setup' | 'maintenance_hp' | 'forced_stop';
    start: Date;
    end: Date;
    durationMinutes: number;
    label: string;
    description: string;
    color: string;
  }[];
}

export interface AppState {
  schedule: ProductionScheduleItem[];
  stoppageConfigs: StoppageConfig[];
  programStartDate: Date;
  columnLabels: Record<string, string>; // Custom column labels
  scheduleHistory: ProductionScheduleItem[][]; // Undo history (max 5)
  holidays: string[]; // Array of ISO date strings (YYYY-MM-DD)

  // Actions
  addScheduleItem: (item: Omit<ProductionScheduleItem, 'id' | 'sequenceOrder'>) => void;
  updateScheduleItem: (id: string, updates: Partial<ProductionScheduleItem>) => void;
  deleteScheduleItem: (id: string) => void;
  reorderSchedule: (newOrder: ProductionScheduleItem[]) => void;
  recalculateSchedule: () => void;
  setProgramStartDate: (date: Date) => void;
  undo: () => void;
  canUndo: () => boolean;
  // Column Labels
  setColumnLabel: (field: string, label: string) => void;

  // Import/Export
  setSchedule: (schedule: ProductionScheduleItem[]) => void;
  setStoppageConfigs: (configs: StoppageConfig[]) => void;
  importColumnLabels: (labels: Record<string, string>) => void;

  // Holidays Management
  addHoliday: (date: string) => void;
  removeHoliday: (date: string) => void;
  isHoliday: (date: Date) => boolean;
}
