import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExportData {
    dailySchedules: any[]; // Replace 'any' with your DailySchedule interface if available
    monthlyTotals: {
        tonnage: number;
        productionMinutes: number;
        stoppageMinutes: number;
    };
}

export const exportScheduleToExcel = async (data: ExportData) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Scheduler App';
    workbook.lastModifiedBy = 'Scheduler App';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Programación Visual', {
        views: [{ showGridLines: false }]
    });

    // --- STYLES ---
    const headerFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; // White text
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }; // Black bg
    const subHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Gray-200
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
    };
    const centerStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center' };
    const rightStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'right' };
    const leftStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left' };

    // --- COLUMNS SETUP ---
    // Defined WITHOUT 'header' property to prevent auto-header logic interference
    // We will manually write headers to Row 2.
    sheet.columns = [
        { key: 'time', width: 15, style: { alignment: centerStyle } },
        { key: 'duration', width: 8, style: { alignment: centerStyle } },
        { key: 'sku', width: 15, style: { alignment: leftStyle } },
        { key: 'description', width: 50, style: { alignment: leftStyle } },
        { key: 'prodHours', width: 10, style: { alignment: rightStyle, numFmt: '0.0' } },
        { key: 'stopHours', width: 12, style: { alignment: rightStyle, numFmt: '0.0' } },
        { key: 'tonnage', width: 10, style: { alignment: rightStyle, numFmt: '#,##0' } },
    ];

    // --- ROW 1: MONTHLY HEADER (TOTALS) ---
    const monthTitle = data.dailySchedules.length > 0
        ? format(new Date(data.dailySchedules[0].date), 'MMMM yyyy', { locale: es }).toUpperCase()
        : 'PROGRAMACIÓN MENSUAL';

    const monthlyRow = sheet.getRow(1);
    monthlyRow.values = [
        `PROGRAMACIÓN MENSUAL: ${monthTitle}`,
        '', '', '', // Merged A-D
        data.monthlyTotals.productionMinutes / 60,
        data.monthlyTotals.stoppageMinutes / 60,
        data.monthlyTotals.tonnage
    ];
    monthlyRow.height = 30;

    // Style Monthly Row
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


    // --- ROW 2: COLUMN HEADERS (Manual Write) ---
    const headerRow = sheet.getRow(2);
    headerRow.values = [
        'HORARIO',
        'MIN',
        'SKU / TIPO',
        'ACTIVIDAD / DESCRIPCIÓN',
        'H. PROD',
        'H. PARADA',
        'TON'
    ];
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
        cell.font = headerFont;
        // Dark Gray for headers
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } };
        cell.alignment = centerStyle;
        cell.border = borderStyle;
    });


    // --- DATA ROWS ---
    data.dailySchedules.forEach(day => {
        // 1. Day Header Row
        const dayRow = sheet.addRow([
            format(new Date(day.date), 'EEEE d MMMM', { locale: es }).toUpperCase(),
            '',
            '',
            '',
            day.totalProductionMinutes / 60,
            day.totalStoppageMinutes / 60,
            day.totalTonnage
        ]);

        const rowNum = dayRow.number;
        dayRow.height = 20;

        // Apply styles to the whole row first
        dayRow.eachCell((cell, colNum) => {
            cell.font = { bold: true, size: 11 };
            cell.fill = subHeaderFill;
            cell.border = borderStyle;
            cell.alignment = colNum >= 5 ? rightStyle : leftStyle; // Numbers right

            if (colNum === 5 || colNum === 6) cell.numFmt = '0.0';
            if (colNum === 7) cell.numFmt = '#,##0';
        });

        // Merge cells for Day Header (A-D for Date)
        sheet.mergeCells(`A${rowNum}:D${rowNum}`);
        dayRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };


        // 2. Events
        day.events.forEach((event: any) => {
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            const startTime = format(start, 'HH:mm');
            const endTime = format(end, 'HH:mm');

            const isProd = event.type === 'production';
            const durationHours = event.durationMinutes / 60;

            // Logic for columns E (Prod) and F (Stop)
            const prodHours = isProd ? durationHours : null;
            const stopHours = !isProd ? durationHours : null;
            const tonnage = (isProd && event.tonnage) ? event.tonnage : null;

            const row = sheet.addRow([
                `${startTime} - ${endTime}`,
                Math.round(event.durationMinutes),
                event.skuCode || event.label,
                (isProd && event.skuCode) ? (event.description || event.label) : (event.description || event.label),
                prodHours,
                stopHours,
                tonnage
            ]);

            // Determine Background Color
            let argbColor = 'FFFFFFFF'; // White default
            const type = event.type;
            const labelUpper = event.label ? event.label.toUpperCase() : '';
            const descUpper = event.description ? event.description.toUpperCase() : '';
            const isPeakHour = labelUpper.includes('HORA PUNTA') || descUpper.includes('HORA PUNTA') || type === 'maintenance_hp';
            const isChangeover = type === 'changeover' || type === 'adjustment';
            const isStop = type === 'maintenance_hp' || type === 'forced_stop' || type === 'stop_change' || type === 'quality_change' || type === 'ring_change' || type === 'channel_change';

            if (isPeakHour) argbColor = 'FFFFE4E6'; // red-50
            else if (isChangeover) argbColor = 'FFFFF7ED'; // orange-50
            else if (isStop) argbColor = 'FFFFFBEB'; // yellow-50

            if (event.color && event.color.startsWith('#') && event.color.length === 7) {
                argbColor = 'FF' + event.color.substring(1).toUpperCase();
            }

            const rowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbColor } };

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.fill = rowFill;
                cell.border = borderStyle;

                // Alignment overrides
                if (colNumber === 1) cell.alignment = centerStyle; // Time
                if (colNumber === 2) cell.alignment = centerStyle; // Min
                if (colNumber === 3) { // SKU
                    cell.alignment = leftStyle;
                    if (event.skuCode) cell.font = { bold: true };
                }
                if (colNumber === 4) { // Desc
                    cell.alignment = leftStyle;
                    if (isPeakHour) cell.font = { color: { argb: 'FFB91C1C' }, bold: true };
                }
                if (colNumber >= 5) cell.alignment = rightStyle; // Numbers

                // Number Formats
                if (colNumber === 5 || colNumber === 6) cell.numFmt = '0.00';
                if (colNumber === 7) cell.numFmt = '#,##0.0';
            });
        });
    });

    // --- AUTO WIDTH ADJUSTMENT (Optional fine-tuning) ---
    // sheet.columns.forEach(col => { if(col.width) col.width = col.width; }); 

    // --- FILE GENERATION ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Programacion_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;

    saveAs(blob, fileName);
};

