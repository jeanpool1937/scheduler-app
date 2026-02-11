---
name: Protocolo de Resolución de Errores
description: Proceso estructurado para depurar y resolver errores siguiendo un análisis de causa raíz profundo, validación de hipótesis y prevención de recurrencia.
---
# Protocolo de Resolución de Errores

## Descripción

Esta habilidad se debe activar **UNICAMENTE** cuando el usuario diga explícitamente:

1. "Encuentra la causa raíz" (o variaciones directas de que busques una mejor solucion).

El objetivo es aplicar un enfoque científico para encontrar la causa raíz verdadera, eliminando suposiciones y previniendo que el problema vuelva a ocurrir.

## Instrucciones

Sigue este proceso reforzado de 5 etapas para asegurar la resolución:

### 1. Definición y Acotación del Problema

Antes de preguntar "¿por qué?", define exactamente qué está pasando. Un error común es empezar con una definición vaga.

* **Clarifica el síntoma**: ¿Es un error crítico, una degradación de rendimiento o un comportamiento inesperado?
* **Establece el alcance**:
  * ¿Pasa siempre o es intermitente?
  * ¿Afecta a todos los casos/usuarios o solo a un grupo específico?

### 2. Investigación de Causa Raíz (El "Zoom" hacia adentro)

Aplica la **Técnica de los 5 Porqués** para profundizar.

* **Cadena lógica**: El orden debe ser una cadena lógica de causalidad, no "saltos de fe". Cada respuesta debe ser la causa directa del nivel anterior.
* **Validación con datos**: **NO supongas** la respuesta al "¿por qué?".
  * Revisa logs, flujo de datos y arquitectura para confirmar que cada eslabón es real.
* **Punto de quiebre**: Identifica el proceso fallido o la política mal aplicada (la causa raíz técnica), no culpes a una "persona" o "usuario".

### 3. Lluvia de Ideas y Categorización (Diagrama de Ishikawa)

Si la causa no es obvia con los 5 porqués o el problema es multicausal, organiza tu lluvia de ideas usando estas categorías:

| Categoría                        | Qué revisar                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| **Tecnología/Código**     | Versiones, sintaxis, lógica de algoritmos, dependencias, conflictos.                    |
| **Entorno/Infraestructura** | Permisos de servidor, variables de entorno, red, latencia, configuración local vs prod. |
| **Datos**                   | Integridad de la BD, formatos de entrada, nulos inesperados, datos corruptos.            |
| **Proceso**                 | ¿Hubo un despliegue reciente? ¿Se saltaron pruebas? ¿Pasos manuales erróneos?        |

### 4. Priorización y Prueba de Hipótesis

Una vez tengas la lista de posibles causas:

* **Ordena por probabilidad**: ¿Qué es más factible según la evidencia de los logs?
* **Prueba de Aislamiento**: Intenta reproducir el error en un entorno controlado cambiando **una sola variable a la vez**.
  * *Nota*: Si la prueba falla (no reproduce o no arregla), descarta la hipótesis y pasa a la siguiente en tu lista de prioridades (Iteratividad).

### 5. Plan de Acción y Seguimiento

Sabes que has encontrado la causa raíz cuando puedes responder "SÍ" a: **"Si corrijo esto, ¿el problema dejará de ocurrir para siempre?"**.

* **Acción Correctiva**: Implementa la solución que elimina la causa raíz.
  * *MANDATORIO*: Prueba tu solución antes de entregarla. Pide datos de prueba si no los tienes.
* **Acción Preventiva**: Crea un mecanismo para que esto no se repita.
  * Ejemplo: Añadir un test unitario, una validación de entrada, un log de alerta o mejorar la documentación.

## Entregable Final al Usuario

Al finalizar, reporta:

1. **Causa Raíz**: Explicación técnica clara.
2. **Solución Aplicada**: Qué cambiaste.
3. **Validación**: Cómo probaste que funciona.
4. **Prevención**: Qué medida tomaste para evitar que vuelva a suceder.
