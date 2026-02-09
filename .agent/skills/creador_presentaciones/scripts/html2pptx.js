/**
 * Convertir diapositivas HTML a presentación PowerPoint.
 *
 * Este script usa Playwright para renderizar archivos HTML y PptxGenJS
 * para generar el archivo PowerPoint.
 *
 * Uso:
 *   node html2pptx.js slide1.html slide2.html ... output.pptx
 *
 * Cada archivo HTML representa una diapositiva. El body debe tener dimensiones
 * de 1280x720 píxeles (proporción 16:9).
 *
 * Dependencias:
 *   - pptxgenjs
 *   - playwright
 *   - sharp (para procesamiento de imágenes)
 */

const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { chromium } = require("playwright");

// Constantes de configuración
const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;
const PPTX_WIDTH_INCHES = 10;
const PPTX_HEIGHT_INCHES = 5.625;
const SCALE_X = PPTX_WIDTH_INCHES / SLIDE_WIDTH;
const SCALE_Y = PPTX_HEIGHT_INCHES / SLIDE_HEIGHT;

/**
 * Convertir archivos HTML a presentación PowerPoint.
 * @param {string[]} htmlFiles - Rutas a archivos HTML
 * @param {string} outputPath - Ruta de salida para archivo PPTX
 * @param {Object} options - Opciones adicionales
 */
