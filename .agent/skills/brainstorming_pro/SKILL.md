---
name: Brainstorming Pro
description: Genera ideas de calidad con estructura, filtros y selección final. Úsalo cuando necesites opciones creativas con criterio y una recomendación clara.
---

# Brainstorming Pro

## Cuándo Usar Esta Habilidad

Activa esta skill cuando:
- El usuario pida **ideas, variantes, conceptos, hooks, nombres, formatos o enfoques**
- Haya **bloqueo creativo** o demasiadas opciones y haga falta ordenar
- El usuario necesite ideas **"buenas para ejecutar"**, no solo ocurrencias

## Inputs Necesarios

Si faltan alguno de estos datos, **pregunta primero** antes de generar ideas:

| Input | Descripción |
|-------|-------------|
| 🎯 **Objetivo exacto** | ¿Qué se quiere conseguir? |
| 👥 **Público/contexto** | ¿Para quién es y dónde se usa? |
| ⚠️ **Restricciones** | Tiempo, presupuesto, tono, formato, herramientas |
| ✅❌ **Ejemplos** | Lo que SÍ y lo que NO quiere el usuario (opcional) |

## Workflow

### Paso 1: Aclarar el Encargo
Realiza **3–5 preguntas rápidas** solo si faltan datos esenciales. Sé directo.

### Paso 2: Generar Ideas en 4 Tandas

| Tanda | Cantidad | Enfoque |
|-------|----------|---------|
| **A) Rápidas** | 10 ideas | Claras y ejecutables de inmediato |
| **B) Diferentes** | 5 ideas | Ángulos no obvios, disruptivos |
| **C) Low Effort** | 5 ideas | Rápidas de producir, bajo costo |
| **D) High Impact** | 3 ideas | Más ambiciosas, mayor potencial |

### Paso 3: Filtrar y Puntuar

Evalúa cada idea con puntuación **1–5** en estos criterios:

| Criterio | ¿Qué mide? |
|----------|------------|
| **Impacto** | Resultado potencial alcanzable |
| **Claridad** | Facilidad de entender y comunicar |
| **Novedad** | Qué tan diferente/original es |
| **Esfuerzo** | Recursos necesarios (inverso: 5=fácil) |
| **Viabilidad** | Posibilidad real de ejecutar |

### Paso 4: TOP 5 Recomendado

Devuelve las **5 mejores ideas** con:
- **Idea** (1 línea)
- **Por qué funciona** (2 líneas)
- **Primer paso** (1 línea)

## Reglas de Calidad

> [!IMPORTANT]
> Estas reglas son obligatorias para mantener la calidad del output.

- ❌ **Nada de ideas genéricas** ("mejorar tu productividad"). Siempre concreta.
- 📝 Si piden **hooks/títulos**: cortos, con tensión y curiosidad.
- 🎬 Si piden **formatos**: incluir estructura + ejemplo del primer minuto.
- ⚠️ Si una idea depende de algo incierto: **dilo y ofrece alternativa**.

## Formato de Output

Devuelve siempre en este orden exacto:

```
## 🔍 Preguntas Rápidas
(Solo si faltan datos - omitir si todo está claro)

## 💡 Ideas

### A) Ideas Rápidas (10)
1. [Idea 1]
2. [Idea 2]
...

### B) Ideas Diferentes (5)
1. [Idea 1]
...

### C) Ideas Low Effort (5)
1. [Idea 1]
...

### D) Ideas High Impact (3)
1. [Idea 1]
...

## 🏆 TOP 5 Recomendado

| # | Idea | Impacto | Claridad | Novedad | Esfuerzo | Viabilidad | TOTAL |
|---|------|---------|----------|---------|----------|------------|-------|
| 1 | [Nombre corto] | 5 | 4 | 5 | 3 | 4 | 21 |
...

### 1. [Idea ganadora]
**Por qué funciona:** [2 líneas explicando el potencial]
**Primer paso:** [Acción concreta para empezar hoy]

### 2. [Segunda idea]
...
```

## Ejemplo de Uso

**Usuario:** "Necesito ideas para promocionar mi curso de productividad en redes sociales"

**Agente (primero aclara):**
> Antes de generar ideas, necesito confirmar:
> 1. ¿Cuál es el precio del curso y público objetivo (edad, profesión)?
> 2. ¿En qué redes sociales tienes presencia activa?
> 3. ¿Tienes presupuesto para ads o solo orgánico?
> 4. ¿Hay algo que hayas probado antes que NO funcionó?

Luego genera las 4 tandas de ideas y el TOP 5 con puntuación.

---

> **Nota**: Esta skill prioriza ideas **ejecutables** sobre creativas-pero-imposibles. Si el usuario quiere explorar más, puede pedir "más ideas tipo B" o "expandir la idea #3".
