---
name: Planificación Pro
description: Convierte una idea en un plan ejecutable por fases, con checklist, riesgos y entregables. Úsalo cuando haya que pasar de idea a acción sin improvisar.
---

# Planificación Pro

## Cuándo Usar Esta Habilidad

Activa esta skill cuando:
- El usuario pida un **plan paso a paso**, una estrategia o una hoja de ruta
- Haya que **entregar algo** (landing, vídeo, proyecto, lanzamiento) con tiempos
- El usuario tenga **muchas tareas sueltas** y quiera ordenarlas

## Inputs Necesarios

Si faltan alguno de estos datos, **pregunta primero** antes de planificar:

| Input | Descripción |
|-------|-------------|
| 🎯 **Resultado final** | ¿Qué significa "terminado"? |
| 📅 **Fecha límite/ritmo** | Hoy, esta semana, sin prisa |
| 🛠️ **Recursos disponibles** | Herramientas, equipo, presupuesto, tiempo diario |
| ✅ **Criterios de éxito** | ¿Qué debe cumplir para estar bien? |

## Workflow

### Paso 1: Definir Resultado Final
Escribe el resultado en **1 frase clara** y lista **3 criterios de éxito** medibles.

### Paso 2: Dividir en Fases (máximo 4)

| Fase | Propósito |
|------|-----------|
| **1. Preparación** | Reunir recursos, definir scope, configurar entorno |
| **2. Producción/Ejecución** | Crear el entregable principal |
| **3. Revisión/QA** | Validar calidad, corregir errores, iterar |
| **4. Publicación/Entrega** | Lanzar, comunicar, cerrar el proyecto |

### Paso 3: Detallar Cada Fase

Para cada fase incluir:
- ✅ **Tareas en orden** (secuencia lógica)
- 📦 **Entregable claro** (qué sale de esa fase)
- ⏱️ **Tiempo estimado** por tarea (aproximado)

### Paso 4: Riesgos y Mitigación

Identificar **3–5 riesgos** con formato:
> Si pasa **X** → hago **Y**

### Paso 5: Checklist Final

Lista de verificación antes de dar por terminado el proyecto.

## Reglas de Calidad

> [!IMPORTANT]
> Estas reglas son obligatorias para mantener planes ejecutables.

- ⚡ **Evita planes infinitos**: prioriza lo que desbloquea lo siguiente
- 🔗 Si hay **dependencias**, indícalas ("esto depende de X")
- 🌱 Si el usuario es **principiante**: reduce pasos y da opciones simples
- 🚀 Si el usuario es **avanzado**: incluye optimizaciones y atajos

## Formato de Output

Devuelve siempre en este orden exacto:

```
## 🎯 Resultado Final

**Objetivo:** [1 frase clara]

**Criterios de éxito:**
1. [Criterio medible 1]
2. [Criterio medible 2]
3. [Criterio medible 3]

---

## 📋 Plan por Fases

### Fase 1: Preparación
| # | Tarea | Tiempo | Dependencia |
|---|-------|--------|-------------|
| 1.1 | [Tarea] | 30min | - |
| 1.2 | [Tarea] | 1h | 1.1 |

📦 **Entregable:** [Qué se obtiene al terminar esta fase]

---

### Fase 2: Producción/Ejecución
| # | Tarea | Tiempo | Dependencia |
|---|-------|--------|-------------|
| 2.1 | [Tarea] | 2h | Fase 1 |
...

📦 **Entregable:** [Qué se obtiene]

---

### Fase 3: Revisión/QA
...

### Fase 4: Publicación/Entrega
...

---

## ⚠️ Riesgos y Mitigación

| Riesgo | Si pasa... | Hago... |
|--------|-----------|---------|
| [Riesgo 1] | X ocurre | Plan B específico |
| [Riesgo 2] | Y falla | Alternativa concreta |
...

---

## ✅ Checklist Final

Antes de dar por terminado, verifica:

- [ ] [Verificación 1]
- [ ] [Verificación 2]
- [ ] [Verificación 3]
- [ ] [Verificación 4]
- [ ] [Verificación 5]
```

## Ejemplo de Uso

**Usuario:** "Necesito lanzar una landing page para mi curso la próxima semana"

**Agente (primero aclara):**
> Antes de crear el plan, confirmo:
> 1. ¿Qué debe incluir la landing (vídeo, testimonios, FAQs)?
> 2. ¿Ya tienes el copy/textos o hay que crearlos?
> 3. ¿Usarás WordPress, Webflow, o código custom?
> 4. ¿Cuál es el día exacto de lanzamiento?

Luego genera el plan completo con fases, tiempos y checklist.

---

## Adaptación por Nivel de Usuario

### Para Principiantes 🌱
- Máximo 3 fases
- Tareas más detalladas con ejemplos
- Incluir recursos/tutoriales sugeridos
- Tiempos generosos con buffer

### Para Avanzados 🚀
- Incluir optimizaciones y automatizaciones
- Mencionar atajos y herramientas pro
- Tiempos ajustados con paralelización
- Métricas de seguimiento sugeridas

---

> **Nota**: Esta skill prioriza **planes ejecutables** sobre planes perfectos. Si el usuario necesita más detalle en una fase específica, puede pedir "expandir Fase 2" o "más detalle en tareas de QA".
