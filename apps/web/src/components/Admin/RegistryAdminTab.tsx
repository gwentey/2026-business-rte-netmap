import { ProcessColorsEditor } from './ProcessColorsEditor.js';
import { RteEndpointsTable } from './RteEndpointsTable.js';

type Props = {
  onEditComponent: (eic: string) => void;
};

export function RegistryAdminTab({ onEditComponent }: Props): JSX.Element {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-1 text-lg font-medium">Couleurs des process</h3>
        <p className="mb-3 text-sm text-gray-600">
          Surcharge persistée en base. Une couleur modifiée est appliquée à la
          prochaine actualisation du graphe.
        </p>
        <ProcessColorsEditor />
      </section>
      <section>
        <h3 className="mb-1 text-lg font-medium">Endpoints RTE</h3>
        <p className="mb-3 text-sm text-gray-600">
          Lecture seule. Modifier un endpoint ouvre la surcharge dans l'onglet
          Composants pré-rempli avec l'EIC.
        </p>
        <RteEndpointsTable onEdit={onEditComponent} />
      </section>
    </div>
  );
}
