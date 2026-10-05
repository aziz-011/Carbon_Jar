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
import { Documents } from './pages/Documents';
import { Fleet } from './pages/Fleet';
import { Tracking } from './pages/Tracking';
import { EsgData } from './pages/EsgData';
import { EsgReport } from './pages/EsgReport';
import { Clients } from './pages/Clients';
import { PortalHome } from './pages/portal/PortalHome';
import { Lca } from './pages/Lca';
import { PortalLca } from './pages/portal/PortalLca';
import { PortalCompliance } from './pages/portal/PortalCompliance';
import { PortalDocuments } from './pages/portal/PortalDocuments';
import { PortalResults } from './pages/portal/PortalResults';
import { PortalFleet } from './pages/portal/PortalFleet';
import { PortalQuestionnaire } from './pages/portal/PortalQuestionnaire';
import { PortalReport } from './pages/portal/PortalReport';
import { PortalSavings } from './pages/portal/PortalSavings';

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
            <Route path="/documents" element={<Documents />} />
            <Route path="/flotte" element={<Fleet />} />
            <Route path="/suivi" element={<Tracking />} />
            <Route path="/acv" element={<Lca />} />
            <Route path="/esg" element={<EsgData />} />
            <Route path="/rapport-esg" element={<EsgReport />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/portail" element={<PortalHome />} />
            <Route path="/portail/documents" element={<PortalDocuments />} />
            <Route path="/portail/resultats" element={<PortalResults />} />
            <Route path="/portail/economies" element={<PortalSavings />} />
            <Route path="/portail/flotte" element={<PortalFleet />} />
            <Route path="/portail/questionnaire" element={<PortalQuestionnaire />} />
            <Route path="/portail/conformite" element={<PortalCompliance />} />
            <Route path="/portail/acv" element={<PortalLca />} />
            <Route path="/portail/rapport" element={<PortalReport />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </StoreProvider>
  );
}
