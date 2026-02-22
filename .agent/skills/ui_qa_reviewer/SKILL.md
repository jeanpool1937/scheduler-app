---
name: UI-QA-Reviewer
description: Navega la app completa, prueba cada pestaña/sección, valida datos mostrados vs BD, detecta errores de conexión/cálculos y genera un reporte con issues y mejoras.
---

# UI-QA-Reviewer

Skill de auditoría QA automatizada para aplicaciones web. Navega la interfaz completa, inspecciona DOM, valida datos contra BD, prueba funcionalidades y genera un reporte detallado con evidencia visual.

## Cuándo Usar Esta Habilidad

Activa esta skill cuando:
- Se pida una **auditoría QA** o **revisión funcional** de la aplicación
- Antes de un **deploy a producción** o una **demo**
- Se sospeche de **errores de cálculos**, datos inconsistentes o problemas de UI
- Se quiera verificar que **cambios recientes** no rompieron funcionalidad existente
- Se use el comando `/ui-qa-review`

## Inputs Necesarios

Si faltan estos datos, **pregunta primero**:

| Input | Descripción | Default |
|-------|-------------|---------|
| 🌐 **URL** | URL de la app a revisar | `http://localhost:5173` |
| 🔐 **Credenciales** | Login de acceso (si aplica) | `PCP2026` |
| 🎯 **Alcance** | `all` o lista de secciones específicas | `all` |
| 📊 **Proyecto Supabase** | ID del proyecto para validación BD | `nvrcsheavwwrcukhtvcw` |

## Herramientas Requeridas

| Herramienta | Uso |
|-------------|-----|
| **Browser MCP** (`browser_subagent`) | Navegación, clics, scrolls, captura de screenshots, lectura de DOM, grabación de video |
| **Terminal** (`run_command`) | Ejecución de queries BD, chequeo de logs, verificaciones de proceso |
| **Code Review** (`view_file`, `grep_search`) | Inspección de queries JS/TS, validación de fórmulas en código fuente |
| **Supabase MCP** (`execute_sql`, `list_tables`) | Consultas directas a BD para comparar datos mostrados vs almacenados |

## Mapa de la Aplicación (Laminación Scheduler)

### Pestañas y Componentes

| # | Pestaña | `data-testid` | Componente Principal | Qué Validar |
|---|---------|---------------|----------------------|--------------|
| 1 | Secuenciador | `nav-item-sequencer` | `ProductionSequencer.tsx` | Escenarios de optimización, gráfico tradeoff, tabla de resultados, costos |
| 2 | Plan Mensual | `nav-item-scheduler` | `ProductionScheduler.tsx` + `KPIDashboard.tsx` | KPIs (OEE, utilización), tabla AG Grid, cálculos de tiempos, paradas |
| 3 | Secuencia Diaria | `nav-item-visual` | `VisualSchedule.tsx` | Gantt diario, filtro hora punta, bloques de producción con colores |
| 4 | Base de Datos | `nav-item-database` | `DatabaseLayout.tsx` → `ArticleMaster.tsx` + `ChangeoverMaster.tsx` | Maestro artículos, matriz cambios, CRUD funcional |
| 5 | Configuración | `nav-item-settings` | `SettingsPanel.tsx` → `HolidayConfig.tsx` + `ManualStopsConfig.tsx` + `WorkScheduleConfig.tsx` | Feriados, paradas manuales, horarios de trabajo |

### Stores (Zustand)

| Store | Archivo | Datos Clave |
|-------|---------|-------------|
| Principal | `useStore.ts` | Órdenes, secuencia, cálculos de tiempo, paradas |
| Artículos | `useArticleStore.ts` | Maestro de artículos, velocidades, calibraciones |
| Cambios | `useChangeoverStore.ts` | Matriz de tiempos de cambio |
| SAP | `useSapStore.ts` | Datos sincronizados desde SAP |

### Selector de Proceso

La app tiene un `ProcessSelector` en el header que cambia el contexto (laminador activo). Validar que **al cambiar de proceso**, los datos se recarguen correctamente.

---

## Checklist de Calidad

### A) Navegación y Carga
- [ ] Todas las pestañas cargan sin errores
- [ ] No hay loaders infinitos (spinners > 10s)
- [ ] Sidebar funciona (expandir/colapsar)
- [ ] ProcessSelector cambia datos correctamente
- [ ] Transiciones entre pestañas son fluidas

