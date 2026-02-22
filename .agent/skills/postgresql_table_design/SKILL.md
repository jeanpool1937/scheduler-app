---
name: PostgreSQL Table Design
description: Design a PostgreSQL-specific schema. Covers best-practices, data types, indexing, constraints, performance patterns, and advanced features.
---

# PostgreSQL Table Design

## Core Rules

- Define a **PRIMARY KEY** for reference tables (users, orders, etc.). Not always needed for time-series/event/log data. When used, prefer `BIGINT GENERATED ALWAYS AS IDENTITY`; use `UUID` only when global uniqueness/opacity is needed.
- **Normalize first (to 3NF)** to eliminate data redundancy and update anomalies; denormalize **only** for measured, high-ROI reads where join performance is proven problematic.
- Add **NOT NULL** everywhere it's semantically required; use **DEFAULT**s for common values.
- Create **indexes for access paths you actually query**: PK/unique (auto), **FK columns (manual!)**, frequent filters/sorts, and join keys.
- Prefer **TIMESTAMPTZ** for event time; **NUMERIC** for money; **TEXT** for strings; **BIGINT** for integer values.

## PostgreSQL "Gotchas"

| Gotcha | Explanation |
|--------|-------------|
| **Identifiers** | Unquoted → lowercased. Avoid quoted/mixed-case. Use `snake_case` |
| **Unique + NULLs** | UNIQUE allows multiple NULLs. Use `NULLS NOT DISTINCT` (PG15+) |
| **FK indexes** | PostgreSQL **does not** auto-index FK columns. Add them manually! |
| **No silent coercions** | Length/precision overflows error out (no truncation) |
| **Sequences have gaps** | Normal behavior—don't try to fix consecutive IDs |
| **Heap storage** | No clustered PK by default; `CLUSTER` is one-off |
| **MVCC** | Updates/deletes leave dead tuples; vacuum handles them |

## Data Types

### Recommended Types

| Purpose | Type | Notes |
|---------|------|-------|
| **IDs** | `BIGINT GENERATED ALWAYS AS IDENTITY` | `UUID` only for distributed/opaque IDs |
| **Integers** | `BIGINT` | `INTEGER` for smaller ranges |
| **Floats** | `DOUBLE PRECISION` | `NUMERIC` for exact decimal arithmetic |
| **Strings** | `TEXT` | Use `CHECK (LENGTH(col) <= n)` if needed |
| **Money** | `NUMERIC(p,s)` | Never float! |
| **Time** | `TIMESTAMPTZ` | `DATE` for date-only; `INTERVAL` for durations |
| **Booleans** | `BOOLEAN NOT NULL` | Unless tri-state required |
| **Enums** | `CREATE TYPE ... AS ENUM` | For small, stable sets only |
| **Arrays** | `TEXT[]`, `INTEGER[]` | Index with GIN for containment queries |
| **Ranges** | `daterange`, `numrange`, `tstzrange` | Index with GiST |
| **JSON** | `JSONB` | Index with GIN; avoid plain JSON |
| **Vectors** | `vector` (pgvector) | For embeddings similarity search |

### Do NOT Use

| ❌ Avoid | ✅ Use Instead |
|----------|---------------|
| `timestamp` (without tz) | `timestamptz` |
| `char(n)` or `varchar(n)` | `text` |
| `money` type | `numeric` |
| `timetz` | `timestamptz` |
| `timestamptz(0)` | `timestamptz` |
| `serial` | `generated always as identity` |

## Constraints

| Constraint | Behavior |
|------------|----------|
| **PK** | Implicit UNIQUE + NOT NULL; creates B-tree index |
| **FK** | Specify `ON DELETE/UPDATE` action. **Add index manually!** |
| **UNIQUE** | Creates B-tree; allows multiple NULLs unless `NULLS NOT DISTINCT` |
| **CHECK** | Row-local; NULL values pass. Combine with `NOT NULL` |
| **EXCLUDE** | Prevents overlapping values. Use with GiST |

## Indexing

