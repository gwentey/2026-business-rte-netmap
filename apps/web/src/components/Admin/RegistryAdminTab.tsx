import { ProcessColorsEditor } from './ProcessColorsEditor.js';
import { RteEndpointsTable } from './RteEndpointsTable.js';

type Props = {
  onEditComponent: (eic: string) => void;
};

export function RegistryAdminTab({ onEditComponent }: Props): JSX.Element {
  return (
    <>
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <div className="banner__ico">i</div>
        <div>
          <b style={{ color: 'var(--cyan-1)' }}>Registry interne RTE.</b> Toute
          surcharge est persistée en base et appliquée à la prochaine actualisation du
          graphe.
        </div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--ink-0)',
            marginBottom: 6,
          }}
        >
          Couleurs des process
        </h3>
        <p style={{ color: 'var(--ink-3)', fontSize: 12, margin: '0 0 12px 0' }}>
          Surcharge persistée en base. Une couleur modifiée est appliquée à la prochaine
          actualisation du graphe.
        </p>
        <ProcessColorsEditor />
      </section>

      <section>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--ink-0)',
            marginBottom: 6,
          }}
        >
          Endpoints RTE
        </h3>
        <p style={{ color: 'var(--ink-3)', fontSize: 12, margin: '0 0 12px 0' }}>
          Lecture seule. Modifier un endpoint ouvre la surcharge dans l'onglet Composants
          pré-rempli avec l'EIC.
        </p>
        <RteEndpointsTable onEdit={onEditComponent} />
      </section>
    </>
  );
}
