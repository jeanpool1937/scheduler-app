-- migrations/20260218_init_scheduler.sql
-- Descripción: Inicialización de tablas para el secuenciador de laminación

BEGIN;

-- 1. Configuración de Procesos (Laminadores)
CREATE TABLE IF NOT EXISTS scheduler_process_configs (
    id TEXT PRIMARY KEY, -- 'laminador1', 'laminador2', 'laminador3'
    name TEXT NOT NULL,
    program_start_date TIMESTAMPTZ DEFAULT now(),
    work_schedule JSONB DEFAULT '{}',
    holidays JSONB DEFAULT '[]',
    column_labels JSONB DEFAULT '{}',
    visual_target_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar configuración inicial para los 3 laminadores si no existen
INSERT INTO scheduler_process_configs (id, name)
VALUES 
    ('laminador1', 'Laminador 1'),
    ('laminador2', 'Laminador 2'),
    ('laminador3', 'Laminador 3')
ON CONFLICT (id) DO NOTHING;

-- 2. Maestro de Artículos
CREATE TABLE IF NOT EXISTS scheduler_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id TEXT REFERENCES scheduler_process_configs(id) ON DELETE CASCADE,
    sku_laminacion TEXT,
    ending TEXT,
    codigo_programacion TEXT,
    descripcion TEXT,
    sku_palanquilla TEXT,
    calidad_palanquilla TEXT,
    ritmo_th NUMERIC,
    rendimiento_metalico NUMERIC,
    fam TEXT,
    acierto_calibracion NUMERIC,
    id_tabla_cambio_medida TEXT,
    peso_palanquilla NUMERIC,
    almacen_destino TEXT,
    comentarios TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Reglas de Cambio (Matriz de Tiempos)
CREATE TABLE IF NOT EXISTS scheduler_changeover_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id TEXT REFERENCES scheduler_process_configs(id) ON DELETE CASCADE,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    duration_hours NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ítems de Secuencia de Producción
CREATE TABLE IF NOT EXISTS scheduler_production_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id TEXT REFERENCES scheduler_process_configs(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    sku_code TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    stoppages JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Configuración de Tipos de Parada
CREATE TABLE IF NOT EXISTS scheduler_stoppage_configs (
    id TEXT PRIMARY KEY, -- 's1', 's2', etc.
    process_id TEXT REFERENCES scheduler_process_configs(id) ON DELETE CASCADE,
    col_id TEXT NOT NULL,
    label TEXT NOT NULL,
    default_duration NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Paradas Manuales
CREATE TABLE IF NOT EXISTS scheduler_manual_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id TEXT REFERENCES scheduler_process_configs(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    duration_minutes NUMERIC DEFAULT 0,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Opcional, pero recomendado por la skill)
ALTER TABLE scheduler_process_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_changeover_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_stoppage_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_manual_stops ENABLE ROW LEVEL SECURITY;

-- Políticas simples (Lectura y Escritura para todos por ahora, según entorno de desarrollo)
CREATE POLICY "Permitir todo a scheduler_process_configs" ON scheduler_process_configs FOR ALL USING (true);
CREATE POLICY "Permitir todo a scheduler_articles" ON scheduler_articles FOR ALL USING (true);
CREATE POLICY "Permitir todo a scheduler_changeover_rules" ON scheduler_changeover_rules FOR ALL USING (true);
CREATE POLICY "Permitir todo a scheduler_production_items" ON scheduler_production_items FOR ALL USING (true);
CREATE POLICY "Permitir todo a scheduler_stoppage_configs" ON scheduler_stoppage_configs FOR ALL USING (true);
CREATE POLICY "Permitir todo a scheduler_manual_stops" ON scheduler_manual_stops FOR ALL USING (true);

COMMIT;
