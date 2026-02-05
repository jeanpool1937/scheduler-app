# Scheduler App - Documentación y Especificaciones

## Descripción General
Aplicación de secuenciación de producción para laminación ("Laminación Scheduler"). Permite gestionar y optimizar la programación de órdenes de producción, considerando tiempos de cambio, prioridades y gestión de materiales.

## Tecnologías Principales
- **Core**: React 19, TypeScript, Vite
- **Estado**: Zustand
- **Estilos**: Tailwind CSS 4, Lucide React (Iconos)
- **Componentes**: AG Grid Community (Tablas), React DOM
- **Utilidades**: uuid (IDs únicos), date-fns (Fechas), xlsx (Excel)

## Especificación Funcional

### 1. Programación (Production Scheduler)
Módulo principal para la secuenciación de órdenes.
- **Funcionalidades**:
  - Visualización y edición de la secuencia de producción.
  - Cálculo automático de tiempos de inicio y fin.
  - Integración de tiempos de cambio (Changeovers) basados en la matriz definida.
  - Opciones para limpiar la programación ("Clear All").

### 2. Base de Datos (Database Layout)
Gestión de datos maestros necesarios para la programación.
- **Maestro de Artículos (Article Master)**:
  - ABM (Alta, Baja, Modificación) de artículos permitidos.
  - Propiedades: ID, Descripción, Familia, etc.
- **Matriz de Cambios (Changeover Master)**:
  - Configuración de tiempos de cambio entre diferentes tipos/familias de productos.
  - Base para los cálculos de tiempos muertos en la programación.

### 3. Configuración (Settings Panel)
- Panel para ajustes globales de la aplicación y preferencias de usuario.

## Lineamientos de Desarrollo y Contexto
**IMPORTANTE**: Este archivo actúa como la memoria persistente del contexto funcional de la aplicación.

1.  **Actualización Constante**: Cada vez que se agregue, modifique o elimine una funcionalidad, **este archivo (README.md) debe ser actualizado**.
2.  **Fuente de Verdad**: Las especificaciones aquí descritas tienen prioridad sobre suposiciones.
3.  **Registro de Cambios**: Mantener un historial de las funcionalidades agregadas en la sección "Historial de Funcionalidades".
4.  **Ejecución y Validación**: Tras implementar cambios, el agente debe:
    *   Ejecutar/Reiniciar el servidor de desarrollo (`npm run dev`).
    *   Validar que la aplicación corra correctamente.
    *   Confirmar que los cambios sean visibles para el usuario.
5.  **Idioma**: El agente debe presentar todos sus planes de implementación y explicaciones en **Español**.

## Historial de Funcionalidades
- **[Inicial]**: Creación de estructura base con React, Vite y Tailwind.
- **[Inicial]**: Implementación de navegación por pestañas (Programación, Base de Datos, Configuración).
- **[Inicial]**: Integración de AG Grid para tablas de datos.
- **[05/02/2026]**: Creación de este archivo de documentación y lineamientos.
- **[05/02/2026]**: Mejora en cabeceras de tabla (ajuste de texto y salto de línea).
- **[05/02/2026]**: Implementación de columna "Calidad Palanquilla" y parada automática de 1h por Cambio de Calidad.
