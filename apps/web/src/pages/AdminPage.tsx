import { useState } from 'react';
import { AdminTabs, type AdminTabId } from '../components/Admin/AdminTabs.js';
import { ImportsAdminTable } from '../components/Admin/ImportsAdminTable.js';
import { ComponentsAdminTable } from '../components/Admin/ComponentsAdminTable.js';

export function AdminPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<AdminTabId>('imports');

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Administration</h1>
      <AdminTabs active={activeTab} onChange={setActiveTab} />
      <div className="mt-4">
        {activeTab === 'imports' ? <ImportsAdminTable /> : null}
        {activeTab === 'components' ? <ComponentsAdminTable /> : null}
      </div>
    </div>
  );
}
