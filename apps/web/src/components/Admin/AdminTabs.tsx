export type AdminTabId =
  | 'imports'
  | 'components'
  | 'organizations'
  | 'entsoe'
  | 'registry'
  | 'danger';

type TabDef = { id: AdminTabId; label: string; enabled: boolean; tooltip: string };

const TABS: TabDef[] = [
  { id: 'imports', label: 'Imports', enabled: true, tooltip: '' },
  { id: 'components', label: 'Composants', enabled: true, tooltip: '' },
  {
    id: 'organizations',
    label: 'Organisations',
    enabled: true,
    tooltip: 'Mémoire interne : mapping organisation → pays/adresse/type',
  },
  { id: 'entsoe', label: 'Annuaire ENTSO-E', enabled: true, tooltip: '' },
  { id: 'registry', label: 'Registry RTE', enabled: true, tooltip: '' },
  { id: 'danger', label: '⚠ Zone danger', enabled: true, tooltip: '' },
];

type Props = {
  active: AdminTabId;
  onChange: (id: AdminTabId) => void;
};

export function AdminTabs({ active, onChange }: Props): JSX.Element {
  return (
    <nav className="flex gap-1 border-b border-gray-200" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-selected={active === tab.id}
          onClick={() => { if (tab.enabled) onChange(tab.id); }}
          disabled={!tab.enabled}
          title={tab.tooltip}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            active === tab.id
              ? 'border-rte text-rte'
              : tab.enabled
                ? 'border-transparent text-gray-700 hover:text-gray-900'
                : 'border-transparent text-gray-300 cursor-not-allowed'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