export const exportMonthlyPlanReport = async (dailySchedules: any[], articles: any[]) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Scheduler App';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Plan Mensual', {
        views: [{ showGridLines: true }]
    });

    // --- STYLES ---
    const headerFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }; // Black
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
    };
    const centerStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const leftStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true };
    const rightStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'right' };

    // --- COLUMNS ---
    sheet.columns = [
        { header: 'OP / SAP', key: 'op', width: 12, style: { alignment: centerStyle } },
        { header: 'CÓDIGO SAP', key: 'codigoSap', width: 15, style: { alignment: centerStyle } },
        { header: 'PRODUCTO', key: 'producto', width: 40, style: { alignment: leftStyle } },
        { header: 'Ritmo', key: 'ritmo', width: 10, style: { alignment: centerStyle } },
        { header: 'Rend. 1era', key: 'rend1era', width: 10, style: { alignment: centerStyle } },
        { header: 'CÓDIGO PACC', key: 'codigoPacc', width: 15, style: { alignment: centerStyle } },
        { header: 'CALIDAD PACC', key: 'calidadPacc', width: 15, style: { alignment: centerStyle } },
        { header: 'Prod.', key: 'prod', width: 12, style: { alignment: rightStyle, numFmt: '#,##0.0' } },
        { header: 'Peso KG/PACC', key: 'pesoKgPacc', width: 12, style: { alignment: rightStyle, numFmt: '#,##0.0' } },
        { header: 'Alm Final', key: 'almFinal', width: 10, style: { alignment: centerStyle } },
        { header: 'Observaciones', key: 'observaciones', width: 30, style: { alignment: leftStyle } }
    ];

    // --- DATA PROCESSING ---
    const rows: any[] = [];
    let totalProduction = 0; // Calculate total

    dailySchedules.forEach(day => {
        day.events.forEach((event: any) => {
            if (event.type === 'production') {
                const article = articles.find((a: any) => a.codigoProgramacion === event.skuCode);
                const tonnage = event.tonnage || 0;
                totalProduction += tonnage;

                rows.push({
                    op: '', // User requested empty
                    codigoSap: article?.skuLaminacion || event.skuCode || '',
                    producto: article?.descripcion || event.description || '',
                    ritmo: article?.ritmoTH || '',
                    rend1era: article?.rendimientoMetalico || '',
                    codigoPacc: article?.skuPalanquilla || '',
                    calidadPacc: article?.calidadPalanquilla || '',
                    prod: tonnage,
                    pesoKgPacc: article?.pesoPalanquilla || '',
                    almFinal: article?.almacenDestino || '',
                    observaciones: article?.comentarios || ''
                });
            }
        });
    });

    // --- HEADER WITH TOTAL ---
    // User requested "total de produccion en la cabecera".
    // I'll add a row *above* the headers for the Month Title and Total.
    const monthTitle = dailySchedules.length > 0
        ? format(new Date(dailySchedules[0].date), 'MMMM yyyy', { locale: es }).toUpperCase()
        : 'PLAN MENSUAL';

    // Insert Main Header Row at index 1
    sheet.insertRow(1, [
        `PLAN MENSUAL: ${monthTitle}`,
        '', '', '', '', '', '', // Spacers
        totalProduction // Total under "Prod." column (Column 8 / H)
    ]);
    const mainHeaderRow = sheet.getRow(1);
    mainHeaderRow.height = 30;

    // Style Main Header
    mainHeaderRow.eachCell((cell, colNumber) => {
        cell.font = { ...headerFont, size: 12 };
        cell.fill = headerFill; // Black background for title row too?

        if (colNumber === 8) {
            cell.alignment = rightStyle; // Total Right Aligned
            cell.numFmt = '#,##0.0';
            cell.font = { ...headerFont, size: 12, color: { argb: 'FFFFFFFF' } }; // White Text
        } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }; // Centered Title
        }
    });

    // Merge Title Cells (A-G) leaving H for Total
    sheet.mergeCells('A1:G1');

    // --- COLUMN HEADERS ---
    // Column headers are now at Row 2 (because of insertRow).
    const colHeaderRow = sheet.getRow(2);
    colHeaderRow.height = 30;
    colHeaderRow.eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill; // Black Background
        cell.border = borderStyle;
        cell.alignment = centerStyle;
    });

    // --- ADD DATA ROWS ---
    rows.forEach(rowData => {
        const row = sheet.addRow(rowData);
        row.height = 25;
        row.eachCell((cell) => {
            cell.border = borderStyle;
            // Optional: Alternate row colors could be added here
        });
    });

    // --- SMART AUTO WIDTH ADJUSTMENT ---
    const MAX_COL_WIDTH = 60;
    const MIN_COL_WIDTH = 10;

    sheet.columns.forEach(column => {
        let maxLength = 0;
        if (column.header) {
            maxLength = column.header.toString().length;
        }

        column.eachCell && column.eachCell({ includeEmpty: true }, (cell) => {
            const cellValue = cell.value ? cell.value.toString() : '';
            // Only consider first 60 chars to avoid performance hit on huge text
            const len = cellValue.length;
            if (len > maxLength) {
                maxLength = len;
            }
        });

        // Add padding
        let finalWidth = maxLength + 2;

        // Enforce Min/Max limits
        if (finalWidth < MIN_COL_WIDTH) finalWidth = MIN_COL_WIDTH;
        if (finalWidth > MAX_COL_WIDTH) finalWidth = MAX_COL_WIDTH;

        column.width = finalWidth;
    });

    // --- SAVE ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Plan_Mensual_${monthTitle.replace(' ', '_')}.xlsx`;

    saveAs(blob, fileName);
};