### B) Datos y Tablas
- [ ] Tablas muestran datos (no vacías sin razón)
- [ ] Columnas visibles y con headers correctos
- [ ] Scroll horizontal/vertical funciona en tablas grandes
- [ ] Paginación o virtualización funciona (AG Grid)

### C) Cálculos y Fórmulas
- [ ] KPIs calculados correctamente (OEE, utilización, eficiencia)
- [ ] Totales suman correctamente (toneladas, horas, costos)
- [ ] Fechas y horas son coherentes (no fechas futuras imposibles)
- [ ] Tiempos de cambio aplican reglas de negocio correctas
- [ ] Costos de venta perdida y cambio son consistentes

### D) Formularios e Interacciones
- [ ] Formularios validan inputs (campos requeridos, rangos)
- [ ] Botones de acción funcionan (agregar, editar, eliminar)
- [ ] Filtros filtran correctamente
- [ ] Exports generan archivo (Excel/PDF) con datos correctos
- [ ] Modales abren y cierran correctamente

### E) Consola y Errores
- [ ] Sin errores en consola del navegador
- [ ] Sin warnings críticos (deprecations, memory leaks)
- [ ] Sin requests fallidos (4xx, 5xx) en Network tab
- [ ] Sin errores de CORS o autenticación

### F) Responsive y Visual
- [ ] Layout no se rompe en diferentes tamaños
- [ ] Textos no se truncan sin tooltip
- [ ] Gráficos/charts se renderizan completos
- [ ] Colores e iconos consistentes con identidad de marca

### G) Datos vs BD (Supabase)
- [ ] Datos mostrados coinciden con registros en BD
- [ ] Operaciones CRUD persisten correctamente
- [ ] Sincronización SAP refleja datos actualizados
- [ ] No hay datos huérfanos o referencias rotas

---

## Workflow de 7 Pasos

### Paso 1: Acceso y Verificación Inicial

1. Abrir la URL de la app en el browser
2. Verificar que la app carga sin errores
3. Capturar screenshot de la pantalla inicial
4. Registrar versión/commit visible (si aplica)

### Paso 2: Descubrimiento Dinámico de Secciones

1. Leer el DOM del sidebar para enumerar dinámicamente todas las pestañas disponibles
2. Extraer `data-testid` de cada `nav-item-*`
3. Crear lista ordenada de secciones a recorrer
4. Verificar que el `ProcessSelector` funciona (cambiar entre procesos disponibles)

### Paso 3: Inspección por Pestaña

Para **cada pestaña** descubierta:

1. **Navegar**: Click en el `data-testid` correspondiente
2. **Captura**: Screenshot de la vista completa
3. **Lectura DOM**: Extraer contenido de tablas, gráficos, KPIs, formularios
4. **Validar**:
   - Tablas: ¿Tienen datos? ¿Headers correctos? ¿Totales suman?
   - Gráficos: ¿Se renderizan? ¿Tienen datos?
   - KPIs: ¿Valores razonables? ¿No son NaN/undefined/0 sospechoso?
   - Fechas: ¿Formato correcto? ¿Rango lógico?
5. **Anotar**: Issues encontrados con severidad (🔴 Crítico / 🟠 Medio / 🟡 Menor)

### Paso 4: Validación contra BD

1. Usar Supabase MCP para listar tablas relevantes
2. Ejecutar queries SQL para obtener datos de referencia:
   - Contar registros en tablas maestras
   - Verificar últimas fechas de sincronización
   - Comparar totales (ej: suma de toneladas en BD vs mostrado en UI)
3. Comparar resultados SQL vs datos mostrados en la UI
4. Anotar discrepancias con evidencia (screenshot + query result)

### Paso 5: Pruebas Funcionales

1. **Formularios**: Intentar agregar/editar/eliminar registros
2. **Filtros**: Probar cada filtro disponible y verificar que reduce/cambia datos
3. **Exports**: Disparar exportación y verificar que se genera archivo
4. **Modales**: Abrir cada modal y verificar contenido
5. **Interacciones especiales**: Drag & drop (si hay), reordenamiento, selección múltiple

### Paso 6: Detección de Issues

1. **Consola**: Revisar errores y warnings en DevTools
2. **Network**: Verificar requests fallidos
3. **Performance**: Identificar operaciones lentas (> 3s)
4. **Cálculos**: Verificar fórmulas en código fuente (`grep_search` en componentes)
5. **Edge cases**: Qué pasa con datos vacíos, valores extremos, inputs inválidos