| Type | Use Case |
|------|----------|
| **B-tree** | Default for `=`, `<`, `>`, `BETWEEN`, `ORDER BY` |
| **Composite** | Order matters! Leftmost prefix required |
| **Covering** | `INCLUDE (cols)` for index-only scans |
| **Partial** | `WHERE status = 'active'` for hot subsets |
| **Expression** | `CREATE INDEX ON tbl (LOWER(email))` |
| **GIN** | JSONB, arrays, full-text search |
| **GiST** | Ranges, geometry, exclusion constraints |
| **BRIN** | Very large, naturally ordered data |

## Partitioning

Use for very large tables (>100M rows) with consistent filter on partition key.

| Strategy | Use Case |
|----------|----------|
| **RANGE** | Time-series: `PARTITION BY RANGE (created_at)` |
| **LIST** | Discrete values: `PARTITION BY LIST (region)` |
| **HASH** | Even distribution: `PARTITION BY HASH (user_id)` |

> **Limitations**: No global UNIQUE—include partition key in PK/UNIQUE.

## Special Considerations

### Update-Heavy Tables
- Separate hot/cold columns into different tables
- Use `fillfactor=90` for HOT updates
- Avoid updating indexed columns

### Insert-Heavy Workloads
- Minimize indexes—only create what you query
- Use `COPY` or multi-row `INSERT`
- Consider `UNLOGGED` tables for staging
- Partition by time/hash to distribute load

### Upsert-Friendly Design
- Requires UNIQUE index on conflict target
- Use `EXCLUDED.column` to reference would-be values
- `DO NOTHING` faster than `DO UPDATE` when no update needed

### Safe Schema Evolution
- **Transactional DDL**: Most DDL can run in transactions
- **Concurrent indexes**: `CREATE INDEX CONCURRENTLY` avoids blocking
- **Volatile defaults**: Adding `NOT NULL` with `now()` rewrites entire table

## JSONB Guidance

```sql
-- Default GIN index for containment/existence
CREATE INDEX ON tbl USING GIN (jsonb_col);

-- Accelerates: @>, ?, ?|, ?&
-- For heavy @> only: use jsonb_path_ops (smaller, faster)
CREATE INDEX ON tbl USING GIN (jsonb_col jsonb_path_ops);

-- Extract scalar for B-tree range queries
ALTER TABLE tbl ADD COLUMN price INT 
  GENERATED ALWAYS AS ((jsonb_col->>'price')::INT) STORED;
CREATE INDEX ON tbl (price);
```

## Row-Level Security

```sql
ALTER TABLE tbl ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_access ON orders 
  FOR SELECT TO app_users 
  USING (user_id = current_user_id());
```

## Extensions

| Extension | Purpose |
|-----------|---------|
| **pgcrypto** | Password hashing with `crypt()` |
| **pg_trgm** | Fuzzy text search with `%`, `similarity()` |
| **citext** | Case-insensitive text type |
| **timescaledb** | Time-series: auto-partitioning, compression |
| **postgis** | Comprehensive geospatial support |
| **pgvector** | Vector similarity search for embeddings |
| **pgaudit** | Audit logging |

## Examples

### Users Table

```sql
CREATE TABLE users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON users (LOWER(email));
CREATE INDEX ON users (created_at);
```

### Orders Table

```sql
CREATE TABLE orders (
  order_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  status TEXT NOT NULL DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING','PAID','CANCELED')),
  total NUMERIC(10,2) NOT NULL CHECK (total > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON orders (user_id);  -- FK index!
CREATE INDEX ON orders (created_at);
```

### JSONB with Generated Column

```sql
CREATE TABLE profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(user_id),
  attrs JSONB NOT NULL DEFAULT '{}',
  theme TEXT GENERATED ALWAYS AS (attrs->>'theme') STORED
);
CREATE INDEX profiles_attrs_gin ON profiles USING GIN (attrs);
```

---

> **Nota**: Esta skill cubre PostgreSQL específicamente. Para otros RDBMS, adaptar sintaxis y características.
