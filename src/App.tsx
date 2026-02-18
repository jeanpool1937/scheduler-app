import { useEffect } from 'react';
import { DatabaseLayout } from './components/DatabaseLayout';
import { ProductionScheduler } from './components/ProductionScheduler';
import { VisualSchedule } from './components/VisualSchedule';
import { SettingsPanel } from './components/SettingsPanel';
import { MainLayout } from './components/MainLayout';
import { KPIDashboard } from './components/KPIDashboard';

import { useStore } from './store/useStore';
import { useArticleStore } from './store/useArticleStore';
import { useChangeoverStore } from './store/useChangeoverStore';

import { ProductionSequencer } from './components/ProductionSequencer';

function App() {
  const { activeTab, activeProcessId, fetchProcessData } = useStore();
  const { fetchArticles } = useArticleStore();
  const { fetchRules } = useChangeoverStore();

  useEffect(() => {
    // Initial data fetch
    const loadData = async () => {
      await Promise.all([
        fetchProcessData(activeProcessId),
        fetchArticles(activeProcessId),
        fetchRules(activeProcessId)
      ]);
    };
    loadData();
  }, [activeProcessId, fetchProcessData, fetchArticles, fetchRules]);

  return (
    <MainLayout>
      {activeTab === 'scheduler' && (
        <>
          <KPIDashboard />
          <ProductionScheduler />
        </>
      )}
      {activeTab === 'sequencer' && <ProductionSequencer />}
      {activeTab === 'visual' && <VisualSchedule />}
      {activeTab === 'database' && <DatabaseLayout />}
      {activeTab === 'settings' && <SettingsPanel />}
    </MainLayout>
  );
}

export default App;
