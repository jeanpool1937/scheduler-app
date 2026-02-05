
import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
    ColDef,
    CellValueChangedEvent,
    GridReadyEvent,
    GridApi
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import * as XLSX from 'xlsx';
import { useArticleStore } from '../store/useArticleStore';
import type { Article } from '../types/article';
import { Upload, Plus, Trash2, Download } from 'lucide-react';

export const ArticleMaster: React.FC = () => {
    const { articles, setArticles, addArticle, updateArticle, deleteArticles } = useArticleStore();
    const gridRef = useRef<AgGridReact>(null);
    const [gridApi, setGridApi] = useState<GridApi | null>(null);

    const columnDefs = useMemo<ColDef[]>(() => [
        { field: 'skuLaminacion', headerName: 'SKU Laminación', editable: true, filter: true, sortable: true, checkboxSelection: true, headerCheckboxSelection: true },
        { field: 'ending', headerName: 'Ending', editable: true, filter: true, sortable: true },
        { field: 'codigoProgramacion', headerName: 'Código Programación', editable: true, filter: true, sortable: true },
        { field: 'descripcion', headerName: 'Descripción', editable: true, filter: true, sortable: true, width: 200 },
        { field: 'skuPalanquilla', headerName: 'SKU Palanquilla', editable: true, filter: true, sortable: true },
        { field: 'calidadPalanquilla', headerName: 'Calidad Palanquilla', editable: true, filter: true, sortable: true },
        { field: 'ritmoTH', headerName: 'Ritmo t/h', editable: true, filter: true, sortable: true, type: 'numericColumn' },
        { field: 'rendimientoMetalico', headerName: 'Rendimiento Metálico %', editable: true, filter: true, sortable: true, type: 'numericColumn' },
        { field: 'fam', headerName: 'Fam.', editable: true, filter: true, sortable: true },
        { field: 'aciertoCalibracion', headerName: 'Acierto y Calibración (h)', editable: true, filter: true, sortable: true, type: 'numericColumn' },
        { field: 'idTablaCambioMedida', headerName: 'ID Tabla Cambio Medida', editable: true, filter: true, sortable: true },
        { field: 'pesoPalanquilla', headerName: 'Peso Palanquilla (kg)', editable: true, filter: true, sortable: true, type: 'numericColumn' },
        { field: 'almacenDestino', headerName: 'Almacén Destino', editable: true, filter: true, sortable: true },
        { field: 'comentarios', headerName: 'Comentarios', editable: true, filter: true, sortable: true, width: 250 },
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        flex: 1,
        minWidth: 100,
        wrapHeaderText: true,
        autoHeaderHeight: true,
    }), []);

    const onGridReady = (params: GridReadyEvent) => {
        setGridApi(params.api);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Process headers to map to Article interface
            const headers = data[0] as string[];
            const rows = data.slice(1);

            const mapHeaderToField = (header: string): keyof Article | undefined => {
                const h = header.trim().toLowerCase();
                if (h.includes('sku laminación') || h.includes('sku laminacion')) return 'skuLaminacion';
                if (h.includes('ending')) return 'ending';
                if (h.includes('codigo programación') || h.includes('codigo programacion')) return 'codigoProgramacion';
                if (h.includes('descripcion') || h.includes('descripción')) return 'descripcion';
                if (h.includes('sku palanquilla')) return 'skuPalanquilla';
                if (h.includes('calidad palanquilla')) return 'calidadPalanquilla';
                if (h.includes('ritmo t/h')) return 'ritmoTH';
                if (h.includes('rendimiento metalico') || h.includes('rendimiento metálico')) return 'rendimientoMetalico';
                if (h.includes('fam')) return 'fam';
                if (h.includes('acierto y calibración') || h.includes('acierto y calibracion')) return 'aciertoCalibracion';
                if (h.includes('id tabla de cambio')) return 'idTablaCambioMedida';
                if (h.includes('peso palanquilla')) return 'pesoPalanquilla';
                if (h.includes('almacen destino') || h.includes('almacén destino')) return 'almacenDestino';
                if (h.includes('comentarios')) return 'comentarios';
                return undefined;
            };

            const fieldMap: Record<number, keyof Article> = {};
            headers.forEach((h, index) => {
                const field = mapHeaderToField(h);
                if (field) fieldMap[index] = field;
            });

            const newArticles: Article[] = rows.map((row: any) => {
                const article: any = {};
                Object.keys(fieldMap).forEach((colIndex: any) => {
                    article[fieldMap[colIndex]] = row[colIndex];
                });
                return article as Article;
            }).filter(a => a.skuLaminacion); // Filter empty rows

            setArticles(newArticles);
        };
        reader.readAsBinaryString(file);
        // Reset input
        e.target.value = '';
    };

    const handleCellValueChanged = (event: CellValueChangedEvent) => {
        if (event.rowIndex !== null) {
            updateArticle(event.rowIndex, event.data);
        }
    };

    const addNewRow = () => {
        const newArticle: Article = {
            skuLaminacion: '', ending: '', codigoProgramacion: '', descripcion: '',
            skuPalanquilla: '', calidadPalanquilla: '', ritmoTH: 0, rendimientoMetalico: 0,
            fam: '', aciertoCalibracion: 0, idTablaCambioMedida: '', pesoPalanquilla: 0,
            almacenDestino: '', comentarios: ''
        };
        addArticle(newArticle);
        // Optional: Scroll to bottom
        setTimeout(() => {
            gridApi?.ensureIndexVisible(articles.length - 1);
        }, 100);
    };

    const deleteSelectedRows = () => {
        const selectedNodes = gridApi?.getSelectedNodes();
        if (selectedNodes && selectedNodes.length > 0) {
            const indicesToRemove = selectedNodes.map(node => node.rowIndex).filter(i => i !== null) as number[];
            // Sort in descending order to avoid index shifting issues if we deleted one by one, 
            // but store's deleteArticles handles array of indices logic.
            deleteArticles(indicesToRemove);
            gridApi?.deselectAll();
        }
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(articles);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Maestro Articulos");
        XLSX.writeFile(wb, "Maestro_Articulos_Export.xlsx");
    };

    return (
        <div className="h-full flex flex-col p-4 bg-gray-50">
            <div className="mb-4 flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">Base de Datos: Maestro de Artículos</h2>
                <div className="flex gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors">
                        <Upload size={18} />
                        Importar Excel
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                        <Download size={18} />
                        Exportar
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mb-2">
                <button onClick={addNewRow} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors">
                    <Plus size={16} /> Agregar Fila
                </button>
                <button onClick={deleteSelectedRows} className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
                    <Trash2 size={16} /> Eliminar Seleccionados
                </button>
            </div>

            <div className="flex-1 w-full ag-theme-alpine shadow-lg rounded-lg overflow-hidden border border-gray-200">
                <AgGridReact
                    ref={gridRef}
                    rowData={articles}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onGridReady={onGridReady}
                    onCellValueChanged={handleCellValueChanged}
                    rowSelection="multiple"
                    animateRows={true}
                    pagination={true}
                    paginationPageSize={50}
                />
            </div>
        </div>
    );
};


