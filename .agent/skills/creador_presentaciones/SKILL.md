---
name: Creador de Presentaciones PPTX
description: Crea y edita presentaciones PowerPoint programáticamente usando HTML, plantillas o edición directa de XML. Incluye herramientas para miniaturas, reordenamiento de diapositivas y reemplazo de texto.
---

# Creador de Presentaciones PowerPoint

Esta skill permite crear y editar presentaciones PowerPoint (.pptx) de tres formas:
1. **Creación desde HTML** - Diseña diapositivas en HTML/CSS y conviértelas a PPTX
2. **Edición de presentaciones existentes** - Modifica archivos PPTX usando formato OOXML
3. **Uso de plantillas** - Duplica y personaliza diapositivas de una plantilla

## Crear Presentación desde HTML

### Flujo de Trabajo

1. Diseñar cada diapositiva como archivo HTML individual con estilos CSS
   - Usar dimensiones de diapositiva: `width: 1280px` y `height: 720px` en el body
   - Usar `<p>`, `<h1>`-`<h6>` para contenido de texto
   - Usar `class="placeholder"` para áreas donde se añadirán gráficos/tablas
   - **CRÍTICO**: Rasterizar gradientes e iconos como imágenes PNG usando Sharp

2. Crear y ejecutar un archivo JavaScript usando la librería [`html2pptx.js`](scripts/html2pptx.js) para convertir HTML a PowerPoint

3. **Validación visual**: Generar miniaturas e inspeccionar problemas de diseño
   ```powershell
   python scripts/thumbnail.py output.pptx thumbnails --cols 4
   ```
   - Verificar: texto cortado, superposiciones, problemas de posicionamiento, contraste

## Editar Presentación Existente

Para editar diapositivas de una presentación existente, trabaja con el formato OOXML.

### Flujo de Trabajo

1. **OBLIGATORIO - LEER ARCHIVO COMPLETO**: Leer [`ooxml.md`](ooxml.md) completamente para entender la estructura OOXML

2. Desempaquetar la presentación:
   ```powershell
   python ooxml/scripts/unpack.py <input.pptx> <output_dir>
   ```

3. Editar los archivos XML (principalmente `ppt/slides/slide{N}.xml`)

4. **CRÍTICO**: Validar inmediatamente después de cada edición:
   ```powershell
   python ooxml/scripts/validate.py --original <original.pptx> <edited_dir>
   ```

5. Empaquetar la presentación final:
   ```powershell
   python ooxml/scripts/pack.py <edited_dir> <output.pptx>
   ```

## Crear Presentación usando Plantilla

### Flujo de Trabajo

1. **Extraer texto y crear miniaturas de la plantilla**:
   ```powershell
   python -m markitdown template.pptx > template-content.md
   python scripts/thumbnail.py template.pptx
   ```

2. **Analizar plantilla y guardar inventario**:
   - Revisar miniaturas para entender layouts y patrones de diseño
   - Crear archivo `template-inventory.md` con el análisis

3. **Crear esquema de presentación** basado en el inventario:
   - Elegir layouts apropiados para cada sección de contenido
   - **CRÍTICO**: Coincidir estructura del layout con el contenido real
   - Guardar `outline.md` con mapeo de contenido y plantillas

4. **Duplicar, reordenar y eliminar diapositivas**:
   ```powershell
   python scripts/rearrange.py template.pptx working.pptx 0,34,34,50,52
   ```
   - Los índices son base-0 (primera diapositiva = 0)
   - El mismo índice puede aparecer múltiples veces para duplicar

5. **Extraer TODO el texto usando `inventory.py`**:
   ```powershell
   python scripts/inventory.py working.pptx text-inventory.json
   ```
   - Leer el archivo JSON completamente para entender todas las formas

6. **Generar texto de reemplazo y guardar en JSON**:
   - Verificar qué shapes existen en el inventario antes de referenciarlos
   - Añadir campo "paragraphs" a shapes que necesitan contenido
   - Los shapes sin "paragraphs" serán limpiados automáticamente
   - Guardar en `replacement-text.json`

   **Ejemplo de formato de párrafos**:
   ```json
   "paragraphs": [
     {
       "text": "Nuevo título",
       "alignment": "CENTER",
       "bold": true
     },
     {
       "text": "Punto con viñeta sin símbolo de viñeta",
       "bullet": true,
       "level": 0
     }
   ]
   ```

7. **Aplicar reemplazos usando `replace.py`**:
   ```powershell
   python scripts/replace.py working.pptx replacement-text.json output.pptx
   ```

## Crear Cuadrícula de Miniaturas

```powershell
python scripts/thumbnail.py input.pptx [prefijo_salida] [--cols N]
```

**Características**:
- Crea: `thumbnails.jpg` (o `thumbnails-1.jpg`, `thumbnails-2.jpg`, etc. para presentaciones grandes)
- Por defecto: 5 columnas, máximo 30 diapositivas por cuadrícula
- Las diapositivas están indexadas desde cero (Slide 0, Slide 1, etc.)

## Convertir Diapositivas a Imágenes

```powershell
# Convertir PPTX a PDF
soffice --headless --convert-to pdf template.pptx

# Convertir páginas PDF a JPEG
pdftoppm -jpeg -r 150 template.pdf slide
```

## Dependencias

**Python**:
- `markitdown[pptx]` - Extracción de texto
- `python-pptx` - Manipulación de PPTX
- `Pillow` - Procesamiento de imágenes
- `defusedxml` - Parsing XML seguro

**Node.js** (para creación desde HTML):
- `pptxgenjs` - Creación de presentaciones
- `playwright` - Renderizado HTML
- `react-icons`, `react`, `react-dom` - Iconos
- `sharp` - Procesamiento de imágenes

**Sistema**:
- LibreOffice (`soffice`) - Conversión a PDF
- Poppler (`pdftoppm`) - Conversión PDF a imágenes

## Notas Importantes

- **Índices base-0**: Las diapositivas se numeran desde 0 (primera = 0, segunda = 1)
- **Validar siempre**: Ejecutar thumbnail.py después de generar para verificar visualmente
- **No usar símbolos de viñeta manuales**: Cuando `bullet: true`, no incluir símbolos (•, -, *) en el texto
- **Propiedades de párrafo**: Preservar propiedades del inventario original

---

> **Nota**: Esta skill se activa cuando detecta solicitudes relacionadas con creación o edición de presentaciones PowerPoint.
