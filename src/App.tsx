
import { useState } from 'react';
import 'ag-grid-community/styles/ag-grid.css'; // Core grid CSS, always needed
import 'ag-grid-community/styles/ag-theme-quartz.css'; // Theme
import { DatabaseLayout } from './components/DatabaseLayout';
import { ProductionScheduler } from './components/ProductionScheduler';
import { VisualSchedule } from './components/VisualSchedule';
import { SettingsPanel } from './components/SettingsPanel';
import { LayoutDashboard, Database, Settings, Factory, Calendar } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'scheduler' | 'database' | 'settings' | 'visual'>('scheduler');

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden print:h-auto print:overflow-visible">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3 shadow-sm z-10 print:hidden">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <Factory size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Laminación Scheduler</h1>
          <p className="text-xs text-gray-500">Sistema de Secuenciación de Producción</p>
        </div>
      </header>

      {/* Navigation */}
      <div className="flex px-6 pt-4 gap-1 print:hidden">
        <button
          onClick={() => setActiveTab('scheduler')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-lg text-sm font-medium transition-all ${activeTab === 'scheduler'
            ? 'bg-white text-blue-600 border-t border-x border-gray-200 shadow-sm'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
          <LayoutDashboard size={18} /> Programación
        </button>
        <button
          onClick={() => setActiveTab('visual')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-lg text-sm font-medium transition-all ${activeTab === 'visual'
            ? 'bg-white text-blue-600 border-t border-x border-gray-200 shadow-sm'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
          <Calendar size={18} /> Visualización
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-lg text-sm font-medium transition-all ${activeTab === 'database'
            ? 'bg-white text-blue-600 border-t border-x border-gray-200 shadow-sm'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
          <Database size={18} /> Base de Datos
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-lg text-sm font-medium transition-all ${activeTab === 'settings'
            ? 'bg-white text-blue-600 border-t border-x border-gray-200 shadow-sm'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
          <Settings size={18} /> Configuración
        </button>
      </div>

      {/* Main Content */}
      {/* Main Content */}
      <main className="flex-1 bg-white mx-6 mb-6 border border-gray-200 rounded-b-lg rounded-tr-lg shadow-sm overflow-hidden p-4 relative print:m-0 print:border-none print:shadow-none print:p-0 print:overflow-visible">
        {activeTab === 'scheduler' && <ProductionScheduler />}
        {activeTab === 'visual' && <VisualSchedule />}
        {activeTab === 'database' && <DatabaseLayout />}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}

export default App;
