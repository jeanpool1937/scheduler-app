import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExportData {
    dailySchedules: any[];
    monthlyTotals: {
        tonnage: number;
        productionMinutes: number;
        stoppageMinutes: number;
    };
    articles: any[];
}

// --- Estilos compartidos ---
const createStyles = () => {
    const headerFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    const subHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
    };
    const centerStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center' };
    const rightStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'right' };
    const leftStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left' };

    return { headerFont, headerFill, subHeaderFill, borderStyle, centerStyle, rightStyle, leftStyle };
};

// --- Pestaña 1: Secuencia Diaria (Programación Visual) ---
const buildSecuenciaDiariaSheet = (workbook: ExcelJS.Workbook, data: ExportData) => {
    const { headerFont, headerFill, subHeaderFill, borderStyle, centerStyle, rightStyle, leftStyle } = createStyles();

    const sheet = workbook.addWorksheet('Secuencia Diaria', {
        views: [{ showGridLines: false }]
    });

    // Columnas
    sheet.columns = [
        { key: 'time', width: 15, style: { alignment: centerStyle } },
        { key: 'duration', width: 8, style: { alignment: centerStyle } },
        { key: 'sku', width: 15, style: { alignment: leftStyle } },
        { key: 'description', width: 50, style: { alignment: leftStyle } },
        { key: 'prodHours', width: 10, style: { alignment: rightStyle, numFmt: '0.0' } },
        { key: 'stopHours', width: 12, style: { alignment: rightStyle, numFmt: '0.0' } },
        { key: 'tonnage', width: 10, style: { alignment: rightStyle, numFmt: '#,##0' } },
    ];

    // Fila 1: Encabezado mensual
    const monthTitle = data.dailySchedules.length > 0
        ? format(new Date(data.dailySchedules[0].date), 'MMMM yyyy', { locale: es }).toUpperCase()
        : 'PROGRAMACIÓN MENSUAL';

    const monthlyRow = sheet.getRow(1);
    monthlyRow.values = [
        `PROGRAMACIÓN MENSUAL: ${monthTitle}`,
        '', '', '',
        data.monthlyTotals.productionMinutes / 60,
        data.monthlyTotals.stoppageMinutes / 60,
        data.monthlyTotals.tonnage
    ];
    monthlyRow.height = 30;

    monthlyRow.eachCell((cell, colNumber) => {
        cell.font = { ...headerFont, size: 12 };
        cell.fill = headerFill;
        cell.border = borderStyle;
        cell.alignment = colNumber <= 4 ? leftStyle : rightStyle;
        if (colNumber === 5 || colNumber === 6) cell.numFmt = '0.0 "h"';
        if (colNumber === 7) cell.numFmt = '#,##0 "T"';
    });
    sheet.mergeCells('A1:D1');
    monthlyRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Fila 2: Headers de columna
    const headerRow = sheet.getRow(2);
    headerRow.values = ['HORARIO', 'MIN', 'SKU / TIPO', 'ACTIVIDAD / DESCRIPCIÓN', 'H. PROD', 'H. PARADA', 'TON'];
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } };
        cell.alignment = centerStyle;
        cell.border = borderStyle;
    });

    // Filas de datos
    data.dailySchedules.forEach(day => {
        // Fila de día
        const dayRow = sheet.addRow([
            format(new Date(day.date), 'EEEE d MMMM', { locale: es }).toUpperCase(),
            '', '', '',
            day.totalProductionMinutes / 60,
            day.totalStoppageMinutes / 60,
            day.totalTonnage
        ]);

        const rowNum = dayRow.number;
        dayRow.height = 20;
        dayRow.eachCell((cell, colNum) => {
            cell.font = { bold: true, size: 11 };
            cell.fill = subHeaderFill;
            cell.border = borderStyle;
            cell.alignment = colNum >= 5 ? rightStyle : leftStyle;
            if (colNum === 5 || colNum === 6) cell.numFmt = '0.0';
            if (colNum === 7) cell.numFmt = '#,##0';
        });
        sheet.mergeCells(`A${rowNum}:D${rowNum}`);
        dayRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        // Eventos
        day.events.forEach((event: any) => {
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            const isProd = event.type === 'production';
            const durationHours = event.durationMinutes / 60;

            const row = sheet.addRow([
                `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
                Math.round(event.durationMinutes),
                event.skuCode || event.label,
                event.description || event.label,
                isProd ? durationHours : null,
                !isProd ? durationHours : null,
                (isProd && event.tonnage) ? event.tonnage : null
            ]);

            // Color de fondo
            let argbColor = 'FFFFFFFF';
            const type = event.type;
            const labelUpper = event.label ? event.label.toUpperCase() : '';
            const descUpper = event.description ? event.description.toUpperCase() : '';
            const isPeakHour = labelUpper.includes('HORA PUNTA') || descUpper.includes('HORA PUNTA') || type === 'maintenance_hp';
            const isChangeover = type === 'changeover' || type === 'adjustment';
            const isStop = type === 'maintenance_hp' || type === 'forced_stop' || type === 'stop_change' || type === 'quality_change' || type === 'ring_change' || type === 'channel_change';

            if (isPeakHour) argbColor = 'FFFFE4E6';
            else if (isChangeover) argbColor = 'FFFFF7ED';
            else if (isStop) argbColor = 'FFFFFBEB';

            if (event.color && event.color.startsWith('#') && event.color.length === 7) {
                argbColor = 'FF' + event.color.substring(1).toUpperCase();
            }

            const rowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbColor } };

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.fill = rowFill;
                cell.border = borderStyle;
                if (colNumber === 1) cell.alignment = centerStyle;
                if (colNumber === 2) cell.alignment = centerStyle;
                if (colNumber === 3) {
                    cell.alignment = leftStyle;
                    if (event.skuCode) cell.font = { bold: true };
                }
                if (colNumber === 4) {
                    cell.alignment = leftStyle;
                    if (isPeakHour) cell.font = { color: { argb: 'FFB91C1C' }, bold: true };
                }
                if (colNumber >= 5) cell.alignment = rightStyle;
                if (colNumber === 5 || colNumber === 6) cell.numFmt = '0.00';
                if (colNumber === 7) cell.numFmt = '#,##0.0';
            });
        });
    });
};

// --- Pestaña 2: Plan Mensual (una línea por orden de producción) ---
const buildPlanMensualSheet = (workbook: ExcelJS.Workbook, data: ExportData) => {
    const { headerFont, headerFill, borderStyle, centerStyle, rightStyle, leftStyle } = createStyles();
    const { dailySchedules, articles } = data;

    const lastColLetter = 'N'; // Columna N = columna 14

    const sheet = workbook.addWorksheet('Plan Mensual', {
        views: [{ showGridLines: true }]
    });

    const centerWrap: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const leftWrap: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Columnas
    sheet.columns = [
        { header: 'N°', key: 'num', width: 6, style: { alignment: centerStyle } },
        { header: 'ORDEN DE PROCESO', key: 'ordenProceso', width: 18, style: { alignment: centerStyle } },
        { header: 'CÓDIGO SAP', key: 'codigoSap', width: 15, style: { alignment: centerStyle } },
        { header: 'PRODUCTO', key: 'producto', width: 40, style: { alignment: leftWrap } },
        { header: 'Ritmo', key: 'ritmo', width: 10, style: { alignment: centerStyle } },
        { header: 'Rend. 1era', key: 'rend1era', width: 10, style: { alignment: centerStyle } },
        { header: 'CÓDIGO PACC', key: 'codigoPacc', width: 15, style: { alignment: centerStyle } },
        { header: 'CALIDAD PACC', key: 'calidadPacc', width: 15, style: { alignment: centerStyle } },
        { header: 'Prod. (Ton)', key: 'prod', width: 12, style: { alignment: rightStyle, numFmt: '#,##0.0' } },
        { header: 'Peso KG/PACC', key: 'pesoKgPacc', width: 12, style: { alignment: rightStyle, numFmt: '#,##0.0' } },
        { header: 'Alm Final', key: 'almFinal', width: 10, style: { alignment: centerStyle } },
        { header: 'FECHA INICIO', key: 'fechaInicio', width: 18, style: { alignment: centerWrap } },
        { header: 'FECHA FIN', key: 'fechaFin', width: 18, style: { alignment: centerWrap } },
        { header: 'Observaciones', key: 'observaciones', width: 30, style: { alignment: leftWrap } }
    ];

    // --- Agrupar eventos de producción por orden ---
    const orderMap = new Map<string, {
        skuCode: string;
        tonnage: number;
        startTime: Date;
        endTime: Date;
    }>();

    dailySchedules.forEach(day => {
        day.events.forEach((event: any) => {
            if (event.type === 'production' && event.originalItemId) {
                const key = event.originalItemId;
                const start = new Date(event.startTime);
                const end = new Date(event.endTime);
                const tonnage = event.tonnage || 0;

                if (orderMap.has(key)) {
                    const existing = orderMap.get(key)!;
                    existing.tonnage += tonnage;
                    if (start < existing.startTime) existing.startTime = start;
                    if (end > existing.endTime) existing.endTime = end;
                } else {
                    orderMap.set(key, {
                        skuCode: event.skuCode || '',
                        tonnage,
                        startTime: start,
                        endTime: end
                    });
                }
            }
        });
    });

    const orders = Array.from(orderMap.values()).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    let totalProduction = 0;
    orders.forEach(o => { totalProduction += o.tonnage; });

    // --- Mes para título ---
    const monthTitle = dailySchedules.length > 0
        ? format(new Date(dailySchedules[0].date), 'MMMM yyyy', { locale: es }).toUpperCase()
        : 'PLAN MENSUAL';

    // ============================================================
    // FILA 1: TÍTULO (abarca todas las columnas)
    // ============================================================
    const titleRow = sheet.getRow(1);
    titleRow.getCell(1).value = `PLAN MENSUAL: ${monthTitle}`;
    titleRow.height = 28;
    sheet.mergeCells(`A1:${lastColLetter}1`);
    titleRow.getCell(1).font = { ...headerFont, size: 13 };
    titleRow.getCell(1).fill = headerFill;
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // ============================================================
    // FILA 2: TOTAL TONELAJE (fila independiente)
    // ============================================================
    const totalRow = sheet.getRow(2);
    totalRow.getCell(1).value = totalProduction;
    totalRow.height = 22;
    sheet.mergeCells(`A2:${lastColLetter}2`);
    totalRow.getCell(1).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1E40AF' } };
    totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // blue-100
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    totalRow.getCell(1).numFmt = '#,##0.0 "Ton"';
    totalRow.getCell(1).border = borderStyle;

    // ============================================================
    // FILA 3: ENCABEZADOS DE COLUMNA
    // Orden: N° | ORDEN DE PROCESO | CÓDIGO SAP | PRODUCTO | FECHA INICIO | FECHA FIN | Prod (Ton) | Ritmo | Rend. 1era | CÓDIGO PACC | CALIDAD PACC | Peso KG/PACC | Alm Final | Observaciones
    // ============================================================
    const headers = [
        'N°', 'ORDEN DE PROCESO', 'CÓDIGO SAP', 'PRODUCTO', 'FECHA INICIO', 'FECHA FIN',
        'Prod. (Ton)', 'Ritmo', 'Rend. 1era', 'CÓDIGO PACC', 'CALIDAD PACC',
        'Peso KG/PACC', 'Alm Final', 'Observaciones'
    ];

    // Anchos fijos y compactos
    const colWidths = [
        5,    // N°
        18,   // ORDEN DE PROCESO
        14,   // CÓDIGO SAP
        38,   // PRODUCTO
        17,   // FECHA INICIO
        17,   // FECHA FIN
        11,   // Prod (Ton)
        7,    // Ritmo
        8,    // Rend. 1era
        13,   // CÓDIGO PACC
        16,   // CALIDAD PACC
        10,   // Peso KG/PACC
        8,    // Alm Final
        25    // Observaciones
    ];

    const headerRow = sheet.getRow(3);
    headerRow.height = 28;
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderStyle;
    });

    // Asignar anchos
    colWidths.forEach((w, i) => {
        const col = sheet.getColumn(i + 1);
        col.width = w;
    });

    // ============================================================
    // FILAS DE DATOS (a partir de fila 4)
    // ============================================================
    orders.forEach((order, index) => {
        const article = articles.find((a: any) => a.codigoProgramacion === order.skuCode);

        const rowValues = [
            index + 1,                                                              // N°
            '',                                                                     // ORDEN DE PROCESO (Vacío)
            article?.skuLaminacion || order.skuCode || '',                           // CÓDIGO SAP
            article?.descripcion || '',                                             // PRODUCTO
            format(order.startTime, 'EEE dd/MM HH:mm', { locale: es }),            // FECHA INICIO
            format(order.endTime, 'EEE dd/MM HH:mm', { locale: es }),              // FECHA FIN
            order.tonnage,                                                          // Prod (Ton)
            article?.ritmoTH || '',                                                 // Ritmo
            article?.rendimientoMetalico || '',                                     // Rend. 1era
            article?.skuPalanquilla || '',                                          // CÓDIGO PACC
            article?.calidadPalanquilla || '',                                      // CALIDAD PACC
            article?.pesoPalanquilla || '',                                         // Peso KG/PACC
            article?.almacenDestino || '',                                          // Alm Final
            article?.comentarios || ''                                              // Observaciones
        ];

        const row = sheet.addRow(rowValues);
        row.height = 20;

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            cell.border = borderStyle;

            // Alineaciones por columna
            if (colNum === 1) cell.alignment = centerStyle;        // N°
            else if (colNum === 2) cell.alignment = centerStyle;   // ORDEN DE PROCESO
            else if (colNum === 3) cell.alignment = centerStyle;   // CÓDIGO SAP
            else if (colNum === 4) cell.alignment = leftWrap;      // PRODUCTO
            else if (colNum === 5) cell.alignment = leftStyle;     // FECHA INICIO
            else if (colNum === 6) cell.alignment = leftStyle;     // FECHA FIN
            else if (colNum === 7) {                               // Prod (Ton)
                cell.alignment = rightStyle;
                cell.numFmt = '#,##0.0';
            }
            else if (colNum === 8) cell.alignment = centerStyle;   // Ritmo
            else if (colNum === 9) cell.alignment = centerStyle;   // Rend
            else if (colNum === 10) cell.alignment = centerStyle;  // CÓD PACC
            else if (colNum === 11) cell.alignment = leftStyle;    // CALIDAD PACC
            else if (colNum === 12) {                              // Peso KG/PACC
                cell.alignment = rightStyle;
                cell.numFmt = '#,##0';
            }
            else if (colNum === 13) cell.alignment = centerStyle;  // Alm Final
            else if (colNum === 14) cell.alignment = leftWrap;     // Observaciones
        });
    });
};

// --- Función principal: exportar todo en un solo archivo ---
export const exportFullReport = async (data: ExportData) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Scheduler App';
    workbook.lastModifiedBy = 'Scheduler App';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Pestaña 1: Secuencia Diaria
    buildSecuenciaDiariaSheet(workbook, data);

    // Pestaña 2: Plan Mensual
    buildPlanMensualSheet(workbook, data);

    // Guardar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const monthTitle = data.dailySchedules.length > 0
        ? format(new Date(data.dailySchedules[0].date), 'MMMM_yyyy', { locale: es })
        : format(new Date(), 'yyyy-MM-dd');

    const fileName = `Programacion_${monthTitle}_${format(new Date(), 'HHmm')}.xlsx`;
    saveAs(blob, fileName);
};
