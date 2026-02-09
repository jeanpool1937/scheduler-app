# Referencia Técnica de Office Open XML para PowerPoint

**Importante: Lee este documento completo antes de empezar.** Las reglas críticas del esquema XML y los requisitos de formato se cubren a lo largo del documento. Una implementación incorrecta puede crear archivos PPTX inválidos que PowerPoint no puede abrir.

## Directrices Técnicas

### Cumplimiento del Esquema

- **Orden de elementos en `<p:txBody>`**: `<a:bodyPr>`, `<a:lstStyle>`, `<a:p>`
- **Espacios en blanco**: Añadir `xml:space='preserve'` a elementos `<a:t>` con espacios al inicio/final
- **Unicode**: Escapar caracteres en contenido ASCII: `"` se convierte en `&#8220;`
- **Imágenes**: Añadir a `ppt/media/`, referenciar en XML de diapositiva, establecer dimensiones dentro de límites
- **Relaciones**: Actualizar `ppt/slides/_rels/slideN.xml.rels` para recursos de cada diapositiva
- **Atributo dirty**: Añadir `dirty="0"` a elementos `<a:rPr>` y `<a:endParaRPr>` para indicar estado limpio

## Estructura de Presentación

### Estructura Básica de Diapositiva

```xml
<!-- ppt/slides/slide1.xml -->
<p:sld>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>...</p:nvGrpSpPr>
      <p:grpSpPr>...</p:grpSpPr>
      <!-- Las formas van aquí -->
    </p:spTree>
  </p:cSld>
</p:sld>
```

### Caja de Texto / Forma con Texto

```xml
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="2" name="Title"/>
    <p:cNvSpPr>
      <a:spLocks noGrp="1"/>
    </p:cNvSpPr>
    <p:nvPr>
      <p:ph type="ctrTitle"/>
    </p:nvPr>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="838200" y="365125"/>
      <a:ext cx="7772400" cy="1470025"/>
    </a:xfrm>
  </p:spPr>
  <p:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    <a:p>
      <a:r>
        <a:t>Título de la Diapositiva</a:t>
      </a:r>
    </a:p>
  </p:txBody>
</p:sp>
```

### Formato de Texto

```xml
<!-- Negrita -->
<a:r>
  <a:rPr b="1"/>
  <a:t>Texto en Negrita</a:t>
</a:r>

<!-- Cursiva -->
<a:r>
  <a:rPr i="1"/>
  <a:t>Texto en Cursiva</a:t>
</a:r>

<!-- Subrayado -->
<a:r>
  <a:rPr u="sng"/>
  <a:t>Subrayado</a:t>
</a:r>

<!-- Resaltado -->
<a:r>
  <a:rPr>
    <a:highlight>
      <a:srgbClr val="FFFF00"/>
    </a:highlight>
  </a:rPr>
  <a:t>Texto Resaltado</a:t>
</a:r>

<!-- Fuente y Tamaño -->
<a:r>
  <a:rPr sz="2400" typeface="Arial">
    <a:solidFill>
      <a:srgbClr val="FF0000"/>
    </a:solidFill>
  </a:rPr>
  <a:t>Arial rojo 24pt</a:t>
</a:r>

<!-- Ejemplo de formato completo -->
<a:r>
  <a:rPr lang="es-ES" sz="1400" b="1" dirty="0">
    <a:solidFill>
      <a:srgbClr val="FAFAFA"/>
    </a:solidFill>
  </a:rPr>
  <a:t>Texto formateado</a:t>
</a:r>
```

### Listas

```xml
<!-- Lista con viñetas -->
<a:p>
  <a:pPr lvl="0">
    <a:buChar char="•"/>
  </a:pPr>
  <a:r>
    <a:t>Primer punto con viñeta</a:t>
  </a:r>
</a:p>

<!-- Lista numerada -->
<a:p>
  <a:pPr lvl="0">
    <a:buAutoNum type="arabicPeriod"/>
  </a:pPr>
  <a:r>
    <a:t>Primer elemento numerado</a:t>
  </a:r>
</a:p>

<!-- Segundo nivel de sangría -->
<a:p>
  <a:pPr lvl="1">
    <a:buChar char="•"/>
  </a:pPr>
  <a:r>
    <a:t>Viñeta con sangría</a:t>
  </a:r>
</a:p>
```

