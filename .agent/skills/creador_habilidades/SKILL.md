---
name: Creador de Habilidades
description: Asistente para crear nuevas habilidades (skills) para Antigravity en español, con plantillas, ejemplos y mejores prácticas.
---

# Creador de Habilidades

Esta skill te asiste en la creación de nuevas habilidades (skills) para Antigravity. Proporciona instrucciones detalladas, plantillas y mejores prácticas para crear skills efectivas en español.

## ¿Qué es una Skill?

Una **skill** es una extensión de capacidades "bajo demanda" para agentes de IA. A diferencia de los system prompts que siempre están cargados, las skills solo se activan cuando son relevantes para la tarea del usuario, optimizando el uso del contexto.

## Estructura de Carpetas

Las skills se organizan en carpetas con la siguiente estructura:

```
📁 .agent/skills/                    # Alcance de proyecto
│   └── 📁 nombre_skill/
│       ├── 📄 SKILL.md              # ✅ Obligatorio - Instrucciones principales
│       ├── 📁 scripts/              # 📌 Opcional - Scripts auxiliares
│       ├── 📁 examples/             # 📌 Opcional - Ejemplos de uso
│       └── 📁 resources/            # 📌 Opcional - Plantillas y recursos
```

### Ubicaciones de Skills

| Alcance | Ubicación | Disponibilidad |
|---------|-----------|----------------|
| **Proyecto** | `<raíz-proyecto>/.agent/skills/` | Solo en el proyecto actual |
| **Global** | `~/.gemini/antigravity/skills/` | En todos los proyectos |

## Formato del Archivo SKILL.md

El archivo `SKILL.md` es **obligatorio** y debe contener:

### 1. YAML Frontmatter (Obligatorio)

```yaml
---
name: Nombre de la Skill
description: Descripción breve y clara del propósito de la skill.
---
```

### 2. Contenido Markdown

Después del frontmatter, incluye instrucciones detalladas en markdown:

```markdown
# Nombre de la Skill

## Descripción
Explicación del propósito y cuándo usar esta skill.

## Instrucciones
Pasos detallados que el agente debe seguir.

## Ejemplos
Casos de uso y ejemplos prácticos.

## Notas Importantes
Advertencias, limitaciones o consideraciones especiales.
```

## Plantilla Completa

Usa esta plantilla para crear nuevas skills:

```markdown
---
name: [Nombre de tu Skill]
description: [Descripción concisa - máximo 2 líneas]
---

# [Nombre de tu Skill]

## Descripción

[Explica qué hace esta skill y cuándo debe activarse]

## Contexto

[Proporciona información de fondo necesaria]

## Instrucciones

1. [Paso 1]
2. [Paso 2]
3. [Paso 3]

## Formato de Salida

[Define cómo debe formatearse el resultado]

## Ejemplos

### Ejemplo 1: [Nombre del caso]
[Descripción del ejemplo]

## Notas

- [Nota importante 1]
- [Nota importante 2]
```

## Mejores Prácticas

### ✅ Hacer

- **Nombre descriptivo**: Usa nombres claros que indiquen el propósito
- **Descripción concisa**: Máximo 2 líneas en la descripción del frontmatter
- **Instrucciones específicas**: Pasos claros y accionables
- **Ejemplos prácticos**: Incluye casos de uso reales
- **Formato consistente**: Usa markdown estructurado

### ❌ Evitar

- Descripciones vagas o genéricas
- Instrucciones ambiguas que pueden interpretarse de múltiples formas
- Skills demasiado amplias (mejor dividir en skills específicas)
- Contenido excesivamente largo (mantén el contexto eficiente)

## Convenciones de Nombres

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Carpeta | `snake_case` | `creador_habilidades` |
| Archivo | `SKILL.md` (siempre mayúsculas) | `SKILL.md` |
| Nombre interno | Título capitalizado | `Creador de Habilidades` |

## Pasos para Crear una Nueva Skill

1. **Definir el propósito**: ¿Qué problema resuelve? ¿Cuándo debe activarse?

2. **Crear la carpeta**:
   ```powershell
   mkdir .agent\skills\nombre_skill
   ```

3. **Crear SKILL.md**:
   - Usar la plantilla proporcionada arriba
   - Completar frontmatter con nombre y descripción
   - Escribir instrucciones claras

4. **Agregar recursos** (opcional):
   - Scripts en `scripts/`
   - Ejemplos en `examples/`
   - Plantillas en `resources/`

5. **Probar la skill**:
   - Hacer una solicitud que debería activar la skill
   - Verificar que el agente sigue las instrucciones correctamente

## Ejemplo: Skill de Documentación de Código

```markdown
---
name: Documentador de Código
description: Genera documentación clara y consistente para funciones, clases y módulos en español.
---

# Documentador de Código

## Descripción

Esta skill genera documentación para código fuente siguiendo estándares de documentación en español.

## Instrucciones

1. Analiza la estructura del código (funciones, clases, parámetros)
2. Genera docstrings/JSDoc en español
3. Incluye: descripción, parámetros, retorno, excepciones, ejemplos

## Formato de Documentación

### Para Python
```python
def funcion(param1: str, param2: int) -> bool:
    """
    Descripción breve de la función.

    Args:
        param1: Descripción del primer parámetro.
        param2: Descripción del segundo parámetro.

    Returns:
        Descripción de lo que retorna.

    Raises:
        ValueError: Cuándo se lanza esta excepción.

    Example:
        >>> funcion("texto", 42)
        True
    """
```

### Para JavaScript/TypeScript
```javascript
/**
 * Descripción breve de la función.
 * 
 * @param {string} param1 - Descripción del primer parámetro.
 * @param {number} param2 - Descripción del segundo parámetro.
 * @returns {boolean} Descripción de lo que retorna.
 * @throws {Error} Cuándo se lanza esta excepción.
 * @example
 * funcion("texto", 42); // true
 */
```
```

---

> **Nota**: Esta skill se activa automáticamente cuando detecta solicitudes relacionadas con la creación de nuevas habilidades o skills en Antigravity.
