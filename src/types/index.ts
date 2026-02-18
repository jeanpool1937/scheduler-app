
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

export type ProcessId = 'laminador1' | 'laminador2' | 'laminador3';

export interface DaySchedule {
  /** Si el día está activo (opera) */
  active: boolean;
  /** Horas de operación este día (1-24). 24 = continuo */
  hours: number;
  /** Hora de inicio de operación (0-23) */
  startHour: number;
  /** Minuto de inicio de operación (0-59) */
  startMinute: number;
}

export interface WorkSchedule {
  /** Modo rápido: true = 24h/7d sin restricciones */
  is24h: boolean;
  /** Configuración por día: clave = getDay() (0=Dom ... 6=Sáb) */
  days: Record<number, DaySchedule>;
}

export interface ProcessConfig {
  id: ProcessId;
  name: string;
  label: string; // Display name
  description?: string;
}

export type SegmentType =
  | 'production'
  | 'changeover'        // R1: Cambio de medida (duración de matriz)
  | 'adjustment'        // R4: Acierto/Calibración (siempre con cambio de medida)
  | 'quality_change'    // R2: Cambio de calidad (60 min)
  | 'stop_change'       // R3: Cambio de tope (10 min)
  | 'ring_change'       // R5: Cambio de anillo (18:30 diario)
  | 'channel_change'    // R6: Cambio de canal (06:30 diario)
  | 'maintenance_hp'    // R7: Hora punta (18:30-20:30 L-V)
  | 'forced_stop'       // Paradas manuales
  | 'off_shift';        // Fuera de turno (horas inactivas)

export interface ManualStop {
  id: string;
  start: Date;
  durationMinutes: number;
  label: string;
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
    type: SegmentType;
    start: Date;
    end: Date;
    durationMinutes: number;
    label: string;
    description: string;
    color: string;
  }[];
}

// ... imports

export interface ProcessData {
  schedule: ProductionScheduleItem[];
  stoppageConfigs: StoppageConfig[];
  programStartDate: Date;
  columnLabels: Record<string, string>;
  scheduleHistory: ProductionScheduleItem[][];
  holidays: string[];
  manualStops: ManualStop[];
  workSchedule: WorkSchedule;

  // Navigation/Visual State specific to process
  visualTargetDate: Date | null;
}

export interface AppState {
  // Global State
  activeProcessId: ProcessId;
  processes: Record<ProcessId, ProcessData>;

  // Actions (global)
  setActiveProcess: (id: ProcessId) => void;
  setActiveTab: (tab: 'scheduler' | 'visual' | 'database' | 'settings') => void;
  setVisualTargetDate: (date: Date | null) => void;

  // Actions (delegated to active process)
  addScheduleItem: (item: Omit<ProductionScheduleItem, 'id' | 'sequenceOrder'>) => void;
  insertScheduleItem: (index: number, item: ProductionScheduleItem) => void;
  addScheduleItems: (items: ProductionScheduleItem[]) => void;
  updateScheduleItem: (id: string, updates: Partial<ProductionScheduleItem>) => void;
  updateItemEndTime: (id: string, targetEndDate: Date) => void;
  deleteScheduleItem: (id: string) => void;
  clearSchedule: () => void;
  reorderSchedule: (newOrder: ProductionScheduleItem[]) => void;
  recalculateSchedule: () => void;
  setProgramStartDate: (date: Date) => void;
  undo: () => void;
  canUndo: () => boolean;
  _saveSnapshot: () => void;

  // Stoppage Config
  addStoppageConfig: (config: StoppageConfig) => void;
  removeStoppageConfig: (id: string) => void;

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

  // Manual Stops
  addManualStop: (stop: ManualStop) => void;
  updateManualStop: (id: string, stop: Partial<ManualStop>) => void;
  deleteManualStop: (id: string) => void;
  setManualStops: (stops: ManualStop[]) => void;

  // Work Schedule
  setWorkSchedule: (schedule: WorkSchedule) => void;

  // UI State (Global)
  activeTab: 'scheduler' | 'visual' | 'database' | 'settings';
}