### Paso 7: Generación de Artefactos

1. **Walkthrough Video**: La grabación del browser_subagent se guarda automáticamente
2. **Screenshots**: Compilar capturas before/after en carpeta de artefactos
3. **Reporte Markdown**: Generar `walkthrough.md` con:
   - Resumen ejecutivo
   - Issues detectados (tabla priorizada)
   - Screenshots embebidos
   - Queries SQL ejecutados y resultados
   - Fixes propuestos para cada issue
   - Mejoras sugeridas

---

## Reglas de Ejecución

> [!IMPORTANT]
> Reglas obligatorias durante la revisión QA.

### Modo de Operación
- **Turbo Mode**: `SafeToAutoRun: true` para todos los comandos de lectura
- **Always Proceed**: No detenerte salvo errores bloqueantes (app no carga, BD inaccesible)
- **Grabación**: Cada `browser_subagent` genera un video automáticamente — nombrar descriptivamente

### Manejo de Errores
- Si **error de BD/conexión**: Captura screenshot + log del stacktrace + intenta reconectar 1 vez
- Si **error de consola JS**: Captura el error, identifica el archivo/línea, propone fix
- Si **loader infinito** (> 10s): Screenshot + anotar como 🔴 Crítico
- Si **cálculo erróneo**: Mostrar valor esperado vs obtenido con fórmula

### Output Final
- **SIEMPRE** terminar con resumen de issues y propuesta de fixes
- Priorizar issues por impacto al usuario

---

## Formato de Output (Reporte Final)

```markdown
## 🔍 Auditoría QA — [Nombre App]

**URL**: [url revisada]
**Fecha**: [timestamp]
**Alcance**: [all / secciones específicas]
**Proceso**: [laminador activo]

---

### 📊 Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| Pestañas revisadas | X/Y |
| Issues encontrados | 🔴 X · 🟠 Y · 🟡 Z |
| Pruebas funcionales | X pasadas / Y fallidas |
| Validaciones BD | X coinciden / Y discrepancias |

---

### 🐛 Issues Detectados

| # | Severidad | Pestaña | Descripción | Evidencia | Fix Propuesto |
|---|-----------|---------|-------------|-----------|---------------|
| 1 | 🔴 | [tab] | [descripción] | [screenshot] | [solución] |
| 2 | 🟠 | [tab] | [descripción] | [screenshot] | [solución] |

---

### ✅ Validaciones Exitosas

- [x] [Validación que pasó]
- [x] [Validación que pasó]

---

### 💡 Mejoras Sugeridas

1. [Mejora no crítica]
2. [Mejora no crítica]

---

### 📸 Evidencia Visual

[Screenshots embebidos por pestaña]

### 🗄️ Validación de Datos (BD)

[Queries ejecutados y resultados comparativos]
```

---

## Niveles de Severidad

| Icono | Nivel | Criterio | Acción |
|-------|-------|----------|--------|
| 🔴 | **Crítico** | Bloquea uso, datos erróneos, crash | Fix inmediato requerido |
| 🟠 | **Medio** | Afecta UX o muestra datos imprecisos | Fix antes de deploy |
| 🟡 | **Menor** | Cosmético o mejora opcional | Backlog |

---

## Integración con Otras Skills

| Skill | Integración |
|-------|-------------|
| `validacion_cambios` | Ejecutar después de aplicar fixes para verificar que los cambios funcionan |
| `modo_produccion` | Usar como complemento para revisión visual/responsive más profunda |
| `brand-identity` | Verificar consistencia de colores e identidad visual |
| `protocolo_resolucion_errores` | Usar para investigar errores complejos detectados durante QA |

---

## Ejemplo de Uso

**Usuario:** "Haz QA completo de mi app"

**Agente:**
1. Lee SKILL.md → Identifica herramientas y workflow
2. Abre browser en `http://localhost:5173`
3. Descubre pestañas dinámicamente
4. Recorre cada una capturando evidencia
5. Valida datos contra Supabase
6. Prueba formularios y filtros
7. Genera reporte `walkthrough.md` con issues, screenshots y fixes propuestos

> **Nota**: Esta skill es **más profunda** que `modo_produccion` — incluye validación de datos contra BD, pruebas funcionales y análisis de código. Usar `modo_produccion` para revisiones rápidas visuales.
