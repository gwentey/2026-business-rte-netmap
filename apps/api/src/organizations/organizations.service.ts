import { Injectable, NotFoundException } from '@nestjs/common';
import type { OrganizationEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizeOrgName } from './normalize-org-name.js';

/** Forme de lookup utilisée par la cascade graph (lecture seulement). */
export type OrganizationLookup = {
  country: string | null;
  address: string | null;
  displayName: string;
  lat: number | null;
  lng: number | null;
};

export type UpsertInput = {
  organizationName?: string;
  displayName?: string;
  country?: string | null;
  address?: string | null;
  typeHint?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
};

export type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ organizationName: string; reason: string }>;
};

export type SeedEntry = {
  organizationName: string;
  displayName: string;
  country?: string | null;
  address?: string | null;
  typeHint?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
};

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<OrganizationEntry[]> {
    return this.prisma.organizationEntry.findMany({
      orderBy: [{ displayName: 'asc' }],
    });
  }

  async getById(id: string): Promise<OrganizationEntry> {
    const row = await this.prisma.organizationEntry.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: `Organization ${id} not found`,
      });
    }
    return row;
  }

  /**
   * Crée une nouvelle OrganizationEntry. Échoue si l'organizationName normalisé
   * existe déjà. Le drapeau userEdited est mis à true puisque c'est une
   * création utilisateur (par opposition à une création issue du seed).
   */
  async create(patch: UpsertInput): Promise<OrganizationEntry> {
    if (!patch.displayName || patch.displayName.trim().length === 0) {
      throw new NotFoundException({
        code: 'DISPLAY_NAME_REQUIRED',
        message: 'displayName est obligatoire',
      });
    }
    const normalized =
      normalizeOrgName(patch.organizationName) ?? normalizeOrgName(patch.displayName);
    if (normalized == null) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NAME_INVALID',
        message: 'organizationName ou displayName requis pour le lookup',
      });
    }
    return this.prisma.organizationEntry.create({
      data: {
        organizationName: normalized,
        displayName: patch.displayName.trim(),
        country: patch.country ?? null,
        address: patch.address ?? null,
        typeHint: patch.typeHint ?? null,
        lat: patch.lat ?? null,
        lng: patch.lng ?? null,
        notes: patch.notes ?? null,
        seedVersion: 0,
        userEdited: true,
      },
    });
  }

  /**
   * Met à jour une entry existante (par id). Marque userEdited=true pour
   * préserver les champs lors d'un re-seed. N'autorise pas la modification
   * de organizationName (clé de lookup stable).
   */
  async update(id: string, patch: UpsertInput): Promise<OrganizationEntry> {
    await this.getById(id); // throws si absent
    return this.prisma.organizationEntry.update({
      where: { id },
      data: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
        ...(patch.country !== undefined ? { country: patch.country } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
        ...(patch.typeHint !== undefined ? { typeHint: patch.typeHint } : {}),
        ...(patch.lat !== undefined ? { lat: patch.lat } : {}),
        ...(patch.lng !== undefined ? { lng: patch.lng } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        userEdited: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.prisma.organizationEntry.delete({ where: { id } });
  }

  /**
   * Résout une organisation par son nom brut (tel que lu dans le XML MADES).
   * Retourne null si l'organisation n'est pas dans la mémoire.
   * Utilisé par GraphService lors du compute-on-read.
   */
  async resolveByOrganization(orgName: string | null): Promise<OrganizationLookup | null> {
    const normalized = normalizeOrgName(orgName);
    if (normalized == null) return null;
    const row = await this.prisma.organizationEntry.findUnique({
      where: { organizationName: normalized },
    });
    if (!row) return null;
    return {
      country: row.country,
      address: row.address,
      displayName: row.displayName,
      lat: row.lat,
      lng: row.lng,
    };
  }

  /**
   * Charge toutes les entrées en mémoire sous forme de Map indexée par
   * organizationName normalisé. À utiliser en batch (ex. GraphService) pour
   * éviter N requêtes.
   */
  async loadAsMap(): Promise<Map<string, OrganizationLookup>> {
    const rows = await this.prisma.organizationEntry.findMany();
    return new Map(
      rows.map((r) => [
        r.organizationName,
        {
          country: r.country,
          address: r.address,
          displayName: r.displayName,
          lat: r.lat,
          lng: r.lng,
        },
      ]),
    );
  }

  /**
   * Import JSON — upsert par organizationName. Le format attendu est celui
   * exporté par `exportJson` : `{ version?, entries: SeedEntry[] }`.
   * Les entrées importées manuellement sont marquées userEdited=true.
   */
  async importJson(buffer: Buffer): Promise<ImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString('utf-8'));
    } catch (err) {
      return {
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [{ organizationName: '<root>', reason: `JSON invalide: ${(err as Error).message}` }],
      };
    }
    const entries = extractEntries(parsed);
    const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

    for (const entry of entries) {
      const normalized = normalizeOrgName(entry.organizationName);
      if (normalized == null) {
        result.skipped++;
        result.errors.push({
          organizationName: String(entry.organizationName ?? '<empty>'),
          reason: 'organizationName vide ou invalide',
        });
        continue;
      }
      if (!entry.displayName || entry.displayName.trim().length === 0) {
        result.skipped++;
        result.errors.push({
          organizationName: normalized,
          reason: 'displayName obligatoire',
        });
        continue;
      }
      const existing = await this.prisma.organizationEntry.findUnique({
        where: { organizationName: normalized },
      });
      if (existing) {
        await this.prisma.organizationEntry.update({
          where: { organizationName: normalized },
          data: {
            displayName: entry.displayName.trim(),
            country: entry.country ?? null,
            address: entry.address ?? null,
            typeHint: entry.typeHint ?? null,
            lat: entry.lat ?? null,
            lng: entry.lng ?? null,
            notes: entry.notes ?? null,
            userEdited: true,
          },
        });
        result.updated++;
      } else {
        await this.prisma.organizationEntry.create({
          data: {
            organizationName: normalized,
            displayName: entry.displayName.trim(),
            country: entry.country ?? null,
            address: entry.address ?? null,
            typeHint: entry.typeHint ?? null,
            lat: entry.lat ?? null,
            lng: entry.lng ?? null,
            notes: entry.notes ?? null,
            seedVersion: 0,
            userEdited: true,
          },
        });
        result.inserted++;
      }
    }
    return result;
  }

  /**
   * Export JSON — retourne un buffer UTF-8 au format attendu par importJson
   * (`{ version: 1, entries: [...] }`).
   */
  async exportJson(): Promise<Buffer> {
    const rows = await this.prisma.organizationEntry.findMany({
      orderBy: [{ displayName: 'asc' }],
    });
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: rows.map((r) => ({
        organizationName: r.organizationName,
        displayName: r.displayName,
        country: r.country,
        address: r.address,
        typeHint: r.typeHint,
        lat: r.lat,
        lng: r.lng,
        notes: r.notes,
      })),
    };
    return Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
  }
}

function extractEntries(parsed: unknown): SeedEntry[] {
  if (parsed == null || typeof parsed !== 'object') return [];
  const p = parsed as Record<string, unknown>;
  const raw = p['entries'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is SeedEntry => typeof e === 'object' && e !== null);
}
