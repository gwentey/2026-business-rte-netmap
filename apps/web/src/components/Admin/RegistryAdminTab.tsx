import { ProcessColorsEditor } from './ProcessColorsEditor.js';
import { RteEndpointsTable } from './RteEndpointsTable.js';
import styles from './RegistryAdminTab.module.scss';

type Props = {
  onEditComponent: (eic: string) => void;
};

export function RegistryAdminTab({ onEditComponent }: Props): JSX.Element {
  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Couleurs des process</h3>
        <p className={styles.sectionDescription}>
          Surcharge persistée en base. Une couleur modifiée est appliquée à la prochaine
          actualisation du graphe.
        </p>
        <ProcessColorsEditor />
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Endpoints RTE</h3>
        <p className={styles.sectionDescription}>
          Lecture seule. Modifier un endpoint ouvre la surcharge dans l'onglet Composants
          pré-rempli avec l'EIC.
        </p>
        <RteEndpointsTable onEdit={onEditComponent} />
      </section>
    </div>
  );
}
