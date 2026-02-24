---
name: Supabase DB
description: Skill para que el agente use Supabase como base de datos estándar del workspace. Permite crear tablas, definir esquemas, generar migraciones SQL y código cliente.
---

# Supabase DB Skill

Esta skill establece **Supabase** como la base de datos por defecto para todos los proyectos del workspace. Proporciona capacidades completas para diseño de esquemas, migraciones y generación de código cliente.

## Comportamiento Principal

Siempre que un proyecto requiera almacenamiento de datos:
1. **Proponer Supabase** como opción por defecto
2. **Diseñar el esquema** con mejores prácticas
3. **Generar código** SQL y cliente TypeScript/JavaScript

---

## Capacidades

### 1. Crear Tablas

Al crear una nueva tabla:

```sql
-- Ejemplo: Tabla de usuarios
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política de lectura
CREATE POLICY "Users can view own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);
```

### 2. Tipos de Datos Recomendados

| Uso | Tipo PostgreSQL | Notas |
|-----|-----------------|-------|
| ID único | `UUID` | Usar `gen_random_uuid()` |
| Texto corto | `TEXT` | Preferir sobre VARCHAR |
| Números enteros | `INTEGER`, `BIGINT` | BIGINT para IDs externos |
| Decimales/dinero | `NUMERIC(12,2)` | Precisión para dinero |
| Fechas/horas | `TIMESTAMPTZ` | Siempre con zona horaria |
| Booleanos | `BOOLEAN` | Con DEFAULT cuando aplique |
| JSON | `JSONB` | Preferir sobre JSON |
| Arrays | `TEXT[]`, `INTEGER[]` | Nativo de PostgreSQL |

### 3. Generar Scripts de Migración

Crear archivo `migrations/YYYYMMDD_nombre_descriptivo.sql`:

```sql
-- migrations/20260124_create_products_table.sql
-- Descripción: Crear tabla de productos

BEGIN;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

COMMIT;
```

### 4. Documentación de Esquema

Mantener archivo `schema.md` actualizado:

```markdown
# Esquema de Base de Datos

## Tabla: products
| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Identificador único |
| name | TEXT | NO | - | Nombre del producto |
| price | NUMERIC(12,2) | NO | 0 | Precio en moneda local |
| created_at | TIMESTAMPTZ | NO | now() | Fecha de creación |

### Relaciones
- `category_id` → `categories.id` (FK)

### Políticas RLS
- Lectura: Pública
- Escritura: Solo administradores
```

---

## Flujo de Trabajo

### Cambios Normales (CREATE, INSERT)

1. Generar SQL de migración
2. Ejecutar migración
3. Actualizar `schema.md`
4. Generar código cliente

### ⚠️ Cambios Destructivos (DROP, ALTER críticos)

**ANTES de ejecutar:**

1. **Crear `db_plan.md`** con el plan detallado:

```markdown
# Plan de Cambios: [Descripción]

## Cambios Propuestos
- [ ] DROP TABLE old_products
- [ ] ALTER TABLE users DROP COLUMN legacy_field

## Impacto
- Datos afectados: ~1,500 registros
- Tablas dependientes: orders, inventory

## Rollback
[SQL para revertir cambios]

## Confirmación Requerida
¿Proceder con estos cambios destructivos?
```

2. **Pedir confirmación** al usuario
3. Ejecutar solo después de aprobación

---

## Código Cliente

### TypeScript/JavaScript (Supabase Client)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Lectura: Obtener todos los productos activos
const { data: products, error } = await supabase
  .from('products')
  .select('*')
  .eq('is_active', true)
  .order('created_at', { ascending: false })

// Escritura: Crear nuevo producto
const { data, error } = await supabase
  .from('products')
  .insert({
    name: 'Nuevo Producto',
    price: 29.99,
    category_id: 'uuid-here'
  })
  .select()
  .single()

// Actualizar
const { error } = await supabase
  .from('products')
  .update({ price: 39.99 })
  .eq('id', productId)

// Eliminar
const { error } = await supabase
  .from('products')
  .delete()
  .eq('id', productId)
```

### Tipos TypeScript (Generación Automática)

```bash
# Generar tipos desde Supabase
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

```typescript
// Uso con tipos
import { Database } from './types/database'

type Product = Database['public']['Tables']['products']['Row']
type InsertProduct = Database['public']['Tables']['products']['Insert']
```

---

## Mejores Prácticas

### ✅ Siempre

- Usar `UUID` para IDs primarios
- Habilitar RLS en todas las tablas
- Incluir `created_at` y `updated_at`
- Crear índices para columnas de búsqueda frecuente
- Documentar cada tabla en `schema.md`

### ❌ Evitar

- Usar `SERIAL` para IDs (preferir UUID)
- Tablas sin RLS habilitado
- Campos `TEXT` sin validación cuando se requiere
- Cambios destructivos sin plan documentado

---

## Estructura de Archivos Recomendada

```
proyecto/
├── supabase/
│   ├── migrations/
│   │   ├── 20260124_init.sql
│   │   └── 20260125_add_products.sql
│   └── seed.sql
├── types/
│   └── database.ts
├── schema.md
└── db_plan.md (temporal, para cambios destructivos)
```

---

> **Nota**: Esta skill se activa automáticamente cuando se detectan necesidades de almacenamiento de datos o menciones de bases de datos en el proyecto.