### Formas

```xml
<!-- Rectángulo -->
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="3" name="Rectangle"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="1000000" y="1000000"/>
      <a:ext cx="3000000" cy="2000000"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
    <a:solidFill>
      <a:srgbClr val="FF0000"/>
    </a:solidFill>
    <a:ln w="25400">
      <a:solidFill>
        <a:srgbClr val="000000"/>
      </a:solidFill>
    </a:ln>
  </p:spPr>
</p:sp>

<!-- Rectángulo Redondeado -->
<p:sp>
  <p:spPr>
    <a:prstGeom prst="roundRect">
      <a:avLst/>
    </a:prstGeom>
  </p:spPr>
</p:sp>

<!-- Círculo/Elipse -->
<p:sp>
  <p:spPr>
    <a:prstGeom prst="ellipse">
      <a:avLst/>
    </a:prstGeom>
  </p:spPr>
</p:sp>
```

### Imágenes

```xml
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="4" name="Picture">
      <a:hlinkClick r:id="" action="ppaction://media"/>
    </p:cNvPr>
    <p:cNvPicPr>
      <a:picLocks noChangeAspect="1"/>
    </p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="rId2"/>
    <a:stretch>
      <a:fillRect/>
    </a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm>
      <a:off x="1000000" y="1000000"/>
      <a:ext cx="3000000" cy="2000000"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
  </p:spPr>
</p:pic>
```

### Tablas

```xml
<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:cNvPr id="5" name="Table"/>
    <p:cNvGraphicFramePr>
      <a:graphicFrameLocks noGrp="1"/>
    </p:cNvGraphicFramePr>
    <p:nvPr/>
  </p:nvGraphicFramePr>
  <p:xfrm>
    <a:off x="1000000" y="1000000"/>
    <a:ext cx="6000000" cy="2000000"/>
  </p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblGrid>
          <a:gridCol w="3000000"/>
          <a:gridCol w="3000000"/>
        </a:tblGrid>
        <a:tr h="500000">
          <a:tc>
            <a:txBody>
              <a:bodyPr/>
              <a:lstStyle/>
              <a:p>
                <a:r>
                  <a:t>Celda 1</a:t>
                </a:r>
              </a:p>
            </a:txBody>
          </a:tc>
          <a:tc>
            <a:txBody>
              <a:bodyPr/>
              <a:lstStyle/>
              <a:p>
                <a:r>
                  <a:t>Celda 2</a:t>
                </a:r>
              </a:p>
            </a:txBody>
          </a:tc>
        </a:tr>
      </a:tbl>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>
```

### Layouts de Diapositiva

```xml
<!-- Layout de Diapositiva de Título -->
<p:sp>
  <p:nvSpPr>
    <p:nvPr>
      <p:ph type="ctrTitle"/>
    </p:nvPr>
  </p:nvSpPr>
  <!-- Contenido del título -->
</p:sp>

<p:sp>
  <p:nvSpPr>
    <p:nvPr>
      <p:ph type="subTitle" idx="1"/>
    </p:nvPr>
  </p:nvSpPr>
  <!-- Contenido del subtítulo -->
</p:sp>

<!-- Layout de Diapositiva de Contenido -->
<p:sp>
  <p:nvSpPr>
    <p:nvPr>
      <p:ph type="title"/>
    </p:nvPr>
  </p:nvSpPr>
  <!-- Título de diapositiva -->
</p:sp>

<p:sp>
  <p:nvSpPr>
    <p:nvPr>
      <p:ph type="body" idx="1"/>
    </p:nvPr>
  </p:nvSpPr>
  <!-- Cuerpo del contenido -->
</p:sp>
```

## Actualizaciones de Archivos

Al añadir contenido, actualizar estos archivos:

**`ppt/_rels/presentation.xml.rels`:**
```xml
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
```

**`ppt/slides/_rels/slide1.xml.rels`:**
```xml
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
```

**`[Content_Types].xml`:**
```xml
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
```

**`ppt/presentation.xml`:**
```xml
<p:sldIdLst>
  <p:sldId id="256" r:id="rId1"/>
  <p:sldId id="257" r:id="rId2"/>
</p:sldIdLst>
```

**`docProps/app.xml`:** Actualizar conteo de diapositivas y estadísticas
```xml
<Slides>2</Slides>
<Paragraphs>10</Paragraphs>
<Words>50</Words>
```

