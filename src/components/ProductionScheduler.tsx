import React, { useCallback, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowDragEndEvent, ValueSetterParams, GridReadyEvent } from 'ag-grid-community';
import { useStore } from '../store/useStore';
import { useArticleStore } from '../store/useArticleStore';
import type { ProductionScheduleItem } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, CalendarClock, Undo2, RotateCcw, Eye, Save, Columns } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { TargetDateModal } from './TargetDateModal';

// Clave para guardar el estado de columnas en localStorage
const COLUMN_STATE_KEY = 'scheduler-column-state';

export const ProductionScheduler: React.FC = () => {
    const activeProcessId = useStore((state) => state.activeProcessId);
    const processData = useStore((state) => state.processes[state.activeProcessId]);

    const {
        schedule,
        stoppageConfigs,
        programStartDate,
        scheduleHistory,
        columnLabels
    } = processData;

    const {
        insertScheduleItem,
        addScheduleItems,
        updateScheduleItem,
        deleteScheduleItem,
        clearSchedule,
        reorderSchedule,
        setProgramStartDate,
        recalculateSchedule,
        undo,
        canUndo,
        setColumnLabel,
        updateItemEndTime,
        setActiveTab,
        setVisualTargetDate
    } = useStore();

    const articles = useArticleStore((state) => state.getArticles(activeProcessId));

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; rowId: string } | null>(null);

    // Grid Ref
    const gridRef = React.useRef<AgGridReact>(null);

    // --- Custom Cell Selection State ---
    const [selectionStart, setSelectionStart] = useState<{ rowIndex: number; colId: string } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<{ rowIndex: number; colId: string } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    // Reset selection on outside click
    React.useEffect(() => {
        const handleMouseUp = () => setIsSelecting(false);
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    // Helper to format values for clipboard
    const getFormattedValue = useCallback((api: any, rowNode: any, col: any) => {
        const colDef = col.getColDef();
        let value = api.getCellValue({ rowNode, colId: col.getColId() });

        if (colDef.valueFormatter) {
            value = colDef.valueFormatter({
                value,
                data: rowNode.data,
                node: rowNode,
                colDef,
                api,
                column: col,
                context: api.getGridOption('context')
            });
        }
        return value;
    }, []);

    // Copy Handler
    React.useEffect(() => {
        const handleCopy = (e: ClipboardEvent) => {
            if (!selectionStart || !selectionEnd || !gridRef.current?.api) return;

            // Check if we are focusing an input outside the grid
            const activeElement = document.activeElement;
            const isGridFocused = activeElement?.closest('.ag-theme-quartz') || activeElement === document.body;

            if (!isGridFocused && activeElement?.tagName === 'INPUT') return;

            const api = gridRef.current.api;
            // Use displayed columns to respect user reordering
            const displayedColumns = api.getAllDisplayedColumns();

            const startColIndex = displayedColumns.findIndex((c: any) => c.getColId() === selectionStart.colId);
            const endColIndex = displayedColumns.findIndex((c: any) => c.getColId() === selectionEnd.colId);

            if (startColIndex === -1 || endColIndex === -1) return;

            const minColIdx = Math.min(startColIndex, endColIndex);
            const maxColIdx = Math.max(startColIndex, endColIndex);

            const minRowIdx = Math.min(selectionStart.rowIndex, selectionEnd.rowIndex);
            const maxRowIdx = Math.max(selectionStart.rowIndex, selectionEnd.rowIndex);

            const rows: string[] = [];

            for (let r = minRowIdx; r <= maxRowIdx; r++) {
                const rowNode = api.getDisplayedRowAtIndex(r);
                if (!rowNode) continue;

                const rowCells: string[] = [];
                for (let c = minColIdx; c <= maxColIdx; c++) {
                    const col = displayedColumns[c];
                    const val = getFormattedValue(api, rowNode, col);
                    rowCells.push(val != null ? String(val) : '');
                }
                rows.push(rowCells.join('\t'));
            }

            if (rows.length > 0) {
                const text = rows.join('\n');
                if (e.clipboardData) {
                    e.clipboardData.setData('text/plain', text);
                    e.preventDefault();
                }
            }
        };

        document.addEventListener('copy', handleCopy as any);
        return () => document.removeEventListener('copy', handleCopy as any);
    }, [selectionStart, selectionEnd, getFormattedValue]);

    const onCellMouseDown = useCallback((params: any) => {
        // Start selection
        if (params.node.rowIndex === null || params.node.rowIndex === undefined) return;

        if (params.event.shiftKey && selectionStart) {
            setSelectionEnd({ rowIndex: params.node.rowIndex, colId: params.column.getColId() });
            setIsSelecting(true);
        } else {
            setSelectionStart({ rowIndex: params.node.rowIndex, colId: params.column.getColId() });
            setSelectionEnd({ rowIndex: params.node.rowIndex, colId: params.column.getColId() });
            setIsSelecting(true);
        }
    }, [selectionStart]);

    const onCellMouseOver = useCallback((params: any) => {
        if (isSelecting && params.node.rowIndex !== null && params.node.rowIndex !== undefined) {
            setSelectionEnd({ rowIndex: params.node.rowIndex, colId: params.column.getColId() });
        }
    }, [isSelecting]);

    // Traffic Light System Logic
    const getRowStatus = useCallback((data: ProductionScheduleItem) => {
        const totalStoppages = data.stoppages ? Object.values(data.stoppages).reduce((a, b) => a + (b || 0), 0) : 0;
        const maintenance = (data.segments || []).filter(s => s.type === 'maintenance_hp').reduce((a, b) => a + b.durationMinutes, 0);

        if (maintenance > 0 || totalStoppages > 30) return 'critical'; // Red
        if ((data.changeoverMinutes || 0) > 0 || (data.adjustmentMinutes || 0) > 0) return 'warning'; // Yellow
        return 'normal'; // Green
    }, []);

    const rowClassRules = useMemo(() => ({
        'row-critical': (params: any) => getRowStatus(params.data) === 'critical',
        'row-warning': (params: any) => getRowStatus(params.data) === 'warning',
        'row-normal': (params: any) => getRowStatus(params.data) === 'normal',
    }), [getRowStatus]);

    // Custom cell class rule that calculates selection on the fly
    const getCellClassRequest = useCallback((params: any) => {
        if (!selectionStart || !selectionEnd) return false;


        const api = params.api;
        if (!api) return false;

        const rowIndex = params.node.rowIndex;
        if (rowIndex === null || rowIndex === undefined) return false;

        // Determine bounds
        const minRow = Math.min(selectionStart.rowIndex, selectionEnd.rowIndex);
        const maxRow = Math.max(selectionStart.rowIndex, selectionEnd.rowIndex);

        if (rowIndex < minRow || rowIndex > maxRow) return false;

        // Determine Col bounds
        const displayedColumns = api.getAllDisplayedColumns();
        const startColIndex = displayedColumns.findIndex((c: any) => c.getColId() === selectionStart.colId);
        const endColIndex = displayedColumns.findIndex((c: any) => c.getColId() === selectionEnd.colId);

        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);

        const colId = params.column.getColId();
        const colIdx = displayedColumns.findIndex((c: any) => c.getColId() === colId);

        return colIdx >= minCol && colIdx <= maxCol;
    }, [selectionStart, selectionEnd]);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        sortable: true,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        cellClassRules: {
            'cell-selected': getCellClassRequest
        }
    }), [getCellClassRequest]);

    // Close menu on global click
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // --- Modal State ---
    const [modalData, setModalData] = useState<{
        isOpen: boolean;
        itemId: string;
        initialDate: Date;
        minDate: Date;
        itemName: string;
    } | null>(null);

    const handleModalSave = (date: Date) => {
        if (modalData) {
            updateItemEndTime(modalData.itemId, date);
            setModalData(null);
        }
    };

    const onCellContextMenu = useCallback((params: any) => {
        // Prevent default browser menu
        params.event.preventDefault();

        // Store coordinates and row info
        setContextMenu({
            x: params.event.clientX,
            y: params.event.clientY,
            rowIndex: params.node.rowIndex,
            rowId: params.data.id
        });
    }, []);

    const handleInsertRow = (offset: number) => {
        if (!contextMenu) return;

        // Default logic from handleAddItem
        const newItem = {
            id: uuidv4(),
            sequenceOrder: 0, // Recalculated by store
            skuCode: '',
            quantity: 0,
            calculatedPace: 0,
            productionTimeMinutes: 0,
            stoppages: {},
            startTime: new Date(), // Recalculated by store
            endTime: new Date()
        };

        // Insert at designated index (current row index + offset)
        // offset 0 = insert above/at curr pos
        // offset 1 = insert below
        const targetIndex = contextMenu.rowIndex + offset;
        insertScheduleItem(targetIndex, newItem);
        setContextMenu(null);
    };

    const handleDeleteRow = () => {
        if (!contextMenu) return;
        deleteScheduleItem(contextMenu.rowId);
        setContextMenu(null);
    };

    // Force validation/recalculation on mount to ensure new columns populate
    React.useEffect(() => {
        recalculateSchedule();
    }, [recalculateSchedule]);

    // Use Articles as the master data

    const onCellDoubleClicked = useCallback((params: any) => {
        if (params.colDef.colId === 'endTime' && params.data) {
            const item = params.data as ProductionScheduleItem;
            setModalData({
                isOpen: true,
                itemId: item.id,
                initialDate: item.endTime ? new Date(item.endTime) : new Date(),
                minDate: item.startTime ? new Date(item.startTime) : new Date(),
                itemName: `${item.skuCode} - ${articles.find(a => a.codigoProgramacion === item.skuCode)?.descripcion || ''}`
            });
        }
    }, [articles]);

    // State for editing column headers
    const [editingHeader, setEditingHeader] = useState<{ field: string; defaultLabel: string } | null>(null);
    const [editingValue, setEditingValue] = useState('');

    // Handler for grid ready
    const onGridReady = useCallback((event: GridReadyEvent) => {
        // Restore column state
        try {
            const savedState = localStorage.getItem(COLUMN_STATE_KEY);
            if (savedState) {
                let columnState = JSON.parse(savedState);
                if (Array.isArray(columnState)) {
                    // Filter out columns that don't exist anymore to prevent errors
                    const currentCols = event.api.getColumns()?.map(c => c.getColId());
                    if (currentCols) {
                        columnState = columnState.filter((c: any) => currentCols.includes(c.colId));
                    }
                    event.api.applyColumnState({ state: columnState, applyOrder: true });
                }
            } else {
                // If no saved state, auto-size fit content
                event.api.autoSizeAllColumns();
            }
        } catch (e) {
            console.warn('Failed to restore column state:', e);
            event.api.autoSizeAllColumns();
        }

        // Attach double click listener
        const gridDiv = document.querySelector('.ag-theme-quartz');
        if (gridDiv) {
            gridDiv.addEventListener('dblclick', (e: Event) => {
                const target = e.target as HTMLElement;
                const headerCell = target.closest('.ag-header-cell');
                if (headerCell) {
                    const colId = headerCell.getAttribute('col-id');
                    const headerText = headerCell.querySelector('.ag-header-cell-text')?.textContent || '';
                    if (colId && colId !== '' && colId !== 'undefined') {
                        setEditingHeader({ field: colId, defaultLabel: headerText });
                        setEditingValue(columnLabels[colId] || headerText);
                    }
                }
            });
        }
    }, [columnLabels]);

    // Save edited header
    const handleSaveHeader = () => {
        if (editingHeader && editingValue.trim()) {
            setColumnLabel(editingHeader.field, editingValue.trim());
        }
        setEditingHeader(null);
        setEditingValue('');
    };

    // Guardar distribución de columnas en localStorage (Auto-save)
    const onColumnStateChanged = useCallback((params: any) => {
        const columnState = params.api.getColumnState();
        localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify(columnState));
    }, []);

    // Guardar distribución manualmente
    const handleSaveColumnLayout = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const columnState = api.getColumnState();
        localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify(columnState));
    }, []);

    // Auto-ajustar anchos de columna al contenido
    const handleAutoSizeColumns = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        api.autoSizeAllColumns();
    }, []);

    // Restaurar distribución de columnas por defecto
    const handleResetColumnLayout = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        localStorage.removeItem(COLUMN_STATE_KEY);
        api.resetColumnState();
        // Auto-size after reset
        setTimeout(() => api.autoSizeAllColumns(), 100);
    }, []);

    // Calculate program end date from last schedule item
    const programEndDate = useMemo(() => {
        if (schedule.length === 0) return null;
        const lastItem = schedule[schedule.length - 1];
        return lastItem?.endTime ? new Date(lastItem.endTime) : null;
    }, [schedule]);

    // Common renderer for totals with tooltip
    const totalTooltipRenderer = (params: any) => {
        if (params.node.rowPinned === 'bottom') {
            const colId = params.column.getColId();
            const breakdown = params.data._breakdowns?.[colId];

            // Determine alignment based on column type
            const isNumeric = params.colDef.type === 'numericColumn' || params.colDef.type === 'rightAligned';
            const justifyContent = isNumeric ? 'justify-end' : 'justify-start';

            return (
                <div
                    title={breakdown}
                    className={`w-full h-full flex items-center ${justifyContent} cursor-help decoration-dotted underline decoration-gray-400`}
                >
                    {params.valueFormatted || params.value}
                </div>
            );
        }
        return params.valueFormatted || params.value;
    };

    const pinnedBottomRowData = useMemo(() => {
        // Helper function to calculate breakdown by SKU
        const getBreakdown = (field: keyof ProductionScheduleItem | 'segments', type?: string) => {
            const breakdown: Record<string, number> = {};
            schedule.forEach(item => {
                let minutes = 0;
                if (field === 'segments' && type) {
                    minutes = (item.segments || [])
                        .filter(seg => seg.type === type)
                        .reduce((sum, seg) => sum + seg.durationMinutes, 0);
                } else if (field !== 'segments') {
                    minutes = (item[field] as number) || 0;
                }

                if (minutes > 0 && item.skuCode) {
                    breakdown[item.skuCode] = (breakdown[item.skuCode] || 0) + minutes;
                }
            });

            return Object.entries(breakdown)
                .sort(([, a], [, b]) => b - a) // Sort by descending minutes
                .map(([sku, mins]) => `${sku}: ${Math.round(mins)} min`)
                .join('\n');
        };

        const totals: any = {
            skuCode: 'TOTALES',
            quantity: schedule.reduce((sum, item) => sum + (item.quantity || 0), 0),
            productionTimeMinutes: schedule.reduce((sum, item) => sum + (item.productionTimeMinutes || 0), 0),
            changeoverMinutes: schedule.reduce((sum, item) => sum + (item.changeoverMinutes || 0), 0),
            qualityChangeMinutes: schedule.reduce((sum, item) => sum + (item.qualityChangeMinutes || 0), 0),
            stopChangeMinutes: schedule.reduce((sum, item) => sum + (item.stopChangeMinutes || 0), 0),
            // Sum ring changes from both manual (item.ringChangeMinutes) and automatic (segments)
            ringChangeMinutes: schedule.reduce((sum, item) => {
                const manualRingChange = item.ringChangeMinutes || 0;
                const autoRingChange = (item.segments || [])
                    .filter(seg => seg.type === 'ring_change')
                    .reduce((segSum, seg) => segSum + seg.durationMinutes, 0);
                return sum + manualRingChange + autoRingChange;
            }, 0),
            // Sum channel changes from both manual and automatic
            channelChangeMinutes: schedule.reduce((sum, item) => {
                const manualChannelChange = item.channelChangeMinutes || 0;
                const autoChannelChange = (item.segments || [])
                    .filter(seg => seg.type === 'channel_change')
                    .reduce((segSum, seg) => segSum + seg.durationMinutes, 0);
                return sum + manualChannelChange + autoChannelChange;
            }, 0),
            adjustmentMinutes: schedule.reduce((sum, item) => sum + (item.adjustmentMinutes || 0), 0),
            // Total de Mantenimiento (maintenance_hp segments)
            maintenanceMinutes: schedule.reduce((sum, item) => {
                return sum + (item.segments || [])
                    .filter(seg => seg.type === 'maintenance_hp')
                    .reduce((segSum, seg) => segSum + seg.durationMinutes, 0);
            }, 0),
            stoppages: {},
            _breakdowns: {
                changeoverMinutes: getBreakdown('changeoverMinutes'),
                qualityChangeMinutes: getBreakdown('qualityChangeMinutes'),
                stopChangeMinutes: getBreakdown('stopChangeMinutes'),
                ringChangeMinutes: (() => {
                    const breakdown: Record<string, number> = {};
                    schedule.forEach(item => {
                        const manual = item.ringChangeMinutes || 0;
                        const auto = (item.segments || []).filter(s => s.type === 'ring_change').reduce((s, x) => s + x.durationMinutes, 0);
                        const total = manual + auto;
                        if (total > 0 && item.skuCode) breakdown[item.skuCode] = (breakdown[item.skuCode] || 0) + total;
                    });
                    return Object.entries(breakdown).sort(([, a], [, b]) => b - a).map(([s, m]) => `${s}: ${Math.round(m)} min`).join('\n');
                })(),
                channelChangeMinutes: (() => {
                    const breakdown: Record<string, number> = {};
                    schedule.forEach(item => {
                        const manual = item.channelChangeMinutes || 0;
                        const auto = (item.segments || []).filter(s => s.type === 'channel_change').reduce((s, x) => s + x.durationMinutes, 0);
                        const total = manual + auto;
                        if (total > 0 && item.skuCode) breakdown[item.skuCode] = (breakdown[item.skuCode] || 0) + total;
                    });
                    return Object.entries(breakdown).sort(([, a], [, b]) => b - a).map(([s, m]) => `${s}: ${Math.round(m)} min`).join('\n');
                })(),
                adjustmentMinutes: getBreakdown('adjustmentMinutes'),
                // Breakdown de Mantenimiento por SKU
                maintenanceMinutes: (() => {
                    const breakdown: Record<string, number> = {};
                    schedule.forEach(item => {
                        const mins = (item.segments || []).filter(s => s.type === 'maintenance_hp').reduce((s, x) => s + x.durationMinutes, 0);
                        if (mins > 0 && item.skuCode) breakdown[item.skuCode] = (breakdown[item.skuCode] || 0) + mins;
                    });
                    return Object.entries(breakdown).sort(([, a], [, b]) => b - a).map(([s, m]) => `${s}: ${Math.round(m)} min`).join('\n');
                })(),
                // Breakdown de Otros (forced_stop) por SKU
                otherMinutes: (() => {
                    const breakdown: Record<string, number> = {};
                    schedule.forEach(item => {
                        const mins = (item.segments || []).filter(s => s.type === 'forced_stop').reduce((s, x) => s + x.durationMinutes, 0);
                        if (mins > 0 && item.skuCode) breakdown[item.skuCode] = (breakdown[item.skuCode] || 0) + mins;
                    });
                    return Object.entries(breakdown).sort(([, a], [, b]) => b - a).map(([s, m]) => `${s}: ${Math.round(m)} min`).join('\n');
                })()
            }
        };

        // Add 'otherMinutes' property to totals object for the column to read
        totals.otherMinutes = schedule.reduce((sum, item) => {
            return sum + (item.segments || [])
                .filter(seg => seg.type === 'forced_stop')
                .reduce((segSum, seg) => segSum + seg.durationMinutes, 0);
        }, 0);

        // Sum dynamic stoppages
        stoppageConfigs.forEach(conf => {
            totals.stoppages[conf.id] = schedule.reduce((sum, item) => sum + (item.stoppages?.[conf.id] || 0), 0);

            // Custom breakdown for dynamic stoppages
            const breakdown: Record<string, number> = {};
            schedule.forEach(item => {
                const val = item.stoppages?.[conf.id] || 0;
                if (val > 0 && item.skuCode) breakdown[item.skuCode] = (breakdown[item.skuCode] || 0) + val;
            });
            totals._breakdowns[conf.id] = Object.entries(breakdown).sort(([, a], [, b]) => b - a).map(([s, m]) => `${s}: ${Math.round(m)} min`).join('\n');
        });

        return [totals];
    }, [schedule, stoppageConfigs]);

    // --- Column Definitions ---
    const columnDefs = useMemo<ColDef<ProductionScheduleItem>[]>(() => {
        // Helper to get header from columnLabels or default
        const getHeader = (id: string, defaultName: string) => columnLabels[id] || defaultName;

        // 1. Static Columns
        const cols: ColDef<ProductionScheduleItem>[] = [
            { rowDrag: true, width: 50, pinned: 'left' },
            {
                colId: 'sequenceOrder',
                field: 'sequenceOrder',
                headerName: getHeader('sequenceOrder', 'Seq'),
                width: 60,
                pinned: 'left',
                sortable: true,
                valueFormatter: (params) => params.value != null ? String(params.value + 1) : ''
            },
            {
                colId: 'skuCode',
                field: 'skuCode',
                headerName: getHeader('skuCode', 'Cód. Producto'),
                editable: true,
                pinned: 'left',
                width: 140,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                cellClass: (params) => {
                    const exists = articles.some(a => a.codigoProgramacion === params.value);
                    return (exists ? 'font-bold' : 'bg-red-50 text-red-600') + ' cell-mono';
                }
            },
            {
                colId: 'descripcion',
                headerName: getHeader('descripcion', 'Descripción'),
                width: 300,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                valueGetter: (params) => {
                    const sku = articles.find(a => a.codigoProgramacion === params.data?.skuCode);
                    return sku ? sku.descripcion : '---';
                }
            },
            {
                colId: 'calidadPalanquilla',
                headerName: getHeader('calidadPalanquilla', 'Calidad \nPalanquilla'),
                width: 120,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                valueGetter: (params) => {
                    const sku = articles.find(a => a.codigoProgramacion === params.data?.skuCode);
                    return sku?.calidadPalanquilla || '---';
                }
            },
            {
                colId: 'quantity',
                field: 'quantity',
                headerName: getHeader('quantity', 'Cantidad (Ton)'),
                editable: true,
                width: 110,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                type: 'numericColumn',
                cellClass: 'cell-mono',
                valueParser: (params) => {
                    if (!params.newValue) return 0;
                    return parseFloat(String(params.newValue).replace(/,/g, ''));
                }
            },
        ];

        // --- Fin (endTime) ---
        cols.push({
            colId: 'endTime',
            headerName: 'Fin',
            width: 160,
            editable: true,
            valueGetter: (params) => params.data?.endTime,
            valueSetter: (params) => {
                if (!params.newValue) return false;
                const newDate = new Date(params.newValue);
                if (isNaN(newDate.getTime())) {
                    alert('Formato de fecha inválido. Use AAAA-MM-DD HH:mm');
                    return false;
                }
                updateItemEndTime(params.data.id, newDate);
                return true;
            },
            cellRenderer: (params: any) => {
                if (!params.value) return '';
                let dateStr = '';
                try {
                    dateStr = format(new Date(params.value), 'EEE dd/MM HH:mm', { locale: es });
                } catch (e) { return ''; }

                return (
                    <div className="flex items-center justify-between w-full h-full group">
                        <span>{dateStr}</span>
                        <button
                            className="p-1 hover:bg-blue-100 rounded text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Ver en Secuencia Diaria"
                            onClick={(e) => {
                                e.stopPropagation();
                                setVisualTargetDate(new Date(params.value));
                                setActiveTab('visual');
                            }}
                        >
                            <Eye size={16} />
                        </button>
                    </div>
                );
            },
            cellStyle: { fontWeight: 'bold', color: '#1e3a8a', display: 'flex', alignItems: 'center' }
        });

        // --- Ritmo (T/H) ---
        cols.push({
            colId: 'ritmo',
            headerName: getHeader('ritmo', 'Ritmo (T/H)'),
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            cellClass: 'cell-mono',
            valueGetter: (params) => params.data?.calculatedPace?.toFixed(0) || 0
        });

        // --- H-Trab ---
        cols.push({
            colId: 'hTrab',
            headerName: getHeader('hTrab', 'H-Trab'),
            width: 90,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            cellClass: 'cell-mono',
            valueGetter: (params) => ((params.data?.productionTimeMinutes || 0) / 60).toFixed(1)
        });

        // --- Cambio Medida (changeoverMinutes) ---
        cols.push({
            colId: 'changeoverMinutes',
            headerName: getHeader('changeoverMinutes', 'Cambio Medida'),
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.changeoverMinutes ? `${Math.round(params.data.changeoverMinutes)} min` : '-',
            cellStyle: (params) => params.data?.changeoverMinutes ? { color: '#e11d48', fontWeight: 'bold' } : undefined,
            cellRenderer: totalTooltipRenderer
        });

        // --- Mantenimiento ---
        cols.push({
            colId: 'maintenanceMinutes',
            headerName: getHeader('maintenanceMinutes', 'Mantenimiento'),
            width: 120,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => {
                const data = params.data as any;
                if (data && data.maintenanceMinutes !== undefined) {
                    const val = data.maintenanceMinutes;
                    return val > 0 ? `${Math.round(val)} min` : '-';
                }
                const segments = (data?.segments as any[]) || [];
                const maintenanceMinutes = segments
                    .filter((s: any) => s.type === 'maintenance_hp')
                    .reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                return maintenanceMinutes > 0 ? `${Math.round(maintenanceMinutes)} min` : '-';
            },
            cellStyle: (params) => {
                let maintenanceMinutes = 0;
                const data = params.data as any;
                if (data && data.maintenanceMinutes !== undefined) {
                    maintenanceMinutes = data.maintenanceMinutes;
                } else {
                    const segments = (data?.segments as any[]) || [];
                    maintenanceMinutes = segments
                        .filter((s: any) => s.type === 'maintenance_hp')
                        .reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                }
                return maintenanceMinutes > 0 ? { color: '#b91c1c', fontWeight: 'bold' } : undefined;
            },
            cellRenderer: totalTooltipRenderer
        });

        // --- Otros (forced_stop) ---
        cols.push({
            colId: 'otherMinutes',
            headerName: getHeader('otherMinutes', 'Otros'),
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => {
                const data = params.data as any;
                if (data && data.otherMinutes !== undefined) {
                    const val = data.otherMinutes;
                    return val > 0 ? `${Math.round(val)} min` : '-';
                }
                const segments = (data?.segments as any[]) || [];
                const otherMinutes = segments
                    .filter((s: any) => s.type === 'forced_stop')
                    .reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                return otherMinutes > 0 ? `${Math.round(otherMinutes)} min` : '-';
            },
            cellStyle: (params) => {
                let otherMinutes = 0;
                const data = params.data as any;
                if (data && data.otherMinutes !== undefined) {
                    otherMinutes = data.otherMinutes;
                } else {
                    const segments = (data?.segments as any[]) || [];
                    otherMinutes = segments
                        .filter((s: any) => s.type === 'forced_stop')
                        .reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                }
                return otherMinutes > 0 ? { backgroundColor: '#f3f4f6', color: '#1f2937', fontWeight: 'bold' } : undefined;
            },
            cellRenderer: totalTooltipRenderer
        });

        // --- Cambio Anillo ---
        cols.push({
            colId: 'ringChangeMinutes',
            headerName: getHeader('ringChangeMinutes', 'Cambio Anillo'),
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => {
                const manual = params.data?.ringChangeMinutes || 0;
                const auto = (params.data?.segments || []).filter((s: any) => s.type === 'ring_change').reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                const total = manual + auto;
                return total > 0 ? `${Math.round(total)} min` : '-';
            },
            cellStyle: (params) => {
                const manual = params.data?.ringChangeMinutes || 0;
                const auto = (params.data?.segments || []).filter((s: any) => s.type === 'ring_change').reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                return (manual + auto) > 0 ? { color: '#7c3aed', fontWeight: 'bold' } : undefined;
            },
            cellRenderer: totalTooltipRenderer
        });

        // --- Cambio Canal ---
        cols.push({
            colId: 'channelChangeMinutes',
            headerName: getHeader('channelChangeMinutes', 'Cambio Canal'),
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => {
                const manual = params.data?.channelChangeMinutes || 0;
                const auto = (params.data?.segments || []).filter((s: any) => s.type === 'channel_change').reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                const total = manual + auto;
                return total > 0 ? `${Math.round(total)} min` : '-';
            },
            cellStyle: (params) => {
                const manual = params.data?.channelChangeMinutes || 0;
                const auto = (params.data?.segments || []).filter((s: any) => s.type === 'channel_change').reduce((sum: number, s: any) => sum + s.durationMinutes, 0);
                return (manual + auto) > 0 ? { color: '#ea580c', fontWeight: 'bold' } : undefined;
            },
            cellRenderer: totalTooltipRenderer
        });

        // --- Acierto y Calibración ---
        cols.push({
            colId: 'adjustmentMinutes',
            headerName: getHeader('adjustmentMinutes', 'Acierto y Calibración'),
            width: 130,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.adjustmentMinutes ? `${Math.round(params.data.adjustmentMinutes)} min` : '-',
            cellStyle: (params) => params.data?.adjustmentMinutes ? { color: '#ca8a04', fontWeight: 'bold' } : undefined,
            cellRenderer: totalTooltipRenderer
        });

        // --- Cambio Calidad ---
        cols.push({
            colId: 'qualityChangeMinutes',
            headerName: getHeader('qualityChangeMinutes', 'Cambio Calidad'),
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.qualityChangeMinutes ? `${Math.round(params.data.qualityChangeMinutes)} min` : '-',
            cellStyle: (params) => params.data?.qualityChangeMinutes ? { color: '#9d174d', fontWeight: 'bold' } : undefined,
            cellRenderer: totalTooltipRenderer
        });

        // --- Cambio Tope ---
        cols.push({
            colId: 'stopChangeMinutes',
            headerName: getHeader('stopChangeMinutes', 'Cambio Tope'),
            width: 100,
            wrapHeaderText: true,
            autoHeaderHeight: true,
            valueGetter: (params) => params.data?.stopChangeMinutes ? `${Math.round(params.data.stopChangeMinutes)} min` : '-',
            cellStyle: (params) => params.data?.stopChangeMinutes ? { color: '#0d9488', fontWeight: 'bold' } : undefined,
            cellRenderer: totalTooltipRenderer
        });

        // --- Dynamic Stoppage Columns ---
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
                cellRenderer: totalTooltipRenderer,
                valueSetter: (params: ValueSetterParams<ProductionScheduleItem>) => {
                    const newVal = Number(String(params.newValue).replace(/,/g, ''));
                    if (isNaN(newVal)) return false;

                    const stoppages = params.data.stoppages || {};
                    params.data.stoppages = {
                        ...stoppages,
                        [conf.id]: newVal
                    };
                    return true;
                }
            });
        });

        // --- Inicio (startTime) ---
        cols.push({
            colId: 'startTime',
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

        // --- Delete Action ---
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
    }, [articles, stoppageConfigs, deleteScheduleItem, columnLabels, updateItemEndTime]);


    // --- Event Handlers ---






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
        const startingSequence = schedule.length;

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
            className="h-full flex flex-col gap-2 relative" // Added relative for context menu
            onPaste={handlePaste}
            tabIndex={0} // Make div focusable to catch paste events
            style={{ outline: 'none' }}
        >
            {/* Custom Context Menu */}
            {modalData && (
                <TargetDateModal
                    isOpen={modalData.isOpen}
                    onClose={() => setModalData(null)}
                    onSave={handleModalSave}
                    initialDate={modalData.initialDate}
                    minDate={modalData.minDate}
                    itemName={modalData.itemName}
                />
            )}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-48"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                        onClick={() => handleInsertRow(0)}
                    >
                        <Plus size={14} className="text-gray-500" />
                        Insertar Fila Arriba
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                        onClick={() => handleInsertRow(1)}
                    >
                        <Plus size={14} className="text-gray-500 transform rotate-180" />
                        Insertar Fila Abajo
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600"
                        onClick={handleDeleteRow}
                    >
                        <Trash2 size={14} />
                        Eliminar Fila
                    </button>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col gap-4 p-4 bg-white border-b border-gray-200">

                {/* Top Row: Title & Date Controls (Informative) */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Programación de Producción</h2>

                        <div className="h-6 w-px bg-gray-300 mx-2"></div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <CalendarClock size={16} className="text-gray-500" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inicio</span>
                                <input
                                    type="datetime-local"
                                    className="bg-transparent text-sm font-bold text-gray-900 outline-none w-36 font-mono"
                                    value={programStartDate ? format(new Date(programStartDate), "yyyy-MM-dd'T'HH:mm") : ''}
                                    onChange={handleDateChange}
                                />
                            </div>

                            {programEndDate && (
                                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
                                    <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Fin Est.</span>
                                    <span className="text-sm font-bold text-blue-900 font-mono">
                                        {format(programEndDate, 'EEE dd/MM HH:mm', { locale: es })}
                                    </span>
                                </div>
                            )}

                            {schedule.length > 0 && (
                                <>
                                    <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 shadow-sm">
                                        <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Prod</span>
                                        <span className="text-sm font-bold text-green-800 font-mono">
                                            {(schedule.reduce((acc, item) => acc + (item.productionTimeMinutes || 0), 0) / 60).toFixed(1)} h
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm">
                                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Paradas</span>
                                        <span className="text-sm font-bold text-red-800 font-mono">
                                            {((
                                                schedule.reduce((acc, item) => {
                                                    const manualStoppages = (item.changeoverMinutes || 0) +
                                                        (item.qualityChangeMinutes || 0) +
                                                        (item.stopChangeMinutes || 0) +
                                                        (item.ringChangeMinutes || 0) +
                                                        (item.channelChangeMinutes || 0) +
                                                        (item.adjustmentMinutes || 0);

                                                    const autoRingChange = (item.segments || [])
                                                        .filter(seg => seg.type === 'ring_change')
                                                        .reduce((segSum, seg) => segSum + seg.durationMinutes, 0);
                                                    const autoChannelChange = (item.segments || [])
                                                        .filter(seg => seg.type === 'channel_change')
                                                        .reduce((segSum, seg) => segSum + seg.durationMinutes, 0);
                                                    const autoMaintenance = (item.segments || [])
                                                        .filter(seg => seg.type === 'maintenance_hp')
                                                        .reduce((segSum, seg) => segSum + seg.durationMinutes, 0);

                                                    return acc + manualStoppages + autoRingChange + autoChannelChange + autoMaintenance;
                                                }, 0) +
                                                schedule.reduce((acc, item) => acc + Object.values(item.stoppages || {}).reduce((s, v) => s + v, 0), 0)
                                            ) / 60).toFixed(1)} h
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Auto-save Status */}
                    <span className="text-xs text-green-600 flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full border border-green-100 font-medium ml-auto mr-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Guardado automático
                    </span>
                </div>

                {/* Bottom Row: Actions (Compact) */}
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-1 mr-auto">
                        <button
                            onClick={handleAutoSizeColumns}
                            className="p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-lg transition-colors"
                            title="Autoajustar anchos al contenido"
                        >
                            <Columns size={18} />
                        </button>
                        <button
                            onClick={handleSaveColumnLayout}
                            className="p-2 text-gray-500 hover:bg-gray-100 hover:text-green-600 rounded-lg transition-colors"
                            title="Guardar distribución de columnas"
                        >
                            <Save size={18} />
                        </button>
                        <button
                            onClick={handleResetColumnLayout}
                            className="p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-lg transition-colors"
                            title="Restaurar distribución por defecto"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-200 mx-2"></div>

                    <button
                        onClick={undo}
                        disabled={!canUndo()}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                            ${canUndo()
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'
                            }
                        `}
                        title="Deshacer último cambio"
                    >
                        <Undo2 size={16} />
                        Deshacer {scheduleHistory.length > 0 && `(${scheduleHistory.length})`}
                    </button>

                    <button
                        onClick={handleClearAll}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                        title="Borrar toda la tabla"
                    >
                        <Trash2 size={16} />
                        Limpiar
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
                    rowSelection={{ mode: 'multiRow' }}
                    suppressRowClickSelection={true}
                    suppressCopyRowsToClipboard={true}
                    onRowDragEnd={onRowDragEnd}
                    onCellValueChanged={onCellValueChanged}
                    onCellContextMenu={onCellContextMenu}
                    onCellMouseDown={onCellMouseDown}
                    onCellMouseOver={onCellMouseOver}
                    preventDefaultOnContextMenu={true}
                    animateRows={true}
                    getRowId={(params) => params.data.id}
                    pinnedBottomRowData={pinnedBottomRowData}
                    onGridReady={onGridReady}
                    onCellDoubleClicked={onCellDoubleClicked}
                    rowClassRules={rowClassRules}
                    rowHeight={32}
                    headerHeight={48}
                    maintainColumnOrder={true}
                    // Auto-save triggers
                    onColumnResized={onColumnStateChanged}
                    onColumnMoved={onColumnStateChanged}
                    onColumnVisible={onColumnStateChanged}
                    onColumnPinned={onColumnStateChanged}
                />
            </div>

            {/* Modal for editing column header */}
            {editingHeader && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Editar Nombre de Columna</h3>
                        <p className="text-sm text-gray-500 mb-2">
                            Columna: <span className="font-mono bg-gray-100 px-1 rounded">{editingHeader.field}</span>
                        </p>
                        <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveHeader();
                                if (e.key === 'Escape') setEditingHeader(null);
                            }}
                            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setEditingHeader(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveHeader}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
