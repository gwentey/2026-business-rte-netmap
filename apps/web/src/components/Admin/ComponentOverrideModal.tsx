import { useState } from 'react';
import type { AdminComponentRow, OverrideUpsertInput } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

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
    lat: override?.lat !== null && override?.lat !== undefined ? String(override.lat) : '',
    lng: override?.lng !== null && override?.lng !== undefined ? String(override.lng) : '',
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
    if (newDisplayName !== (currentOverride?.displayName ?? null)) patch.displayName = newDisplayName;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
        <h3 className="mb-2 text-lg font-semibold">Surcharge pour {row.eic}</h3>
        <p className="mb-4 text-xs text-gray-500">
          Les placeholders grisés montrent la valeur actuelle (cascade). Remplir
          un champ crée/met à jour l'override niveau 1. Vider un champ = fallback cascade.
        </p>

        {error ? (
          <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">{error}</p>
        ) : null}

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nom affiché</span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder={row.current.displayName}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">— (cascade : {row.current.type})</option>
              <option value="ENDPOINT">ENDPOINT</option>
              <option value="COMPONENT_DIRECTORY">COMPONENT_DIRECTORY</option>
              <option value="BROKER">BROKER</option>
              <option value="BA">BA</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Organisation</span>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              placeholder={row.current.organization ?? '—'}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Pays (ISO-2)</span>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              placeholder={row.current.country ?? '—'}
              maxLength={2}
              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
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
                placeholder={row.current.isDefaultPosition ? 'défaut' : String(row.current.lat)}
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
                placeholder={row.current.isDefaultPosition ? 'défaut' : String(row.current.lng)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tags (CSV)</span>
            <input
              type="text"
              value={form.tagsCsv}
              onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-between">
          <div>
            {override !== null ? (
              <button
                type="button"
                onClick={() => { void handleDelete(); }}
                disabled={saving}
                className="rounded border border-red-600 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Retirer surcharge
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
              onClick={() => { void handleSave(); }}
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
