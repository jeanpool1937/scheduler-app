
import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent, GridReadyEvent, GridApi } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import * as XLSX from 'xlsx';
import { useChangeoverStore } from '../store/useChangeoverStore';
import type { ChangeoverRule } from '../types/changeover';
import { Upload, Plus, Trash2, Download } from 'lucide-react';

export const ChangeoverMaster: React.FC = () => {
    const { rules, setRules, addRule, updateRule, deleteRules } = useChangeoverStore();
    const gridRef = useRef<AgGridReact>(null);
    const [gridApi, setGridApi] = useState<GridApi | null>(null);

    const columnDefs = useMemo<ColDef[]>(() => [
        { field: 'fromId', headerName: 'ID Origen (From)', editable: true, filter: true, sortable: true, checkboxSelection: true, headerCheckboxSelection: true },
        { field: 'toId', headerName: 'ID Destino (To)', editable: true, filter: true, sortable: true },
        { field: 'durationHours', headerName: 'Tiempo (Horas)', editable: true, filter: true, sortable: true, type: 'numericColumn' },
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

            setRules(newRules);
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleCellValueChanged = (event: CellValueChangedEvent) => {
        if (event.rowIndex !== null) {
            updateRule(event.rowIndex, event.data);
        }
    };

    const addNewRow = () => {
        const newRule: ChangeoverRule = {
            fromId: '',
            toId: '',
            durationHours: 0
        };
        addRule(newRule);
        setTimeout(() => {
            gridApi?.ensureIndexVisible(rules.length - 1);
        }, 100);
    };

    const deleteSelectedRows = () => {
        const selectedNodes = gridApi?.getSelectedNodes();
        if (selectedNodes && selectedNodes.length > 0) {
            const indicesToRemove = selectedNodes.map(node => node.rowIndex).filter(i => i !== null) as number[];
            deleteRules(indicesToRemove);
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
            <div className="mb-4 flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">Matriz de Tiempos de Cambio</h2>
                <div className="flex gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors">
                        <Upload size={18} />
                        Importar Matriz
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                        <Download size={18} />
                        Exportar Lista
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mb-2">
                <button onClick={addNewRow} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors">
                    <Plus size={16} /> Agregar Regla
                </button>
                <button onClick={deleteSelectedRows} className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
                    <Trash2 size={16} /> Eliminar Seleccionados
                </button>
            </div>

            <div className="flex-1 w-full ag-theme-alpine shadow-lg rounded-lg overflow-hidden border border-gray-200">
                <AgGridReact
                    ref={gridRef}
                    rowData={rules}
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
