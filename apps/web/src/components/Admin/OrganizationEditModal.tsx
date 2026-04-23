import { useState } from 'react';
import type { OrganizationEntryRow, OrganizationUpsertInput } from '@carto-ecp/shared';
import { ORGANIZATION_TYPE_HINTS } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import styles from './OrganizationEditModal.module.scss';

type Props = {
  entry: OrganizationEntryRow | null;
  prefillDisplayName?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type FormState = {
  displayName: string;
  country: string;
  address: string;
  typeHint: string;
  lat: string;
  lng: string;
  notes: string;
};

export function OrganizationEditModal({
  entry,
  prefillDisplayName,
  onClose,
  onSaved,
}: Props): JSX.Element {
  const isEdit = entry !== null;

  const [form, setForm] = useState<FormState>({
    displayName: entry?.displayName ?? prefillDisplayName ?? '',
    country: entry?.country ?? '',
    address: entry?.address ?? '',
    typeHint: entry?.typeHint ?? '',
    lat: entry?.lat != null ? String(entry.lat) : '',
    lng: entry?.lng != null ? String(entry.lng) : '',
    notes: entry?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimOrNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

  const handleSave = async (): Promise<void> => {
    if (form.displayName.trim().length === 0) {
      setError('Le nom affiché est obligatoire.');
      return;
    }
    const country = trimOrNull(form.country);
    if (country !== null && !/^[A-Z]{2}$/.test(country)) {
      setError('Le pays doit être un code ISO-2 (2 lettres majuscules).');
      return;
    }

    let lat: number | null = null;
    if (form.lat.trim() !== '') {
      const parsed = Number(form.lat);
      if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
        setError('La latitude doit être un nombre entre -90 et 90.');
        return;
      }
      lat = parsed;
    }
    let lng: number | null = null;
    if (form.lng.trim() !== '') {
      const parsed = Number(form.lng);
      if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
        setError('La longitude doit être un nombre entre -180 et 180.');
        return;
      }
      lng = parsed;
    }
    if ((lat === null) !== (lng === null)) {
      setError(
        'Latitude et longitude doivent être toutes deux renseignées ou toutes deux vides.',
      );
      return;
    }

    const patch: OrganizationUpsertInput = {
      displayName: form.displayName.trim(),
      country,
      address: trimOrNull(form.address),
      typeHint: trimOrNull(form.typeHint),
      lat,
      lng,
      notes: trimOrNull(form.notes),
    };

    setSaving(true);
    setError(null);
    try {
      if (isEdit && entry) {
        await api.updateOrganization(entry.id, patch);
      } else {
        await api.createOrganization(patch);
      }
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!entry) return;
    if (!window.confirm(`Supprimer « ${entry.displayName} » de la mémoire interne ?`))
      return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteOrganization(entry.id);
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
        <h3 className={styles.title}>
          {isEdit ? "Modifier l'organisation" : 'Nouvelle organisation'}
        </h3>
        <p className={styles.intro}>
          Le pays et l'adresse sont utilisés par la cascade d'enrichissement pour placer les
          composants de cette organisation sur la carte.
        </p>

        {error ? (
          <p className={styles.alertError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Nom affiché <span className={styles.required}>*</span>
            </span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Ex. Swissgrid AG"
              className={styles.input}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Pays (ISO-2)</span>
            <input
              type="text"
              list="country-iso2"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              placeholder="FR / CH / DE"
              maxLength={2}
              className={`${styles.input} ${styles.countryInput}`}
            />
            <datalist id="country-iso2">
              {['AL','AT','BE','BG','CH','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','IE','IS','IT','LT','LU','LV','ME','MK','NL','NO','PL','PT','RO','RS','SE','SI','SK','TR'].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Type</span>
            <input
              type="text"
              list="type-hints"
              value={form.typeHint}
              onChange={(e) => setForm({ ...form, typeHint: e.target.value })}
              placeholder="TSO / RCC / NEMO / …"
              className={styles.input}
            />
            <datalist id="type-hints">
              {ORGANIZATION_TYPE_HINTS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Adresse</span>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Adresse libre (optionnelle)"
              className={styles.input}
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
                placeholder="-90 … 90"
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
                placeholder="-180 … 180"
                className={styles.input}
              />
            </label>
          </div>
          <p className={styles.coordHint}>
            Coords facultatives — utilisées pour placer les composants de l'organisation sur
            la carte. Laissées vides, la cascade fallback sur le centre du pays.
          </p>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={styles.input}
            />
          </label>

          {isEdit && entry ? (
            <div className={styles.metaBox}>
              <div>
                ID : <span className={styles.mono}>{entry.id}</span>
              </div>
              <div>
                Nom normalisé :{' '}
                <span className={styles.mono}>{entry.organizationName}</span>
              </div>
              <div>
                seedVersion : {entry.seedVersion} · userEdited :{' '}
                {entry.userEdited ? 'oui' : 'non'}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.actions}>
          <div>
            {isEdit ? (
              <button
                type="button"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={saving}
                className={styles.deleteButton}
              >
                Supprimer
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
