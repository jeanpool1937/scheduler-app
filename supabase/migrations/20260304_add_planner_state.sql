-- migrations/20260304_add_planner_state.sql
-- Descripción: Tabla para persistir el estado del Planificador LP.

BEGIN;

CREATE TABLE IF NOT EXISTS scheduler_planner_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    raw_tsv_data TEXT,
    parsed_data JSONB,
    results_a JSONB,
    results_b JSONB,
    results_c JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Aseguramos que sólo exista un registro
ALTER TABLE scheduler_planner_state ADD CONSTRAINT single_row CHECK (id = 1);

-- Insertar fila inicial vacía si no existe
INSERT INTO scheduler_planner_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE scheduler_planner_state ENABLE ROW LEVEL SECURITY;

-- Política de lectura/escritura pública (entorno desarrollo/internos)
CREATE POLICY "Permitir todo a scheduler_planner_state" ON scheduler_planner_state FOR ALL USING (true);

COMMIT;
