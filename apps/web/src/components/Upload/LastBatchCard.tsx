import { useMemo } from 'react';
import type { ImportDetail } from '@carto-ecp/shared';

const CheckIcon = (): JSX.Element => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 8l4 4 6-8" />
  </svg>
);

const CrossIcon = (): JSX.Element => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

interface Props {
  imports: ImportDetail[];
  /** Limite d'éléments affichés (les plus récents). */
  limit?: number;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatBatchHeader(items: ImportDetail[]): string {
  if (items.length === 0) return 'Aucun lot récent';
  const mostRecent = items[0]!;
  return `Dernier lot déposé · ${formatDateLabel(mostRecent.uploadedAt)}`;
}

/**
 * LastBatchCard — carte récap du dernier batch d'imports (design carto-rte v2).
 * Markup `.card > .panel-header + .file-row` (3 cols : status / name+meta / badge).
 */
export function LastBatchCard({ imports, limit = 4 }: Props): JSX.Element | null {
  const recent = useMemo(() => {
    const sorted = [...imports].sort((a, b) =>
      b.uploadedAt.localeCompare(a.uploadedAt),
    );
    return sorted.slice(0, limit);
  }, [imports, limit]);

  if (recent.length === 0) return null;

  const accepted = recent.filter((i) => i.warnings.length === 0).length;
  const withWarnings = recent.length - accepted;

  return (
    <div className="card">
      <div className="panel-header">
        <h2>{formatBatchHeader(recent)}</h2>
        <span className="sub">
          {accepted} accepté{accepted > 1 ? 's' : ''}
          {withWarnings > 0 && (
            <>
              {' '}· {withWarnings} avec warning{withWarnings > 1 ? 's' : ''}
            </>
          )}
        </span>
      </div>
      <div>
        {recent.map((item) => {
          const ok = item.warnings.length === 0;
          const sizeKb = (item.stats.componentsCount * 1).toLocaleString('fr-FR');
          const orgHint =
            item.sourceComponentEic !== null && item.sourceComponentEic !== undefined
              ? item.sourceComponentEic
              : 'manifeste introuvable';
          return (
            <div
              className="file-row"
              key={item.id}
              style={{ gridTemplateColumns: '24px 1fr auto' }}
            >
              <div className="file-row__status">
                {ok ? (
                  <span style={{ color: 'var(--ok)' }}>
                    <CheckIcon />
                  </span>
                ) : (
                  <span style={{ color: 'var(--warn)' }}>
                    <CrossIcon />
                  </span>
                )}
              </div>
              <div className="file-row__label">
                <div className="name mono">{item.fileName}</div>
                <div className="meta">
                  {orgHint} · {sizeKb} composants
                </div>
              </div>
              <div>
                <span className={'badge ' + (ok ? 'badge--ok' : 'badge--warn')}>
                  {ok ? 'Accepté' : `${item.warnings.length} warn.`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
