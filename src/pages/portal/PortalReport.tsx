import { Icon } from '../../components/Icon';
import { Steps } from '../../components/progress';
import { Card } from '../../components/ui';
import { workflowSteps } from '../../lib/progress';
import { useStore } from '../../state/store';
import { EsgReportView } from '../EsgReport';

/** Portail client : rapport ESG, visible une fois publié par le cabinet. */
export function PortalReport() {
  const { state, inventory, workspace } = useStore();
  if (!state.portal.reportPublished) {
    return (
      <div className="stack">
        <Card>
          <div className="locked-panel">
            <Icon name="lock" size={34} />
            <h2>Votre rapport ESG est en préparation</h2>
            <p>{workspace.firmName} rédige votre rapport à partir de vos documents. Il apparaîtra ici dès sa publication.</p>
          </div>
          <Steps steps={workflowSteps(state, inventory)} />
        </Card>
      </div>
    );
  }
  return <EsgReportView mode="client" />;
}
