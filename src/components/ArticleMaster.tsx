
import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
    ColDef,
    CellValueChangedEvent,
    GridReadyEvent,
    GridApi
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
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
        sortable: true,
        filter: true,
        minWidth: 100,
    }), []);

    const [quickFilterText, setQuickFilterText] = useState('');

    const onGridReady = (params: GridReadyEvent) => {
        setGridApi(params.api);
        // Auto-size columns to fit content
        params.api.autoSizeAllColumns();
    };

    // Update Quick Filter when text changes
    React.useEffect(() => {
        if (gridApi) {
            gridApi.updateGridOptions({ quickFilterText });
        }
    }, [quickFilterText, gridApi]);

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
            {/* Header Redesign */}
            <div className="flex flex-col gap-4 mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 tracking-tight">Maestro de Artículos</h2>

                    <div className="flex items-center gap-2">
                        {/* Global Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar en todos los campos..."
                                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
                                value={quickFilterText}
                                onChange={(e) => setQuickFilterText(e.target.value)}
                            />
                            {quickFilterText && (
                                <button
                                    onClick={() => setQuickFilterText('')}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        <div className="h-6 w-px bg-gray-300 mx-2"></div>

                        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium">
                            <Upload size={16} />
                            Importar
                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium">
                            <Download size={16} />
                            Exportar
                        </button>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex gap-2">
                    <button onClick={addNewRow} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-semibold">
                        <Plus size={16} /> Agregar Fila
                    </button>
                    <button onClick={deleteSelectedRows} className="flex items-center gap-2 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-semibold">
                        <Trash2 size={16} /> Eliminar
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full ag-theme-quartz shadow-sm rounded-lg overflow-hidden border border-gray-200">
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
                    rowHeight={32}
                    headerHeight={48}
                />
            </div>
        </div>
    );
};


