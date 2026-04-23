import { useState } from 'react';
import { SubHeader } from '../components/SubHeader/SubHeader.js';
import { AdminTabs, type AdminTabId } from '../components/Admin/AdminTabs.js';
import { ImportsAdminTable } from '../components/Admin/ImportsAdminTable.js';
import { ComponentsAdminTable } from '../components/Admin/ComponentsAdminTable.js';
import { EntsoeAdminTab } from '../components/Admin/EntsoeAdminTab.js';
import { DangerZoneTab } from '../components/Admin/DangerZoneTab.js';
import { RegistryAdminTab } from '../components/Admin/RegistryAdminTab.js';
import { OrganizationsAdminTab } from '../components/Admin/OrganizationsAdminTab.js';

const TAB_LABELS: Record<AdminTabId, string> = {
  imports: 'Imports',
  components: 'Composants',
  organizations: 'Organisations',
  entsoe: 'Annuaire ENTSO-E',
  registry: 'Registry RTE',
  danger: 'Zone danger',
};

export function AdminPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<AdminTabId>('imports');
  const [pendingComponentEic, setPendingComponentEic] = useState<string | null>(null);

  const handleEditComponentFromRegistry = (eic: string): void => {
    setPendingComponentEic(eic);
    setActiveTab('components');
  };

  return (
    <>
      <SubHeader breadcrumb={['Console', TAB_LABELS[activeTab]]} />
      <div
        className="scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: 'var(--dark-0)',
          position: 'relative',
        }}
      >
        <div className="admin-page">
          <h1 className="page-title">Administration</h1>
          <p className="page-subtitle">
            Gestion interne — composants, imports, organisations, annuaires, zone danger
          </p>

          <AdminTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === 'imports' && <ImportsAdminTable />}
          {activeTab === 'components' && (
            <ComponentsAdminTable
              autoOpenEic={pendingComponentEic}
              onAutoOpenHandled={() => setPendingComponentEic(null)}
            />
          )}
          {activeTab === 'organizations' && <OrganizationsAdminTab />}
          {activeTab === 'entsoe' && <EntsoeAdminTab />}
          {activeTab === 'registry' && (
            <RegistryAdminTab onEditComponent={handleEditComponentFromRegistry} />
          )}
          {activeTab === 'danger' && <DangerZoneTab />}
        </div>
      </div>
    </>
  );
}
