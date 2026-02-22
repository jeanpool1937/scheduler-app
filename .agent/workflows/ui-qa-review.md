---
description: Ejecuta una auditoría QA completa de la aplicación web — navega todas las pestañas, valida datos vs BD, prueba funcionalidades y genera reporte con issues y fixes.
---

# Workflow: UI QA Review

// turbo-all

## Pre-requisitos

- La aplicación debe estar corriendo (verificar con `curl http://localhost:5173` o la URL proporcionada)
- Si no está corriendo, ejecutar `npm run dev` en `d:\scheduler-app`
- Tener acceso al proyecto Supabase `nvrcsheavwwrcukhtvcw`

---

## Paso 1: Verificar que la App Está Corriendo

```
Ejecutar: curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
Esperado: 200
Si falla: Ejecutar `npm run dev` en d:\scheduler-app y esperar 5 segundos
```

Abrir el browser en la URL de la app. Capturar screenshot inicial.

---

## Paso 2: Descubrir Secciones Dinámicamente

Usar `browser_subagent` para:

1. Leer el sidebar (`.bg-white.border-r`) y extraer todos los `button[data-testid^="nav-item-"]`
2. Para cada botón, extraer:
   - `data-testid` (ej: `nav-item-sequencer`)
   - Texto visible (ej: "Secuenciador")
   - Estado activo/inactivo
3. Verificar el `ProcessSelector` en el header — listar procesos disponibles
4. Registrar la lista de secciones como variable del workflow

**Secciones esperadas:**

| data-testid | Label |
|-------------|-------|
| `nav-item-sequencer` | Secuenciador |
| `nav-item-scheduler` | Plan Mensual |
| `nav-item-visual` | Secuencia Diaria |
| `nav-item-database` | Base de Datos |
| `nav-item-settings` | Configuración |

---

## Paso 3: Recorrer Cada Pestaña

Para cada pestaña descubierta en el Paso 2, ejecutar un `browser_subagent` con `RecordingName` descriptivo:

### 3.1 — Secuenciador (`nav-item-sequencer`)
- Click en el botón de navegación
- Esperar a que cargue el contenido
- Capturar screenshot
- Leer DOM: buscar tablas de escenarios, gráfico SVG de tradeoff, cards de resultados
- Validar: ¿Hay escenarios calculados? ¿Los costos son numéricos y > 0? ¿El gráfico se renderiza?
- Anotar issues

### 3.2 — Plan Mensual (`nav-item-scheduler`)
- Click en el botón de navegación
- Esperar carga de KPIDashboard + tabla AG Grid
- Capturar screenshot
- Leer DOM: extraer valores de KPIs (OEE, utilización, eficiencia), contar filas en la tabla
- Validar: ¿KPIs son porcentajes válidos (0-100%)? ¿Tabla tiene órdenes? ¿Fechas son coherentes?
- Verificar que las paradas programadas aparecen (cambio medida, calidad, anillo, canal, hora punta)
- Anotar issues

### 3.3 — Secuencia Diaria (`nav-item-visual`)
- Click en el botón de navegación
- Esperar carga del Gantt visual
- Capturar screenshot
- Leer DOM: buscar bloques de producción con colores, eje temporal
- Validar: ¿Bloques no se superponen incorrectamente? ¿Filtro hora punta funciona?
- Probar navegación entre días (si hay controles prev/next)
- Anotar issues

### 3.4 — Base de Datos (`nav-item-database`)
- Click en el botón de navegación
- Esperar carga de tablas maestras
- Capturar screenshot
- Verificar: Maestro de Artículos carga con datos, Matriz de Cambios tiene valores
- Probar: Intentar agregar/editar un registro (sin guardar si es destructivo)
- Validar formularios: campos requeridos, validaciones de tipo
- Anotar issues

### 3.5 — Configuración (`nav-item-settings`)
- Click en el botón de navegación
- Esperar carga de panels de configuración
- Capturar screenshot
- Verificar: Feriados cargados, Paradas manuales listadas, Horarios de trabajo configurados
- Probar: Expandir/colapsar secciones, verificar que las listas se renderizan
- Anotar issues

---

## Paso 4: Validar Datos contra BD (Supabase)

Usando las herramientas de Supabase MCP con proyecto `nvrcsheavwwrcukhtvcw`:

1. **Listar tablas**: `list_tables` para obtener el esquema actual
2. **Contar registros maestros**:
   ```sql
   SELECT 'sap_maestro_articulos' as tabla, count(*) as registros FROM sap_maestro_articulos
   UNION ALL
   SELECT 'sap_ordenes_produccion', count(*) FROM sap_ordenes_produccion
   UNION ALL
   SELECT 'sap_stock_mb52', count(*) FROM sap_stock_mb52;
   ```
3. **Verificar últimas sincronizaciones**:
   ```sql
   SELECT table_name, MAX(updated_at) as ultima_sync
   FROM (
     SELECT 'sap_maestro_articulos' as table_name, max(created_at) as updated_at FROM sap_maestro_articulos
   ) sub
   GROUP BY table_name;
   ```
4. **Comparar datos UI vs BD**: Tomar un valor específico mostrado en la UI (ej: cantidad de órdenes) y verificar con SQL que coincide

Anotar discrepancias como issues 🔴 si los números no coinciden.

---

## Paso 5: Pruebas Funcionales

### 5.1 Filtros
- Usar el `ProcessSelector` para cambiar de proceso
- Verificar que los datos se actualizan en la pestaña activa
- Si hay filtros adicionales (fechas, estados), probarlos

### 5.2 Exports
- Buscar botones de exportación (Excel/PDF)
- Hacer click y verificar que se dispara descarga
- Si falla, anotar como 🟠

### 5.3 Formularios (solo lectura)
- Intentar abrir formularios de edición
- Verificar que los campos se llenan con datos existentes
- NO guardar cambios destructivos

### 5.4 Modales
- Abrir cada modal disponible
- Verificar que muestra contenido correcto
- Verificar que cierra correctamente (botón X, click fuera, Escape)

---

## Paso 6: Detección de Errores

### 6.1 Consola del Navegador
- En el browser_subagent, capturar errores de consola JavaScript
- Clasificar: Error vs Warning vs Info
- Anotar errores como issues

### 6.2 Inspección de Código
- Usar `grep_search` para buscar patrones problemáticos:
  ```
  Buscar en src/: console.error, catch, NaN, undefined, TODO, FIXME, HACK
  ```
- Verificar que las queries a Supabase tienen manejo de errores

### 6.3 Performance
- Identificar si alguna pestaña tarda más de 3 segundos en cargar
- Verificar que no hay re-renders excesivos (componentes que parpadean)

---

## Paso 7: Generar Reporte

1. Compilar todos los issues encontrados en una tabla priorizada
2. Para cada issue, proponer un fix concreto (archivo + cambio sugerido)
3. Generar `walkthrough.md` en el directorio de artefactos con:
   - Resumen ejecutivo
   - Tabla de issues con severidad
   - Screenshots embebidos
   - Resultados de validación BD
   - Fixes propuestos
   - Mejoras sugeridas
4. Listar los videos de grabación generados por cada `browser_subagent`

---

## Criterio de Éxito

| Criterio | Condición |
|----------|-----------|
| ✅ Completo | Todas las pestañas revisadas, BD validada, reporte generado |
| ⚠️ Parcial | Alguna pestaña no pudo revisarse (anotar razón) |
| ❌ Fallido | App no carga o BD inaccesible (escalar al usuario) |
