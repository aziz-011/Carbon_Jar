import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StoreProvider } from './state/store';
import { Dashboard } from './pages/Dashboard';
import { DataEntry } from './pages/DataEntry';
import { Classification } from './pages/Classification';
import { InventoryPage } from './pages/Inventory';
import { Boundary } from './pages/Boundary';
import { Targets } from './pages/Targets';
import { Advice } from './pages/Advice';
import { Tools } from './pages/Tools';
import { Report } from './pages/Report';
import { Factors } from './pages/Factors';
import { Guide } from './pages/Guide';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/donnees" element={<DataEntry />} />
            <Route path="/classification" element={<Classification />} />
            <Route path="/inventaire" element={<InventoryPage />} />
            <Route path="/perimetre" element={<Boundary />} />
            <Route path="/objectifs" element={<Targets />} />
            <Route path="/conseils" element={<Advice />} />
            <Route path="/outils" element={<Tools />} />
            <Route path="/rapport" element={<Report />} />
            <Route path="/facteurs" element={<Factors />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/guide/:id" element={<Guide />} />
            <Route path="/parametres" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </StoreProvider>
  );
}
