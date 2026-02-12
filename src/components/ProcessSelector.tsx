
import React from 'react';
import { useStore } from '../store/useStore';
import type { ProcessId } from '../types';

const processes: { id: ProcessId; label: string }[] = [
    { id: 'laminador1', label: 'Laminador 1' },
    { id: 'laminador2', label: 'Laminador 2' },
    { id: 'laminador3', label: 'Laminador 3' },
];

export const ProcessSelector: React.FC = () => {
    const activeProcessId = useStore((state) => state.activeProcessId);
    const setActiveProcess = useStore((state) => state.setActiveProcess);

    return (
        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-600 mr-2">Proceso:</span>
            <div className="flex space-x-1">
                {processes.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => setActiveProcess(p.id)}
                        className={`
                            px-4 py-2 text-sm font-medium rounded-md transition-colors
                            ${activeProcessId === p.id
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                        `}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
