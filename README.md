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

El sistema calcula automáticamente los tiempos de inicio y fin basándose en una serie de reglas secuenciales. Las paradas se insertan automáticamente entre órdenes según las siguientes condiciones:

### 1. Cambio de Medida (Changeover)

* **Detonante**: Cuando cambia la familia/tipo de producto entre la orden actual y la anterior (según la Matriz de Cambios).
* **Duración**: Variable (definida en `Configuración > Matriz de Cambios`).
* **Prioridad**: Alta. Si ocurre, anula el cálculo de "Cambio de Calidad" y "Cambio de Tope".

### 2. Cambio de Calidad (Calidad Palanquilla)

* **Detonante**: Cuando la "Calidad Palanquilla" del artículo actual es diferente a la del anterior.
* **Condición**: Solo si NO hubo un Cambio de Medida.
* **Duración**: **60 minutos**.
* **Propósito**: Ajustes necesarios en el horno o proceso por cambio de composición del material.

### 3. Cambio de Tope (Longitud)

* **Detonante**: Cuando la longitud del producto (ej. "x 6M", "x 12M") cambia, pero el producto es de la misma familia y calidad.
* **Condición**: Solo si NO hubo Cambio de Medida ni Cambio de Calidad.
* **Duración**: **10 minutos**.

### 4. Ajuste / Calibración

* **Detonante**: Siempre que ocurre un Cambio de Medida.
* **Duración**: Variable (campo `Acierto/Calibración` del maestro de artículos). Se suma al tiempo del cambio de medida.

### 5. Cambio de Anillo (Mantenimiento PM)

* **Detonante**: Hora fija diaria **18:30 PM**.
* **Condición Inteligente**: Se programa automáticamente SOLO SI no ha habido ninguna parada mayor a **60 minutos** en las últimas 7 horas (11:30 AM - 18:30 PM).
* **Duración**: **60 minutos**.

### 6. Cambio de Canal (Mantenimiento AM)

* **Detonante**: Hora fija diaria **06:30 AM**.
* **Condición Inteligente**: Se programa automáticamente SOLO SI no ha habido ninguna parada mayor a **40 minutos** en las últimas 7 horas (23:30 PM - 06:30 AM).
* **Duración**: **40 minutos**.

### 7. Mantenimiento (Hora punta)

* **Detonante**: Hora fija diaria **18:30 PM**.
* **Condición Inteligente**: Se programa automáticamente SOLO SI no ha habido ninguna parada en el rango de 18:30 PM - 20:30 PM, no se programas fines de semana sabado o domingo ni feriados.
* **Duración**: Se programa **120 minutos si no hay otra parada en ese rango, si hay otra parada como el cambio de Anillo (60min) entonces solo se programa la diferencia 60min para cubir el rango de 18:30 PM - 20:30 PM.**

---

## Lineamientos de Desarrollo

1. **Fuente de Verdad**: Este README define el funcionamiento esperado.
2. **Validación**: Todo cambio en lógica de tiempos debe ser verificado en `src/store/useStore.ts`.
3. **Idioma**: Documentación y comunicación en **Español**.

## Historial de Funcionalidades

- **[Inicial]**: Creación de estructura base con React, Vite y Tailwind.
- **[Inicial]**: Gestión de órdenes y navegación por pestañas.
- **[Inicial]**: Matriz de cambios dinámica.
- **[05/02/2026]**: Creación de documentación y lineamientos.
- **[05/02/2026]**: Implementación de lógica de "Calidad Palanquilla" y parada de 1g.
- **[06/02/2026]**: Documentación detallada de reglas de negocio (Anillos, Canales, Topes) en README.
