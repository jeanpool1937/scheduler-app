# Stack Tecnológico y Reglas de Implementación

Al generar código o componentes UI para Aceros Arequipa, **DEBES** adherirte estrictamente a las siguientes elecciones tecnológicas.

## Stack Principal
* **Framework:** React (TypeScript preferido para robustez).
* **Motor de Estilos:** Tailwind CSS (Obligatorio).
* **Librería de Componentes:** shadcn/ui (Base primitiva).
* **Iconos:** Lucide React (Usar iconos con trazos gruesos/bold si es posible).

## Guías de Implementación

### 1. Uso de Tailwind
* Utiliza los tokens de color definidos en `design-tokens.json`.
* **IMPORTANTE:** Usa `bg-primary` (Rojo Aceros) para las acciones principales.
* Evita el uso excesivo de sombras suaves; prefiere bordes definidos (`border`, `border-gray-200`).

### 2. Patrones de Componentes

#### Botones
* **Primarios:** 
  * Fondo Rojo (`#DA291C`)
  * Texto Blanco
  * Bordes rectos o con radio mínimo (`rounded-sm`)
  * Deben transmitir acción y urgencia
* **Secundarios:** 
  * Borde Gris Oscuro
  * Texto Gris Oscuro

#### Layout
* Estructuras tipo "Grid" o bloques sólidos
* Evita diseños flotantes o demasiado "airy"
* La interfaz debe sentirse **construida y firme**

#### Formularios
* Etiquetas (Labels) en negrita (`font-bold`) para alta legibilidad en obra o ambientes industriales

### 3. Patrones Prohibidos

> [!CAUTION]
> Los siguientes patrones están **PROHIBIDOS** en implementaciones de Aceros Arequipa:

* ❌ NO uses gradientes excesivos (el estilo es "Flat" e industrial)
* ❌ NO uses bordes completamente redondos (Pill shape) para botones principales; usa rectángulos con bordes apenas suavizados
* ❌ NO uses fuentes con serifas (Times New Roman, etc.)
* ❌ NO uses colores pastel o tonos suaves
* ❌ NO uses animaciones excesivas o "bouncy"

## Ejemplo de Configuración Tailwind

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#DA291C',
          hover: '#B01F16',
          foreground: '#FFFFFF'
        },
        secondary: {
          DEFAULT: '#1F2937',
          foreground: '#FFFFFF'
        }
      },
      borderRadius: {
        'sm': '0.125rem',
        'none': '0px'
      },
      fontFamily: {
        heading: ['Roboto', 'Helvetica Neue', 'sans-serif'],
        body: ['Open Sans', 'system-ui', 'sans-serif']
      }
    }
  }
}
```
