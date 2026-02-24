---
name: Modo Producción
description: Revisa una app/landing, detecta problemas típicos, propone mejoras y aplica correcciones con un checklist fijo para dejarlo listo para enseñar o publicar.
---

# Modo Producción (QA + Fix)

## Cuándo Usar Esta Habilidad

Activa esta skill cuando:
- Ya tienes algo generado (landing/app) y quieres dejarlo **"presentable"**
- Algo funciona **"a medias"** (móvil raro, imágenes rotas, botones sin acción, espaciados feos)
- Antes de **enseñarlo a un cliente**, grabarlo o publicarlo

## Inputs Necesarios

Si faltan alguno de estos datos, **pregunta primero**:

| Input | Descripción |
|-------|-------------|
| 📁 **Archivo principal** | Ruta del archivo (ej: `index.html` o carpeta del proyecto) |
| 🎯 **Objetivo de revisión** | "Lista para enseñar" o "Lista para publicar" |
| 🚫 **Restricciones** | No cambiar branding / copy / estructura, etc. |

## Checklist de Calidad (Orden Fijo)

### A) Funciona y Se Ve
- [ ] Abre la preview/localhost sin errores
- [ ] Imágenes cargan y no hay rutas rotas
- [ ] Tipografías y estilos se aplican correctamente

### B) Responsive (Móvil Primero)
- [ ] Se ve bien en móvil (no se corta, no hay scroll horizontal)
- [ ] Botones y textos tienen tamaños legibles
- [ ] Secciones con espaciado coherente

### C) Copy y UX Básica
- [ ] Titular claro y coherente con la propuesta
- [ ] CTAs consistentes (mismo verbo, misma intención)
- [ ] No hay texto "placeholder" tipo lorem ipsum

### D) Accesibilidad Mínima
- [ ] Contraste razonable en textos
- [ ] Imágenes con atributo `alt`
- [ ] Estructura de headings (`h1`, `h2`) lógica

## Workflow

### Paso 1: Diagnóstico Rápido
Lista de problemas en **5–10 bullets** priorizados por impacto.

### Paso 2: Plan de Arreglos
Definir **máximo 8 cambios** con formato:
> Qué cambio → Por qué

### Paso 3: Aplicar Cambios
Modificar los archivos necesarios directamente.

### Paso 4: Validación
Volver a abrir preview y confirmar checklist completo.

### Paso 5: Resumen Final
- ✅ Cambios hechos
- 💡 Mejoras opcionales pendientes

## Reglas

> [!IMPORTANT]
> Reglas obligatorias durante la revisión.

- 🎨 **No cambies el estilo de marca** si existe una skill de marca activa (como `brand-identity`)
- ⚡ **No rehagas todo**: corrige lo mínimo para ganar calidad rápido
- 📖 Si hay conflicto entre "bonito" y "claro", **prioriza claridad**

## Formato de Output

Devuelve siempre en este orden exacto:

```
## 🔍 Diagnóstico

**Archivo revisado:** `[ruta/archivo]`
**Objetivo:** [Enseñar / Publicar]

### Problemas detectados (priorizados)
1. 🔴 [Crítico] Descripción del problema
2. 🟠 [Medio] Descripción del problema
3. 🟡 [Menor] Descripción del problema
...

---

## 🔧 Cambios Aplicados

| # | Cambio | Archivo | Por qué |
|---|--------|---------|---------|
| 1 | [Descripción corta] | `archivo.ext` | [Razón] |
| 2 | [Descripción corta] | `archivo.ext` | [Razón] |
...

---

## ✅ Checklist Validado

### A) Funciona y Se Ve
- [x] Preview sin errores
- [x] Imágenes cargan
- [x] Estilos aplicados

### B) Responsive
- [x] Móvil OK
- [x] Tamaños legibles
- [x] Espaciado coherente

### C) Copy y UX
- [x] Titular claro
- [x] CTAs consistentes
- [x] Sin lorem ipsum

### D) Accesibilidad
- [x] Contraste OK
- [x] Alts en imágenes
- [x] Headings lógicos

---

## 📋 Resultado

**Estado:** ✅ OK para [enseñar/publicar]

### Mejoras opcionales (no críticas)
- 💡 [Sugerencia 1]
- 💡 [Sugerencia 2]
```

## Niveles de Prioridad

| Icono | Nivel | Criterio |
|-------|-------|----------|
| 🔴 | Crítico | Bloquea uso o da mala impresión inmediata |
| 🟠 | Medio | Afecta UX pero no bloquea |
| 🟡 | Menor | Mejora opcional, pulido |

## Ejemplo de Uso

**Usuario:** "Revisa mi landing antes de la demo de mañana"

**Agente (primero aclara):**
> Antes de revisar:
> 1. ¿Cuál es el archivo principal? (`index.html`?)
> 2. ¿El objetivo es "lista para enseñar" o "lista para publicar"?
> 3. ¿Algo que NO deba tocar? (copy, colores, estructura)

Luego ejecuta diagnóstico → cambios → validación → resumen.

---

## Integración con Otras Skills

- Si existe **brand-identity**: respetar tokens de color, tipografía y tono
- Si existe **planificacion-pro**: los arreglos pueden convertirse en tareas pendientes
- Si existe **brainstorming-pro**: sugerir alternativas para mejoras opcionales

---

> **Nota**: Esta skill prioriza **velocidad y calidad mínima viable**. Si el usuario quiere un QA más profundo (SEO, performance, seguridad), debe solicitarlo explícitamente.
