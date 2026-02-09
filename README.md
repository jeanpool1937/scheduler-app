# Scheduler App - Documentación y Especificaciones

## Descripción e Intencionalidad del Aplicativo

**"Laminación Scheduler"** es una herramienta estratégica diseñada para optimizar la planificación de la producción en la planta de laminación. Su propósito principal es transformar la complejidad de gestionar múltiples órdenes, restricciones de materiales y tiempos de preparación en una secuencia de producción eficiente, visual y libre de errores.

La aplicación busca:

1. **Maximizar la Eficiencia**: Minimizando tiempos muertos mediante el cálculo automático de cambios de medida y calidad.
2. **Estandarizar Decisiones**: Aplicando reglas de negocio (como paradas automáticas y prioridades) de manera consistente, eliminando la variabilidad humana.
3. **Visualizar el Futuro**: Proporcionando una línea de tiempo clara que permite anticipar necesidades de mantenimiento (cambios de anillo/canal) y materiales.

## Tecnologías Principales

- **Core**: React 19, TypeScript, Vite
- **Estado**: Zustand (Persistencia local)
- **Estilos**: Tailwind CSS 4, Lucide React (Iconos)
- **Componentes**: AG Grid Community (Tablas), React DOM
- **Utilidades**: date-fns (Cálculo de fechas), xlsx (Reportes Excel), uuid

## Especificación Funcional

### 1. Programación (Production Scheduler)

Módulo principal para la secuenciación de órdenes.

- **Funcionalidades**:
  - Visualización y edición de la secuencia de producción.
  - Cálculo automático de tiempos de inicio y fin.
  - Integración paradas programadas en la secuencia.

### 2. Visualización (Visual Schedule)

Herramienta gráfica para el análisis de la ocupación diaria.

- **Funcionalidades**:
  - Vista diaria desglosada por horas.
  - **Filtro Hora Punta**: Visualización exclusiva de actividades superpuestas con el horario punta (18:30 - 20:30 Lun-Vie).
  - Reporte compacto para impresión.

### 3. Base de Datos (Database Layout)

Gestión de datos maestros necesarios para la programación.

- **Maestro de Artículos**: ABM de artículos y propiedades (ej. Calidad Palanquilla).
- **Matriz de Cambios**: Configuración de tiempos de cambio.

### 3. Configuración (Settings Panel)

- Panel para ajustes globales y preferencias.

## Lógica de Paradas Programadas (Reglas de Negocio)

### Clasificación de Paradas

#### Tipo A: Paradas Inter-Orden (Entre órdenes de producción)

Se evaluarán al finalizar una orden y antes de iniciar la siguiente.

| Parada              | Prioridad | Duración          | Detonante                                                   |
| :------------------ | :-------- | :----------------- | :---------------------------------------------------------- |
| Cambio de medida    | 1 (Alta)  | Variable (Matriz)  | Cambio de familia/tipo de producto                          |
| Ajuste/Calibración | 1.1       | Variable (Maestro) | Siempre que ocurre Cambio de Medida                         |
| Cambio de calidad   | 2         | 60 minutos         | Cambio de Calidad Palanquilla (si NO hubo Cambio de Medida) |
| Cambio de Tope      | 3         | 10 minutos         | Cambio de longitud (si NO hubo Cambio de Medida ni Calidad) |

#### Tipo B: Paradas Intra-Orden (Durante la producción de una orden)

Se evaluarán durante la ejecución de una orden, basada en hora fija.

| Parada                | Horario | Duración  | Condición Inteligente                                           |
| :-------------------- | :------ | :--------- | :--------------------------------------------------------------- |
| Cambio de Anillo (PM) | 18:30   | 60 minutos | Solo si NO hubo parada ≥60 min en las últimas 7h (11:30-18:30) |
| Cambio de Canal (AM)  | 06:30   | 40 minutos | Solo si NO hubo parada ≥40 min en las últimas 7h (23:30-06:30) |

