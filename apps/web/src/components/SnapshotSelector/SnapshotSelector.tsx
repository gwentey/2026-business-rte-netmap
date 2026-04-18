import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/app-store.js';
import { formatDateTime } from '../../lib/format.js';

export function SnapshotSelector(): JSX.Element {
  const snapshots = useAppStore((s) => s.snapshots);
  const activeId = useAppStore((s) => s.activeSnapshotId);
  const load = useAppStore((s) => s.loadSnapshots);
  const setActive = useAppStore((s) => s.setActiveSnapshot);

  useEffect(() => {
    void load();
  }, [load]);

  if (snapshots.length === 0) {
    return (
      <Link to="/upload" className="text-sm text-rte underline">
        Aucun snapshot — charger
      </Link>
    );
  }

  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => void setActive(e.target.value)}
      className="rounded border border-gray-300 px-2 py-1 text-sm"
    >
      {snapshots.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label} — {s.envName} — {formatDateTime(s.uploadedAt)}
        </option>
      ))}
    </select>
  );
}
