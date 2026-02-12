import 'ag-grid-community/styles/ag-grid.css'; // Core grid CSS, always needed
import 'ag-grid-community/styles/ag-theme-quartz.css'; // Theme
import { DatabaseLayout } from './components/DatabaseLayout';
import { ProductionScheduler } from './components/ProductionScheduler';
import { VisualSchedule } from './components/VisualSchedule';
import { SettingsPanel } from './components/SettingsPanel';
import { MainLayout } from './components/MainLayout';
import { KPIDashboard } from './components/KPIDashboard';

import { useStore } from './store/useStore';

function App() {
  const { activeTab } = useStore();

  return (
    <MainLayout>
      {activeTab === 'scheduler' && (
        <>
          <KPIDashboard />
          <ProductionScheduler />
        </>
      )}
      {activeTab === 'visual' && <VisualSchedule />}
      {activeTab === 'database' && <DatabaseLayout />}
      {activeTab === 'settings' && <SettingsPanel />}
    </MainLayout>
  );
}

export default App;
