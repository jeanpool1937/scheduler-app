---
name: validacion_cambios
description: Realiza una validación iterativa de los cambios en la aplicación ejecutando la app, verificando la URL y corrigiendo errores automáticamente hasta que funcione correctamente.
---

# Validación de Cambios en la Aplicación

Esta habilidad fuerza un ciclo de retroalimentación estricto para asegurar que los cambios funcionales en la aplicación realmente funcionan antes de dar la tarea por concluida.

## Cuándo usar esta habilidad
Úsala SIEMPRE que se te pida realizar un cambio en la funcionalidad de la aplicación (frontend o backend) que pueda ser verificado ejecutando la aplicación.

## Flujo de Trabajo

### 1. Implementación Inicial
Realiza los cambios solicitados en el código basándote en el requerimiento del usuario.

### 2. Bucle de Validación (Iterativo)
Una vez aplicados los cambios, entra en este bucle obligatorio:

1.  **Ejecutar la Aplicación**:
    *   Usa `run_command` para iniciar el servidor de desarrollo (ej. `npm run dev`, `python app.py`, etc.).
    *   **IMPORTANTE**: Asegúrate de enviar el comando al background o usar una terminal persistente si es un servidor que se queda escuchando.
    *   Espera unos segundos para asegurarte de que el servidor ha arrancado correctamente.

2.  **Verificar Cambios**:
    *   Navega a la URL local correspondiente (ej. `http://localhost:3000`) usando herramientas de navegador o lectura de contenido.
    *   Valida **explícitamente** que la funcionalidad cambiada funciona como se espera.
    *   Si es un cambio visual o de UI, verifica que los elementos estén presentes.
    *   Si es un cambio de lógica, intenta simular la interacción o verificar el resultado.

3.  **Evaluación**:
    *   **¿Funciona correctamente?**
        *   **SÍ**: ¡Excelente! Detén el servidor (si es necesario) y comunica el éxito al usuario. El bucle termina.
        *   **NO**:
            *   **Diagnosticar**: Lee los logs de la terminal o los errores mostrados en el navegador.
            *   **Planificar Corrección**: Crea un pequeño plan inmediato para solucionar el error encontrado.
            *   **Corregir**: Aplica los cambios necesarios en el código.
            *   **Reiniciar Bucle**: Vuelve al paso 1 (Ejecutar la Aplicación) para validar la corrección.

## Reglas de Oro
*   **No asumas que funciona**: El cambio de código no es el final, la validación en ejecución lo es.
*   **Itera sin miedo**: Si falla 3 veces, detente y pide feedback al usuario o repiensa el enfoque, pero intenta corregirlo tú mismo primero.
*   **Pruebas Reales**: Trata de usar la herramienta de navegador (`open_browser_url` o similar si está disponible) para interactuar como un usuario real.
