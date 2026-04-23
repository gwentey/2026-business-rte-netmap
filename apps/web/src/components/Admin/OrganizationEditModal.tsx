import { useState } from 'react';
import type { OrganizationEntryRow, OrganizationUpsertInput } from '@carto-ecp/shared';
import { ORGANIZATION_TYPE_HINTS } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

type Props = {
  /** Si null → mode création. Si fourni → mode édition. */
  entry: OrganizationEntryRow | null;
  /**
   * Valeur pré-remplie pour displayName en mode création (ex. clic sur le
   * badge ⚠ dans ComponentsAdminTable avec l'organisation du composant).
   */
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

    // Parse lat/lng : vide → null, sinon number avec validation de plage.
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
      setError('Latitude et longitude doivent être toutes deux renseignées ou toutes deux vides.');
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
    if (!window.confirm(`Supprimer « ${entry.displayName} » de la mémoire interne ?`)) return;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
        <h3 className="mb-2 text-lg font-semibold">
          {isEdit ? 'Modifier l\'organisation' : 'Nouvelle organisation'}
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          Le pays et l'adresse sont utilisés par la cascade d'enrichissement pour
          placer les composants de cette organisation sur la carte.
        </p>

        {error ? (
          <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Nom affiché <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Ex. Swissgrid AG"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Pays (ISO-2)</span>
            <input
              type="text"
              list="country-iso2"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              placeholder="FR / CH / DE"
              maxLength={2}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <datalist id="country-iso2">
              <option value="AL" />
              <option value="AT" />
              <option value="BE" />
              <option value="BG" />
              <option value="CH" />
              <option value="CZ" />
              <option value="DE" />
              <option value="DK" />
              <option value="EE" />
              <option value="ES" />
              <option value="FI" />
              <option value="FR" />
              <option value="GB" />
              <option value="GR" />
              <option value="HR" />
              <option value="IE" />
              <option value="IS" />
              <option value="IT" />
              <option value="LT" />
              <option value="LU" />
              <option value="LV" />
              <option value="ME" />
              <option value="MK" />
              <option value="NL" />
              <option value="NO" />
              <option value="PL" />
              <option value="PT" />
              <option value="RO" />
              <option value="RS" />
              <option value="SE" />
              <option value="SI" />
              <option value="SK" />
              <option value="TR" />
            </datalist>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Type</span>
            <input
              type="text"
              list="type-hints"
              value={form.typeHint}
              onChange={(e) => setForm({ ...form, typeHint: e.target.value })}
              placeholder="TSO / RCC / NEMO / …"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <datalist id="type-hints">
              {ORGANIZATION_TYPE_HINTS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Adresse</span>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Adresse libre (optionnelle)"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Latitude</span>
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder="-90 … 90"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Longitude</span>
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder="-180 … 180"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <p className="-mt-2 text-[10px] text-gray-500">
            Coords facultatives — utilisées pour placer les composants de l'organisation sur
            la carte. Laissées vides, la cascade fallback sur le centre du pays.
          </p>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          {isEdit && entry ? (
            <div className="rounded bg-gray-50 p-2 text-[10px] text-gray-500">
              <div>ID : <span className="font-mono">{entry.id}</span></div>
              <div>Nom normalisé : <span className="font-mono">{entry.organizationName}</span></div>
              <div>
                seedVersion : {entry.seedVersion} · userEdited :{' '}
                {entry.userEdited ? 'oui' : 'non'}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-between">
          <div>
            {isEdit ? (
              <button
                type="button"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={saving}
                className="rounded border border-red-600 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Supprimer
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={saving}
              className="rounded bg-rte px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
