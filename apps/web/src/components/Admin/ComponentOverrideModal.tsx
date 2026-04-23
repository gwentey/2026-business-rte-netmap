import { useState } from 'react';
import type { AdminComponentRow, OverrideUpsertInput } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

const CloseIcon = (): JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

type Props = {
  row: AdminComponentRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type FormState = {
  displayName: string;
  type: string;
  organization: string;
  country: string;
  lat: string;
  lng: string;
  tagsCsv: string;
  notes: string;
};

export function ComponentOverrideModal({
  row,
  onClose,
  onSaved,
}: Props): JSX.Element {
  const override = row.override;

  const [form, setForm] = useState<FormState>({
    displayName: override?.displayName ?? '',
    type: override?.type ?? '',
    organization: override?.organization ?? '',
    country: override?.country ?? '',
    lat:
      override?.lat !== null && override?.lat !== undefined ? String(override.lat) : '',
    lng:
      override?.lng !== null && override?.lng !== undefined ? String(override.lng) : '',
    tagsCsv: override?.tagsCsv ?? '',
    notes: override?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    const patch: OverrideUpsertInput = {};
    const currentOverride = override;
    const trimmedOrNull = (v: string): string | null =>
      v.trim() === '' ? null : v.trim();

    const newDisplayName = trimmedOrNull(form.displayName);
    if (newDisplayName !== (currentOverride?.displayName ?? null))
      patch.displayName = newDisplayName;

    const newType = trimmedOrNull(form.type) as OverrideUpsertInput['type'];
    if (newType !== (currentOverride?.type ?? null)) patch.type = newType;

    const newOrg = trimmedOrNull(form.organization);
    if (newOrg !== (currentOverride?.organization ?? null)) patch.organization = newOrg;

    const newCountry = trimmedOrNull(form.country);
    if (newCountry !== (currentOverride?.country ?? null)) patch.country = newCountry;

    const newLat = form.lat.trim() === '' ? null : Number(form.lat);
    if (newLat !== (currentOverride?.lat ?? null)) patch.lat = newLat;

    const newLng = form.lng.trim() === '' ? null : Number(form.lng);
    if (newLng !== (currentOverride?.lng ?? null)) patch.lng = newLng;

    const newTags = trimmedOrNull(form.tagsCsv);
    if (newTags !== (currentOverride?.tagsCsv ?? null)) patch.tagsCsv = newTags;

    const newNotes = trimmedOrNull(form.notes);
    if (newNotes !== (currentOverride?.notes ?? null)) patch.notes = newNotes;

    setSaving(true);
    setError(null);
    try {
      await api.upsertOverride(row.eic, patch);
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm(`Retirer la surcharge pour ${row.eic} ?`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteOverride(row.eic);
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal--lg">
        <div className="modal__head">
          <div style={{ minWidth: 0 }}>
            <div className="modal__kicker">Édition de composant · override</div>
            <h3 className="mono" style={{ wordBreak: 'break-all' }}>
              Surcharge pour {row.eic}
            </h3>
            <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>
              {row.current.displayName}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Fermer"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="modal__body">
          {error !== null && (
            <div className="banner banner--err" role="alert" style={{ marginBottom: 12 }}>
              <div className="banner__ico">!</div>
              <div>{error}</div>
            </div>
          )}

          <div className="banner banner--info" style={{ marginBottom: 16 }}>
            <div className="banner__ico">i</div>
            <div style={{ fontSize: 12 }}>
              Les placeholders grisés montrent la valeur actuelle (cascade). Remplir un
              champ crée/met à jour l'override niveau&nbsp;1. Vider un champ = fallback
              cascade.
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="ovr-name">Nom affiché (override)</label>
              <input
                id="ovr-name"
                type="text"
                className="input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder={row.current.displayName}
              />
            </div>

            <div className="field">
              <label htmlFor="ovr-type">Type</label>
              <select
                id="ovr-type"
                className="select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="">— (cascade : {row.current.type})</option>
                <option value="ENDPOINT">ENDPOINT</option>
                <option value="COMPONENT_DIRECTORY">COMPONENT_DIRECTORY</option>
                <option value="BROKER">BROKER</option>
                <option value="BA">BA</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="ovr-country">Pays (ISO-2)</label>
              <input
                id="ovr-country"
                type="text"
                className="input mono"
                value={form.country}
                onChange={(e) =>
                  setForm({ ...form, country: e.target.value.toUpperCase() })
                }
                placeholder={row.current.country ?? '—'}
                maxLength={2}
              />
            </div>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="ovr-org">Organisation</label>
              <input
                id="ovr-org"
                type="text"
                className="input"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                placeholder={row.current.organization ?? '—'}
              />
            </div>

            <div className="field">
              <label htmlFor="ovr-lat">Latitude</label>
              <input
                id="ovr-lat"
                type="number"
                step="any"
                className="input mono"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder={
                  row.current.isDefaultPosition ? 'défaut' : String(row.current.lat)
                }
              />
            </div>

            <div className="field">
              <label htmlFor="ovr-lng">Longitude</label>
              <input
                id="ovr-lng"
                type="number"
                step="any"
                className="input mono"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder={
                  row.current.isDefaultPosition ? 'défaut' : String(row.current.lng)
                }
              />
            </div>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="ovr-tags">Tags (CSV)</label>
              <input
                id="ovr-tags"
                type="text"
                className="input"
                value={form.tagsCsv}
                onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
              />
            </div>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="ovr-notes">Notes</label>
              <textarea
                id="ovr-notes"
                rows={3}
                className="input"
                style={{ height: 'auto', padding: 8, lineHeight: 1.5 }}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="modal__foot">
          {override !== null ? (
            <button
              type="button"
              className="btn btn--danger-outline"
              onClick={() => {
                void handleDelete();
              }}
              disabled={saving}
            >
              Retirer surcharge
            </button>
          ) : (
            <span />
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn--outline"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : "Enregistrer l'override"}
          </button>
        </div>
      </div>
    </div>
  );
}