## Operaciones con Diapositivas

### Añadir una Nueva Diapositiva

Al añadir una diapositiva al final de la presentación:

1. **Crear el archivo de diapositiva** (`ppt/slides/slideN.xml`)
2. **Actualizar `[Content_Types].xml`**: Añadir Override para la nueva diapositiva
3. **Actualizar `ppt/_rels/presentation.xml.rels`**: Añadir relación para la nueva diapositiva
4. **Actualizar `ppt/presentation.xml`**: Añadir ID de diapositiva a `<p:sldIdLst>`
5. **Crear relaciones de diapositiva** (`ppt/slides/_rels/slideN.xml.rels`) si es necesario
6. **Actualizar `docProps/app.xml`**: Incrementar conteo de diapositivas

### Duplicar una Diapositiva

1. Copiar el archivo XML de la diapositiva origen con un nuevo nombre
2. Actualizar todos los IDs en la nueva diapositiva para que sean únicos
3. Seguir los pasos de "Añadir una Nueva Diapositiva"
4. **CRÍTICO**: Eliminar o actualizar referencias a diapositivas de notas en archivos `_rels`
5. Eliminar referencias a archivos multimedia no usados

### Reordenar Diapositivas

1. **Actualizar `ppt/presentation.xml`**: Reordenar elementos `<p:sldId>` en `<p:sldIdLst>`
2. El orden de los elementos `<p:sldId>` determina el orden de las diapositivas
3. Mantener los IDs de diapositiva y relación sin cambios

Ejemplo:
```xml
<!-- Orden original -->
<p:sldIdLst>
  <p:sldId id="256" r:id="rId2"/>
  <p:sldId id="257" r:id="rId3"/>
  <p:sldId id="258" r:id="rId4"/>
</p:sldIdLst>

<!-- Después de mover diapositiva 3 a posición 2 -->
<p:sldIdLst>
  <p:sldId id="256" r:id="rId2"/>
  <p:sldId id="258" r:id="rId4"/>
  <p:sldId id="257" r:id="rId3"/>
</p:sldIdLst>
```

### Eliminar una Diapositiva

1. **Eliminar de `ppt/presentation.xml`**: Borrar la entrada `<p:sldId>`
2. **Eliminar de `ppt/_rels/presentation.xml.rels`**: Borrar la relación
3. **Eliminar de `[Content_Types].xml`**: Borrar la entrada Override
4. **Eliminar archivos**: Borrar `ppt/slides/slideN.xml` y `ppt/slides/_rels/slideN.xml.rels`
5. **Actualizar `docProps/app.xml`**: Decrementar conteo de diapositivas
6. **Limpiar multimedia no usada**: Eliminar imágenes huérfanas de `ppt/media/`

Nota: No renumerar diapositivas restantes - mantener sus IDs y nombres de archivo originales.

## Errores Comunes a Evitar

- **Codificaciones**: Escapar caracteres unicode en contenido ASCII: `"` se convierte en `&#8220;`
- **Imágenes**: Añadir a `ppt/media/` y actualizar archivos de relación
- **Listas**: Omitir viñetas de encabezados de lista
- **IDs**: Usar valores hexadecimales válidos para UUIDs
- **Temas**: Verificar todos los temas en el directorio `theme` para colores

## Lista de Verificación para Presentaciones Basadas en Plantillas

### Antes de Empaquetar, Siempre:

- **Limpiar recursos no usados**: Eliminar multimedia, fuentes y directorios de notas sin referencia
- **Arreglar Content_Types.xml**: Declarar TODAS las diapositivas, layouts y temas presentes en el paquete
- **Arreglar IDs de relación**: Eliminar referencias de fuentes embebidas si no se usan fuentes embebidas
- **Eliminar referencias rotas**: Verificar todos los archivos `_rels` para referencias a recursos eliminados

### Errores Comunes al Duplicar Plantillas:

- Múltiples diapositivas referenciando la misma diapositiva de notas después de duplicación
- Referencias a imágenes/multimedia de diapositivas de plantilla que ya no existen
- Referencias de fuentes embebidas cuando las fuentes no están incluidas
- Declaraciones de slideLayout faltantes para layouts 12-25
- El directorio docProps puede no desempaquetarse - esto es opcional
