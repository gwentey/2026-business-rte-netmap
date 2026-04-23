import { useState } from 'react';
import type { AdminComponentRow, OverrideUpsertInput } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import styles from './ComponentOverrideModal.module.scss';

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

export function ComponentOverrideModal({ row, onClose, onSaved }: Props): JSX.Element {
  const override = row.override;

  const [form, setForm] = useState<FormState>({
    displayName: override?.displayName ?? '',
    type: override?.type ?? '',
    organization: override?.organization ?? '',
    country: override?.country ?? '',
    lat:
      override?.lat !== null && override?.lat !== undefined
        ? String(override.lat)
        : '',
    lng:
      override?.lng !== null && override?.lng !== undefined
        ? String(override.lng)
        : '',
    tagsCsv: override?.tagsCsv ?? '',
    notes: override?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    const patch: OverrideUpsertInput = {};
    const currentOverride = override;
    const trimmedOrNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

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
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Surcharge pour {row.eic}</h3>
        <p className={styles.intro}>
          Les placeholders grisés montrent la valeur actuelle (cascade). Remplir un champ
          crée/met à jour l'override niveau 1. Vider un champ = fallback cascade.
        </p>

        {error ? (
          <p className={styles.alertError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Nom affiché</span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder={row.current.displayName}
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={styles.input}
            >
              <option value="">— (cascade : {row.current.type})</option>
              <option value="ENDPOINT">ENDPOINT</option>
              <option value="COMPONENT_DIRECTORY">COMPONENT_DIRECTORY</option>
              <option value="BROKER">BROKER</option>
              <option value="BA">BA</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Organisation</span>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              placeholder={row.current.organization ?? '—'}
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Pays (ISO-2)</span>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              placeholder={row.current.country ?? '—'}
              maxLength={2}
              className={`${styles.input} ${styles.countryInput}`}
            />
          </label>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Latitude</span>
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder={
                  row.current.isDefaultPosition ? 'défaut' : String(row.current.lat)
                }
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Longitude</span>
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder={
                  row.current.isDefaultPosition ? 'défaut' : String(row.current.lng)
                }
                className={styles.input}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Tags (CSV)</span>
            <input
              type="text"
              value={form.tagsCsv}
              onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={styles.input}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <div>
            {override !== null ? (
              <button
                type="button"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={saving}
                className={styles.deleteButton}
              >
                Retirer surcharge
              </button>
            ) : null}
          </div>
          <div className={styles.actionsRight}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={styles.cancelButton}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={saving}
              className={styles.saveButton}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