async function html2pptx(htmlFiles, outputPath, options = {}) {
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_16x9";

    // Lanzar navegador para renderizar HTML
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
        deviceScaleFactor: 2,
    });

    const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "html2pptx-"));

    try {
        for (let i = 0; i < htmlFiles.length; i++) {
            const htmlFile = htmlFiles[i];
            console.log(`Procesando diapositiva ${i + 1}: ${htmlFile}`);

            const page = await context.newPage();
            const absolutePath = path.resolve(htmlFile);
            await page.goto(`file://${absolutePath}`, { waitUntil: "networkidle" });

            // Capturar datos de la diapositiva
            const slideData = await page.evaluate(() => {
                const elements = [];
                const allElements = document.querySelectorAll("body *");

                allElements.forEach((el) => {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();

                    // Ignorar elementos invisibles o sin contenido
                    if (
                        style.display === "none" ||
                        style.visibility === "hidden" ||
                        rect.width === 0 ||
                        rect.height === 0
                    ) {
                        return;
                    }

                    const tagName = el.tagName.toLowerCase();

                    // Procesar elementos de texto
                    if (
                        ["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "li"].includes(
                            tagName
                        ) &&
                        el.textContent.trim()
                    ) {
                        // Verificar que el texto directo pertenece a este elemento
                        const directText = Array.from(el.childNodes)
                            .filter((node) => node.nodeType === Node.TEXT_NODE)
                            .map((node) => node.textContent.trim())
                            .join(" ");

                        if (
                            directText ||
                            el.children.length === 0 ||
                            el.children[0].tagName === "BR"
                        ) {
                            elements.push({
                                type: "text",
                                text: el.textContent.trim(),
                                x: rect.left,
                                y: rect.top,
                                w: rect.width,
                                h: rect.height,
                                fontSize: parseFloat(style.fontSize),
                                fontFamily: style.fontFamily.split(",")[0].replace(/"/g, ""),
                                fontWeight: style.fontWeight,
                                fontStyle: style.fontStyle,
                                color: style.color,
                                textAlign: style.textAlign,
                                lineHeight: parseFloat(style.lineHeight) || undefined,
                            });
                        }
                    }

                    // Procesar imágenes
                    if (tagName === "img") {
                        elements.push({
                            type: "image",
                            src: el.src,
                            x: rect.left,
                            y: rect.top,
                            w: rect.width,
                            h: rect.height,
                        });
                    }

                    // Procesar placeholders para contenido futuro
                    if (el.classList.contains("placeholder")) {
                        elements.push({
                            type: "placeholder",
                            x: rect.left,
                            y: rect.top,
                            w: rect.width,
                            h: rect.height,
                            label: el.dataset.label || "Placeholder",
                        });
                    }
                });

                // Obtener color de fondo
                const bodyStyle = window.getComputedStyle(document.body);
                let background = bodyStyle.backgroundColor;

                // Verificar si hay imagen de fondo
                if (
                    bodyStyle.backgroundImage &&
                    bodyStyle.backgroundImage !== "none"
                ) {
                    const match = bodyStyle.backgroundImage.match(/url\(["']?(.+?)["']?\)/);
                    if (match) {
                        background = { type: "image", url: match[1] };
                    }
                }

                return { elements, background };
            });

            // Añadir diapositiva a la presentación
            const slide = pres.addSlide();

            // Aplicar fondo
            await addBackground(slideData, slide, tmpDir, page);

            // Añadir elementos
            addElements(slideData, slide, pres);

            await page.close();
        }

        // Guardar presentación
        await pres.writeFile({ fileName: outputPath });
        console.log(`Presentación guardada: ${outputPath}`);
    } finally {
        await browser.close();

        // Limpiar directorio temporal
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

/**
 * Añadir fondo a diapositiva.
 */
async function addBackground(slideData, slide, tmpDir, page) {
    const { background } = slideData;

    if (!background) return;

    if (typeof background === "object" && background.type === "image") {
        // Fondo de imagen
        try {
            const bgPath = path.join(tmpDir, "bg.png");
            const bgBuffer = await page.screenshot({
                clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
            });
            fs.writeFileSync(bgPath, bgBuffer);
            slide.addImage({ path: bgPath, w: "100%", h: "100%" });
        } catch (e) {
            console.warn("  Advertencia: No se pudo añadir fondo de imagen:", e.message);
        }
    } else if (typeof background === "string") {
        // Fondo de color sólido
        const color = rgbToHex(background);
        if (color) {
            slide.background = { color };
        }
    }
}

/**
 * Añadir elementos a diapositiva.
 */
function addElements(slideData, slide, pres) {
    for (const el of slideData.elements) {
        try {
            switch (el.type) {
                case "text":
                    addTextElement(slide, el);
                    break;
                case "image":
                    addImageElement(slide, el);
                    break;
                case "placeholder":
                    addPlaceholder(slide, el);
                    break;
            }
        } catch (e) {
            console.warn(`  Advertencia: No se pudo añadir elemento ${el.type}:`, e.message);
        }
    }
}

/**
 * Añadir elemento de texto.
 */
function addTextElement(slide, el) {
    const options = {
        x: el.x * SCALE_X,
        y: el.y * SCALE_Y,
        w: el.w * SCALE_X,
        h: el.h * SCALE_Y,
        fontSize: el.fontSize * 0.75, // Convertir px a pt
        fontFace: el.fontFamily || "Arial",
        bold: el.fontWeight === "bold" || parseInt(el.fontWeight) >= 700,
        italic: el.fontStyle === "italic",
        color: rgbToHex(el.color) || "000000",
        valign: "top",
        align: el.textAlign || "left",
    };

    slide.addText([{ text: el.text, options: {} }], options);
}

/**
 * Añadir elemento de imagen.
 */
function addImageElement(slide, el) {
    if (!el.src) return;

    const options = {
        x: el.x * SCALE_X,
        y: el.y * SCALE_Y,
        w: el.w * SCALE_X,
        h: el.h * SCALE_Y,
    };

    if (el.src.startsWith("data:")) {
        options.data = el.src;
    } else if (el.src.startsWith("file://") || el.src.startsWith("/")) {
        options.path = el.src.replace("file://", "");
    } else {
        options.path = el.src;
    }

    slide.addImage(options);
}

/**
 * Añadir placeholder para contenido futuro.
 */
function addPlaceholder(slide, el) {
    slide.addShape(pres.shapes.RECTANGLE, {
        x: el.x * SCALE_X,
        y: el.y * SCALE_Y,
        w: el.w * SCALE_X,
        h: el.h * SCALE_Y,
        fill: { color: "EEEEEE" },
        line: { color: "CCCCCC", width: 1 },
    });

    if (el.label) {
        slide.addText(el.label, {
            x: el.x * SCALE_X,
            y: el.y * SCALE_Y,
            w: el.w * SCALE_X,
            h: el.h * SCALE_Y,
            fontSize: 12,
            color: "999999",
            align: "center",
            valign: "middle",
        });
    }
}

/**
 * Convertir color RGB a hexadecimal.
 */
function rgbToHex(rgb) {
    if (!rgb) return null;

    // Ya es hexadecimal
    if (rgb.startsWith("#")) {
        return rgb.substring(1).toUpperCase();
    }

    // Parsear formato rgb/rgba
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, "0");
        const g = parseInt(match[2]).toString(16).padStart(2, "0");
        const b = parseInt(match[3]).toString(16).padStart(2, "0");
        return `${r}${g}${b}`.toUpperCase();
    }

    return null;
}

// Punto de entrada principal
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log("Uso: node html2pptx.js slide1.html slide2.html ... output.pptx");
        console.log("\nCada archivo HTML representa una diapositiva.");
        console.log("El último argumento es el archivo de salida .pptx");
        process.exit(1);
    }

    const outputPath = args[args.length - 1];
    const htmlFiles = args.slice(0, -1);

    // Validar entrada
    if (!outputPath.endsWith(".pptx")) {
        console.error("Error: El archivo de salida debe tener extensión .pptx");
        process.exit(1);
    }

    for (const htmlFile of htmlFiles) {
        if (!fs.existsSync(htmlFile)) {
            console.error(`Error: Archivo HTML no encontrado: ${htmlFile}`);
            process.exit(1);
        }
    }

    try {
        await html2pptx(htmlFiles, outputPath);
    } catch (e) {
        console.error("Error creando presentación:", e.message);
        process.exit(1);
    }
}

main();

module.exports = { html2pptx };
