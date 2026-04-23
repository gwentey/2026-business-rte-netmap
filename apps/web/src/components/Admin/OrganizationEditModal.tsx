import { useState } from 'react';
import type { OrganizationEntryRow, OrganizationUpsertInput } from '@carto-ecp/shared';
import { ORGANIZATION_TYPE_HINTS } from '@carto-ecp/shared';
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

const COUNTRIES = [
  'AL', 'AT', 'BE', 'BG', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GB', 'GR', 'HR', 'IE', 'IS', 'IT', 'LT', 'LU', 'LV', 'ME', 'MK', 'NL',
  'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'TR',
];

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
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal--lg">
        <div className="modal__head">
          <div>
            <div className="modal__kicker">
              {isEdit ? 'Édition' : 'Création'} · Organisation
            </div>
            <h3>{isEdit ? form.displayName || 'Sans nom' : 'Nouvelle organisation'}</h3>
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
          <div className="banner banner--info" style={{ marginBottom: 16 }}>
            <div className="banner__ico">i</div>
            <div style={{ fontSize: 12 }}>
              Le pays et l'adresse sont utilisés par la cascade d'enrichissement pour
              placer les composants de cette organisation sur la carte.
            </div>
          </div>

          {error !== null && (
            <div className="banner banner--err" role="alert" style={{ marginBottom: 12 }}>
              <div className="banner__ico">!</div>
              <div>{error}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="org-name">
                Nom affiché <span style={{ color: 'var(--err)' }}>*</span>
              </label>
              <input
                id="org-name"
                type="text"
                className="input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Ex. Swissgrid AG"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="org-country">Pays (ISO-2)</label>
              <input
                id="org-country"
                type="text"
                list="country-iso2"
                className="input mono"
                value={form.country}
                onChange={(e) =>
                  setForm({ ...form, country: e.target.value.toUpperCase() })
                }
                placeholder="FR / CH / DE"
                maxLength={2}
              />
              <datalist id="country-iso2">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="field">
              <label htmlFor="org-type">Type</label>
              <input
                id="org-type"
                type="text"
                list="type-hints"
                className="input"
                value={form.typeHint}
                onChange={(e) => setForm({ ...form, typeHint: e.target.value })}
                placeholder="TSO / RCC / NEMO / …"
              />
              <datalist id="type-hints">
                {ORGANIZATION_TYPE_HINTS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="org-address">Adresse</label>
              <textarea
                id="org-address"
                rows={2}
                className="input"
                style={{ height: 'auto', padding: 8, lineHeight: 1.5 }}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Adresse libre (optionnelle)"
              />
            </div>

            <div className="field">
              <label htmlFor="org-lat">Latitude</label>
              <input
                id="org-lat"
                type="number"
                step="any"
                className="input mono"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder="-90 … 90"
              />
            </div>

            <div className="field">
              <label htmlFor="org-lng">Longitude</label>
              <input
                id="org-lng"
                type="number"
                step="any"
                className="input mono"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder="-180 … 180"
              />
            </div>

            <p
              style={{
                gridColumn: '1/-1',
                color: 'var(--ink-3)',
                fontSize: 11,
                margin: 0,
              }}
            >
              Coords facultatives — utilisées pour placer les composants de l'organisation.
              Vides → fallback sur le centre du pays.
            </p>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="org-notes">Notes</label>
              <textarea
                id="org-notes"
                rows={2}
                className="input"
                style={{ height: 'auto', padding: 8, lineHeight: 1.5 }}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {isEdit && entry && (
              <div
                style={{
                  gridColumn: '1/-1',
                  padding: 10,
                  background: 'var(--dark-1)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div>
                  ID : <span className="mono">{entry.id}</span>
                </div>
                <div>
                  Nom normalisé : <span className="mono">{entry.organizationName}</span>
                </div>
                <div>
                  seedVersion : {entry.seedVersion} · userEdited :{' '}
                  {entry.userEdited ? 'oui' : 'non'}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal__foot">
          {isEdit ? (
            <button
              type="button"
              className="btn btn--danger-outline"
              onClick={() => {
                void handleDelete();
              }}
              disabled={saving}
            >
              Supprimer
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
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
