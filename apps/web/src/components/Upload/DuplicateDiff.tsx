/**
 * DuplicateDiff — bandeau "Aperçu de la différence" pour un upload doublon.
 * Markup `.dup-diff` du design carto-rte. Le diff réel (nodes/links/SHA256
 * existant vs entrant) nécessite un endpoint backend dédié — pour l'instant
 * on affiche les valeurs disponibles dans le batch + des placeholders.
 */
interface Props {
  existingLabel: string;
  existingDate: string;
  existingHashTail?: string;
  incomingLabel: string;
  incomingDate: string;
  incomingHashTail?: string;
}

export function DuplicateDiff({
  existingLabel,
  existingDate,
  existingHashTail = '—',
  incomingLabel,
  incomingDate,
  incomingHashTail = '—',
}: Props): JSX.Element {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 8,
        }}
      >
        Aperçu de la différence
      </div>
      <div className="dup-diff">
        <div className="dup-diff__col dup-diff__col--old">
          <div className="title" style={{ color: 'var(--err-strong)' }}>
            Existant · {existingDate}
          </div>
          <div className="kv">
            <span>Label</span>
            <span className="mono">{existingLabel}</span>
          </div>
          <div className="kv">
            <span>SHA256</span>
            <span className="mono">…{existingHashTail}</span>
          </div>
        </div>
        <div className="dup-diff__arrow" aria-hidden>
          →
        </div>
        <div className="dup-diff__col dup-diff__col--new">
          <div className="title" style={{ color: 'var(--ok-strong)' }}>
            Entrant · {incomingDate}
          </div>
          <div className="kv">
            <span>Label</span>
            <span className="mono">{incomingLabel}</span>
          </div>
          <div className="kv">
            <span>SHA256</span>
            <span className="mono">…{incomingHashTail}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
