
import React, { useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowDragEndEvent, ValueSetterParams } from 'ag-grid-community';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import type { ProductionScheduleItem } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const ProductionScheduler: React.FC = () => {
    const {
        schedule,
        stoppageConfigs,
        addScheduleItem,
        addScheduleItems,
        updateScheduleItem,
        deleteScheduleItem,
        clearSchedule,
        reorderSchedule,
        programStartDate,

        setProgramStartDate,
        recalculateSchedule
    } = useStore();

    // Force validation/recalculation on mount to ensure new columns populate
    React.useEffect(() => {
        recalculateSchedule();
    }, [recalculateSchedule]);

    // Use Articles as the master data
    // Use Articles as the master data
    const { articles } = useArticleStore();

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        sortable: true,
        wrapHeaderText: true,
        autoHeaderHeight: true,
    }), []);

    // Calculate program end date from last schedule item
    const programEndDate = useMemo(() => {
        if (schedule.length === 0) return null;
        const lastItem = schedule[schedule.length - 1];
        return lastItem?.endTime ? new Date(lastItem.endTime) : null;
    }, [schedule]);

    // Calculate totals for pinned bottom row
    const pinnedBottomRowData = useMemo(() => {
        if (schedule.length === 0) return [];

        const totals: any = {
            skuCode: 'TOTALES',
            quantity: schedule.reduce((sum, item) => sum + (item.quantity || 0), 0),
            productionTimeMinutes: schedule.reduce((sum, item) => sum + (item.productionTimeMinutes || 0), 0),
            changeoverMinutes: schedule.reduce((sum, item) => sum + (item.changeoverMinutes || 0), 0),
            qualityChangeMinutes: schedule.reduce((sum, item) => sum + (item.qualityChangeMinutes || 0), 0),
            stopChangeMinutes: schedule.reduce((sum, item) => sum + (item.stopChangeMinutes || 0), 0),
            adjustmentMinutes: schedule.reduce((sum, item) => sum + (item.adjustmentMinutes || 0), 0),
            stoppages: {}
        };

        // Sum dynamic stoppages
        stoppageConfigs.forEach(conf => {
            totals.stoppages[conf.id] = schedule.reduce((sum, item) => sum + (item.stoppages?.[conf.id] || 0), 0);
        });

        return [totals];
    }, [schedule, stoppageConfigs]);

    // --- Column Definitions ---
    const columnDefs = useMemo<ColDef<ProductionScheduleItem>[]>(() => {
        // 1. Static Columns
        const cols: ColDef<ProductionScheduleItem>[] = [
            { rowDrag: true, width: 50, pinned: 'left' },
            {
                headerName: 'Seq',
                width: 60,
                pinned: 'left',
                valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1
            },
            {
                field: 'skuCode',
                headerName: 'Cód. Producto',
                editable: true,
                pinned: 'left',
                width: 140, // Wider for real codes
                wrapHeaderText: true,
                autoHeaderHeight: true,
                cellClass: (params) => {
                    // Highlight if not found in articles
                    const exists = articles.some(a => a.codigoProgramacion === params.value);
                    return exists ? 'font-bold' : 'bg-red-50 text-red-600';
                }
            },
            {
                headerName: 'Descripción',
                width: 300,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                valueGetter: (params) => {
                    const sku = articles.find(a => a.codigoProgramacion === params.data?.skuCode);
                    return sku ? sku.descripcion : '---';
                }
            },
            {
                headerName: 'Calidad \nPalanquilla',
                width: 120,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                valueGetter: (params) => {
                    const sku = articles.find(a => a.codigoProgramacion === params.data?.skuCode);
                    return sku?.calidadPalanquilla || '---';
                }
            },
            {
                field: 'quantity',
                headerName: 'Cantidad (Ton)',
                editable: true,
                width: 110,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                type: 'numericColumn',
                valueParser: (params) => {
                    if (!params.newValue) return 0;
                    return parseFloat(String(params.newValue).replace(/,/g, ''));
                }
            },
            {
                headerName: 'Ritmo (T/H)',
                width: 100,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                valueGetter: (params) => params.data?.calculatedPace?.toFixed(0) || 0
            },
            {
                headerName: 'H-Trab',
                width: 90,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                valueGetter: (params) => ((params.data?.productionTimeMinutes || 0) / 60).toFixed(1)
            }
        ];

        // 2. Calculated Changeover Column
        cols.push({
            headerName: 'Cambio \n(Auto)',
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.changeoverMinutes ? `${Math.round(params.data.changeoverMinutes)} min` : '-',
            cellStyle: (params) => params.data?.changeoverMinutes ? { color: '#e11d48', fontWeight: 'bold' } : undefined
        });

        // 2.1 Calculated Quality Change Column
        cols.push({
            headerName: 'Cambio \nCalidad',
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.qualityChangeMinutes ? `${Math.round(params.data.qualityChangeMinutes)} min` : '-',
            cellStyle: (params) => params.data?.qualityChangeMinutes ? { color: '#9d174d', fontWeight: 'bold' } : undefined // pink-800
        });

        // 2.2 Calculated Stop Change Column (Cambio de Tope)
        cols.push({
            headerName: 'Cambio \nTope',
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.stopChangeMinutes ? `${Math.round(params.data.stopChangeMinutes)} min` : '-',
            cellStyle: (params) => params.data?.stopChangeMinutes ? { color: '#0d9488', fontWeight: 'bold' } : undefined // teal-600
        });

        // 2.5 Calculated Adjustment Column (Acierto)
        cols.push({
            headerName: 'Acierto y Calibración',
            width: 130,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.adjustmentMinutes ? `${Math.round(params.data.adjustmentMinutes)} min` : '-',
            cellStyle: (params) => params.data?.adjustmentMinutes ? { color: '#ca8a04', fontWeight: 'bold' } : undefined // yellow-600
        });

        // 3. Dynamic Stoppage Columns
        stoppageConfigs.forEach(conf => {
            cols.push({
                headerName: conf.label,
                colId: conf.id,
                width: 100,
                editable: true,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                type: 'numericColumn',
                valueGetter: (params) => params.data?.stoppages?.[conf.id] || 0,
                valueSetter: (params: ValueSetterParams<ProductionScheduleItem>) => {
                    const newVal = Number(String(params.newValue).replace(/,/g, ''));
                    if (isNaN(newVal)) return false;

                    // Direct manipulation for immediate UI response (React state updates later via event)
                    const stoppages = params.data.stoppages || {};
                    params.data.stoppages = {
                        ...stoppages,
                        [conf.id]: newVal
                    };
                    return true;
                }
            });
        });

        // 3. Time Columns (Calculated)
        cols.push({
            headerName: 'Inicio',
            width: 160,
            valueGetter: (params) => params.data?.startTime,
            valueFormatter: (params) => {
                if (!params.value) return '';
                try {
                    return format(new Date(params.value), 'EEE dd/MM HH:mm', { locale: es });
                } catch (e) { return ''; }
            }
        });

        cols.push({
            headerName: 'Fin',
            width: 160,
            valueGetter: (params) => params.data?.endTime,
            valueFormatter: (params) => {
                if (!params.value) return '';
                try {
                    return format(new Date(params.value), 'EEE dd/MM HH:mm', { locale: es });
                } catch (e) { return ''; }
            },
            cellStyle: { fontWeight: 'bold', color: '#1e3a8a' } // Blue text
        });

        // 4. Delete Action
        cols.push({
            headerName: '',
            width: 60,
            cellRenderer: (params: any) => (
                <button onClick={() => deleteScheduleItem(params.data.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={16} />
                </button>
            )
        });

        return cols;
    }, [articles, stoppageConfigs, deleteScheduleItem]);


    // --- Event Handlers ---

    const gridRef = React.useRef<AgGridReact>(null);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const clipboardData = e.clipboardData.getData('text');
        if (!clipboardData) return;

        const api = gridRef.current?.api;
        const focusedCell = api?.getFocusedCell();
        const rows = clipboardData.split(/\r\n|\r|\n/).filter(row => row.trim() !== '');

        if (rows.length === 0) return;

        // --- Logic A: Paste into Quantity Column (Update Only) ---
        if (focusedCell?.column.getColId() === 'quantity') {
            e.preventDefault(); // Stop default generic paste
            const startRowIndex = focusedCell.rowIndex;
            if (startRowIndex === null || startRowIndex === undefined) return;

            rows.forEach((row, offset) => {
                const targetIndex = startRowIndex + offset;
                if (targetIndex >= schedule.length) return; // Stop if end of table

                // Assume single column of numbers
                const valStr = row.split('\t')[0].trim();
                const val = parseFloat(valStr.replace(/,/g, ''));

                if (!isNaN(val)) {
                    const targetItem = schedule[targetIndex];
                    updateScheduleItem(targetItem.id, { quantity: val });
                }
            });
            return;
        }

        // --- Logic B: Paste into Product Code (Create or Update) ---
        // Or default if no focus (Legacy behavior)

        // If we are focused on 'skuCode', we try to update existing rows first, then create new ones?
        // OR we just assume "Bulk Add" if it's a large paste?
        // User workflow seems to be: Copy from Excel, Paste to ADD to the list or UPDATE.

        // Let's implement robust "Create New" but verify columns.

        const newItems: ProductionScheduleItem[] = [];
        let startingSequence = schedule.length;

        // If the user meant to paste Quantities but clicked "Code", we can't really save them, 
        // effectively this is user error or bad copy. 
        // But we can check if it looks like a valid code lookup? No, that's too heavy.

        // We will assume that if we are NOT in Quantity column, we are adding new items (Legacy)
        // BUT we should respect 2 columns vs 1 column

        rows.forEach((row, index) => {
            const cols = row.split('\t');
            if (cols.length === 0) return;

            const skuCode = cols[0].trim();
            // Optional Quantity in 2nd column
            const quantity = cols.length > 1 ? (parseFloat(cols[1].trim().replace(/,/g, '')) || 0) : 0;

            if (skuCode) {
                newItems.push({
                    id: uuidv4(),
                    sequenceOrder: startingSequence + index,
                    skuCode,
                    quantity,
                    calculatedPace: 0,
                    productionTimeMinutes: 0,
                    stoppages: {},
                    startTime: new Date(),
                    endTime: new Date()
                });
            }
        });

        if (newItems.length > 0) {
            e.preventDefault();
            addScheduleItems(newItems);
        }
    }, [schedule, addScheduleItems, updateScheduleItem]);


    const onCellValueChanged = useCallback((event: any) => {
        if (!event.data) return;

        const { id } = event.data;
        const field = event.colDef.field;
        const colId = event.colDef.colId; // Used for stoppages

        // Check if it's a stoppage column
        const isStoppage = stoppageConfigs.some(s => s.id === colId);

        if (isStoppage && colId) {
            updateScheduleItem(id, {
                stoppages: {
                    ...event.data.stoppages,
                    [colId]: Number(event.newValue)
                }
            });
        } else if (field) {
            // Standard field update
            updateScheduleItem(id, { [field]: event.newValue });
        }
    }, [updateScheduleItem, stoppageConfigs]);

    const onRowDragEnd = useCallback((event: RowDragEndEvent) => {
        const newOrder: ProductionScheduleItem[] = [];
        event.api.forEachNode((node) => {
            if (node.data) newOrder.push(node.data);
        });
        reorderSchedule(newOrder);
    }, [reorderSchedule]);


    const handleAddItem = () => {
        addScheduleItem({
            id: uuidv4(),
            sequenceOrder: schedule.length,
            skuCode: '',
            quantity: 0,
            calculatedPace: 0,
            productionTimeMinutes: 0,
            stoppages: {},
            startTime: new Date(),
            endTime: new Date()
        });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setProgramStartDate(new Date(e.target.value));
        }
    };

    const handleClearAll = () => {
        if (window.confirm('¿Estás seguro de que quieres BORRAR TODA la programación? esta acción no se puede deshacer.')) {
            clearSchedule();
        }
    };

    return (
        <div
            className="h-full flex flex-col gap-2"
            onPaste={handlePaste}
            tabIndex={0} // Make div focusable to catch paste events
            style={{ outline: 'none' }}
        >
            <div className="flex justify-between items-center p-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">Programación de Producción</h2>

                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded border border-gray-200">
                        <CalendarClock size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-600">Inicio:</span>
                        <input
                            type="datetime-local"
                            className="bg-transparent text-sm font-bold text-gray-800 outline-none w-40"
                            value={programStartDate ? format(new Date(programStartDate), "yyyy-MM-dd'T'HH:mm") : ''}
                            onChange={handleDateChange}
                        />
                    </div>
                    {programEndDate && (
                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded border border-blue-200">
                            <CalendarClock size={16} className="text-blue-500" />
                            <span className="text-sm font-medium text-blue-600">Fin:</span>
                            <span className="text-sm font-bold text-blue-800">
                                {format(programEndDate, 'EEE dd/MM HH:mm', { locale: es })}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {/* Visual indicator of auto-save */}
                    <span className="text-xs text-green-600 flex items-center px-2 bg-green-50 rounded border border-green-100">
                        ✓ Guardado automático
                    </span>

                    <button
                        onClick={handleClearAll}
                        className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded shadow-sm hover:bg-red-100 transition mr-2"
                        title="Borrar toda la tabla"
                    >
                        <Trash2 size={16} /> Limpiar Todo
                    </button>

                    <button
                        onClick={handleAddItem}
                        className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded shadow-sm hover:bg-green-700 transition"
                    >
                        <Plus size={18} /> Nuevo Item
                    </button>
                </div>
            </div>

            <div className="flex-1 ag-theme-quartz">
                <AgGridReact
                    ref={gridRef}
                    rowData={schedule}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowDragManaged={true}
                    rowSelection="multiple"
                    rowDragMultiRow={true}
                    rowDragEntireRow={false}
                    suppressRowClickSelection={false} // Allow clicking to select
                    onRowDragEnd={onRowDragEnd}
                    onCellValueChanged={onCellValueChanged}
                    animateRows={true}
                    getRowId={(params) => params.data.id}
                    pinnedBottomRowData={pinnedBottomRowData}
                />
            </div>
        </div>
    );
};
