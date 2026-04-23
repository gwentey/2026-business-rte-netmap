export type AdminTabId =
  | 'imports'
  | 'components'
  | 'organizations'
  | 'entsoe'
  | 'registry'
  | 'danger';

type TabDef = {
  id: AdminTabId;
  label: string;
  enabled: boolean;
  tooltip: string;
  danger?: boolean;
};

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
  { id: 'danger', label: '⚠ Zone danger', enabled: true, tooltip: '', danger: true },
];

type Props = {
  active: AdminTabId;
  onChange: (id: AdminTabId) => void;
  counts?: Partial<Record<AdminTabId, number>>;
};

export function AdminTabs({ active, onChange, counts = {} }: Props): JSX.Element {
  return (
    <nav className="admin-tabs" role="tablist">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const count = counts[tab.id];
        const classes = [
          'admin-tabs__trigger',
          isActive ? 'is-active' : '',
          tab.danger ? 'admin-tabs__trigger--danger' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (tab.enabled) onChange(tab.id);
            }}
            disabled={!tab.enabled}
            title={tab.tooltip}
            className={classes}
          >
            {tab.label}
            {count !== undefined && count > 0 && (
              <span className="count">{count.toLocaleString('fr-FR')}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
