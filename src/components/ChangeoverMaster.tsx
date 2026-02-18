
import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent, GridReadyEvent, GridApi } from 'ag-grid-community';
import * as XLSX from 'xlsx';
import { useChangeoverStore } from '../store/useChangeoverStore';
import type { ChangeoverRule } from '../types/changeover';
import { Upload, Plus, Trash2, Download } from 'lucide-react';

import { useStore } from '../store/useStore';

export const ChangeoverMaster: React.FC = () => {
    const activeProcessId = useStore((state) => state.activeProcessId);
    const rules = useChangeoverStore((state) => state.getRules(activeProcessId));
    const { setRules, addRule, updateRule, deleteRules } = useChangeoverStore();
    const gridRef = useRef<AgGridReact>(null);
    const [gridApi, setGridApi] = useState<GridApi | null>(null);

    const columnDefs = useMemo<ColDef[]>(() => [
        { field: 'fromId', headerName: 'ID Origen (From)', editable: true, filter: true, sortable: true, checkboxSelection: true, headerCheckboxSelection: true },
        { field: 'toId', headerName: 'ID Destino (To)', editable: true, filter: true, sortable: true },
        { field: 'durationHours', headerName: 'Tiempo (Horas)', editable: true, filter: true, sortable: true, type: 'numericColumn' },
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        sortable: true,
        filter: true,
        flex: 1,
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
            // Read as array of arrays (no headers assumption)
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            if (!data || data.length === 0) return;

            const newRules: ChangeoverRule[] = [];

            // The user specifies: "position in the table is the id... first row is for sku with id 1"
            // So: Row Index 0 -> From ID "1"
            //     Col Index 0 -> To ID "1"

            for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
                const row = data[rowIndex];
                // Skip empty rows if any, but maintain index-to-ID mapping?
                // "position is the id" imply row 0 is ALWAYS ID 1. If row 0 is empty, ID 1 has no rules.
                if (!row) continue;

                const fromId = (rowIndex + 1).toString();

                for (let colIndex = 0; colIndex < row.length; colIndex++) {
                    const toId = (colIndex + 1).toString();
                    const duration = row[colIndex];

                    // Import if it is a valid number
                    if (typeof duration === 'number') {
                        newRules.push({
                            fromId: fromId,
                            toId: toId,
                            durationHours: duration
                        });
                    }
                }
            }

            setRules(activeProcessId, newRules);
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleCellValueChanged = (event: CellValueChangedEvent) => {
        if (event.data.id) {
            updateRule(activeProcessId, event.data.id, event.data);
        }
    };

    const addNewRow = () => {
        const newRule: ChangeoverRule = {
            fromId: '',
            toId: '',
            durationHours: 0
        };
        addRule(activeProcessId, newRule);
        setTimeout(() => {
            gridApi?.ensureIndexVisible(rules.length - 1);
        }, 100);
    };

    const deleteSelectedRows = () => {
        const selectedNodes = gridApi?.getSelectedNodes();
        if (selectedNodes && selectedNodes.length > 0) {
            const idsToRemove = selectedNodes
                .map(node => node.data.id)
                .filter(id => !!id) as string[];

            deleteRules(activeProcessId, idsToRemove);
            gridApi?.deselectAll();
        }
    };

    const exportToExcel = () => {
        // Export as Flat List
        const ws = XLSX.utils.json_to_sheet(rules);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reglas Cambio");
        XLSX.writeFile(wb, "Reglas_Cambio.xlsx");
    };

    return (
        <div className="h-full flex flex-col p-4 bg-gray-50">
            {/* Header Redesign */}
            <div className="flex flex-col gap-4 mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 tracking-tight">Matriz de Tiempos de Cambio</h2>

                    <div className="flex items-center gap-2">
                        {/* Global Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 shadow-sm"
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
                            Importar Matriz
                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium">
                            <Download size={16} />
                            Exportar Lista
                        </button>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex gap-2">
                    <button onClick={addNewRow} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-semibold">
                        <Plus size={16} /> Agregar Regla
                    </button>
                    <button onClick={deleteSelectedRows} className="flex items-center gap-2 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-semibold">
                        <Trash2 size={16} /> Eliminar
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full ag-theme-quartz shadow-sm rounded-lg overflow-hidden border border-gray-200">
                <AgGridReact
                    ref={gridRef}
                    rowData={rules}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onGridReady={onGridReady}
                    onCellValueChanged={handleCellValueChanged}
                    getRowId={params => params.data.id}
                    rowSelection={{ mode: 'multiRow' }}
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
