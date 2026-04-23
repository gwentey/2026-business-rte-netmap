import styles from './AdminTabs.module.scss';

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
    <nav className={styles.tabs} role="tablist">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const classes = isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab;
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
          </button>
        );
      })}
    </nav>
  );
}