#### Tipo C: Paradas Híbridas (Medio o final de orden)

Pueden interrumpir una orden o insertarse entre órdenes.

| Parada                   | Horario     | Duración base | Condición Especial                                                                                 |
| :----------------------- | :---------- | :------------- | :-------------------------------------------------------------------------------------------------- |
| Mantenimiento Hora Punta | 18:30-20:30 | 120 minutos    | Lunes-Viernes (SIN multas de semana/feriados). Duración ajustada según otras paradas en el rango. |

### Reglas de Negocio Detalladas

#### R1: Cambio de Medida (Cambio)

* **CONDICIÓN**: `familia_producto[orden_actual] ≠ familia_producto[orden_anterior]`
* **DURACIÓN**: `matriz_cambios[familia_anterior][familia_actual]`
* **EFECTO**: Si ocurre, cancela evaluación de Cambio de Calidad y Cambio de Tope
* **ADICIONAL**: Siempre suma tiempo de Ajuste/Calibración del artículo actual

#### R2: Cambio de calidad

* **CONDICIÓN**: `calidad_palanquilla[orden_actual] ≠ calidad_palanquilla[orden_anterior]` AND `NO hubo_cambio_medida`
* **DURACIÓN**: 60 minutos (fijo)
* **EFECTO**: Si ocurre, cancela evaluación de Cambio de Tope

#### R3: Cambio de Tope

* **CONDICIÓN**: `longitud[orden_actual] ≠ longitud[orden_anterior]` AND `familia[actual] == familia[anterior]` AND `calidad[actual] == calidad[anterior]` AND `NO hubo_cambio_medida` AND `NO hubo_cambio_calidad`
* **DURACIÓN**: 10 minutos (fijo)

#### R4: Ajuste/Calibración

* **DETONANTE**: Siempre que ocurre Cambio de Medida
* **DURACIÓN**: `articulo[orden_actual].tiempo_acierto_calibracion`
* **APLICACIÓN**: Se suma al tiempo del Cambio de Medida

#### R5: Cambio de Anillo (PM)

* **HORA_OBJETIVO**: 18:30 cada día
* **VENTANA_EVALUACIÓN**: últimas 7 horas (11:30 - 18:30)
* **CONDICIÓN**: NO existe parada ≥ 60 min en `ventana_evaluación`
* **DURACIÓN**: 60 minutos
* **INSERCIÓN**: Se divide la orden en progreso en el minuto 18:30

#### R6: Cambio de Canal (AM)

* **HORA_OBJETIVO**: 06:30 cada día
* **VENTANA_EVALUACIÓN**: últimas 7 horas (23:30 del día anterior - 06:30)
* **CONDICIÓN**: NO existe parada ≥ 40 min en `ventana_evaluación`
* **DURACIÓN**: 40 minutos
* **INSERCIÓN**: Se divide la orden en progreso en el minuto 06:30

#### R7: Mantenimiento Hora Punta

* **HORARIO**: 18:30 - 20:30 (lunes a viernes)
* **DÍAS_EXCLUIDOS**: Sábados, domingos y feriados
* **DURACIÓN_BASE**: 120 minutos
* **LÓGICA_AJUSTE**:
  - Si Cambio de Anillo (60 min) está en el rango → Mantenimiento = 60 min
  - Si Cambio de Medida cubre 18:30-20:30 → Mantenimiento = 0 min (no se programa)
  - Si NO hay paradas en 18:30-20:30 → Mantenimiento = 120 min
* **PRIORIDAD**: Menor que todas las demás paradas

---

## Lineamientos de Desarrollo

1. **Fuente de Verdad**: Este README define el funcionamiento esperado.
2. **Validación**: Todo cambio en lógica de tiempos debe ser verificado en `src/store/useStore.ts`.
3. **Idioma**: Documentación y comunicación en **Español**.
