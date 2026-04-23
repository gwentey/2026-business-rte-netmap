import { useEffect, useState } from 'react';
import type { ComponentConfigResponse } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

type Props = {
  eic: string;
  onClose: () => void;
};

/**
 * Modal d'affichage de la config runtime ECP complète d'un composant.
 * Charge `/api/admin/components/:eic/config` au montage et affiche les
 * `ecp.*` properties groupées par section métier (Identification, Réseau,
 * Antivirus…). Lecture seule — pas d'édition ici, l'override visuel passe
 * par `ComponentOverrideModal`.
 */
export function ComponentConfigModal({ eic, onClose }: Props): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComponentConfigResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getComponentConfig(eic)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eic]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Configuration ECP de ${eic}`}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white">
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div>
            <h3 className="text-lg font-semibold">Configuration ECP</h3>
            <p className="mt-0.5 font-mono text-xs text-gray-500">{eic}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : null}
          {error ? (
            <p className="rounded bg-red-100 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && data != null ? (
            <ConfigContent data={data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ConfigContent({ data }: { data: ComponentConfigResponse }): JSX.Element {
  if (data.source == null) {
    return (
      <div className="rounded bg-yellow-50 p-3 text-sm text-yellow-800">
        Aucun dump dans la base n'a ce composant comme source ; impossible
        d'afficher ses propriétés. Importez un dump du composant {data.eic}{' '}
        pour voir sa configuration ECP.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span>
            Import source :{' '}
            <strong className="font-mono">{data.source.label}</strong>
            {' · '}
            <span>env {data.source.envName}</span>
            {' · '}
            <span>
              {new Date(data.source.uploadedAt).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
          <span
            className={`inline-block rounded px-2 py-0.5 ${
              data.source.hasConfigurationProperties
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-red-100 text-red-800'
            }`}
            title={
              data.source.hasConfigurationProperties
                ? '.properties externe fourni à l\'ingestion'
                : 'Valeurs issues uniquement du CSV interne au zip'
            }
          >
            {data.source.hasConfigurationProperties ? '✓ Properties' : '✗ Properties'}
          </span>
        </div>
      </div>

      {data.sections.map((section) => (
        <section key={section.slug} className="rounded border border-gray-200">
          <h4 className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium">
            {section.name}{' '}
            <span className="ml-1 text-xs text-gray-500">
              ({section.properties.length})
            </span>
          </h4>
          <dl className="divide-y divide-gray-100 text-xs">
            {section.properties.map((p) => (
              <div
                key={p.key}
                className="grid grid-cols-[minmax(200px,1fr)_2fr] gap-2 px-3 py-1.5"
              >
                <dt className="break-all font-mono text-gray-600">{p.key}</dt>
                <dd className="break-all font-mono">
                  {p.value === '' ? (
                    <span className="italic text-gray-400">(vide)</span>
                  ) : (
                    p.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {data.sections.length === 0 ? (
        <p className="text-sm text-gray-500">
          L'import source n'a persisté aucune propriété `ecp.*` pour ce composant.
        </p>
      ) : null}
    </div>
  );
}
