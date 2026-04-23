import { describe, expect, it } from 'vitest';
import { applyCascade, type CascadeInputs } from './apply-cascade.js';
import type { MergedComponent } from './merge-components.js';

const baseMerged: MergedComponent = {
  eic: 'EIC-X', type: 'ENDPOINT',
  organization: null, personName: null, email: null, phone: null,
  homeCdCode: null, networksCsv: null,
  displayName: null, projectName: null, country: null, lat: null, lng: null,
  isDefaultPosition: true, sourceType: 'LOCAL_CSV',
  creationTs: null, modificationTs: null, urls: [],
};

const emptyInputs: CascadeInputs = { override: null, entsoe: null, registry: null };
const defaultFallback = { lat: 50.8503, lng: 4.3517 };  // Brussels

describe('applyCascade', () => {
  it('yields default placeholder when no source has data', () => {
    const result = applyCascade('EIC-UNKNOWN', null, emptyInputs, defaultFallback);
    expect(result.eic).toBe('EIC-UNKNOWN');
    expect(result.lat).toBe(50.8503);
    expect(result.lng).toBe(4.3517);
    expect(result.isDefaultPosition).toBe(true);
    expect(result.displayName).toBe('EIC-UNKNOWN');
  });

  it('uses merged-import fields when no higher-priority source', () => {
    const merged: MergedComponent = { ...baseMerged, displayName: 'From Import', lat: 48, lng: 16, isDefaultPosition: false };
    const result = applyCascade('EIC-X', merged, emptyInputs, defaultFallback);
    expect(result.displayName).toBe('From Import');
    expect(result.lat).toBe(48);
    expect(result.lng).toBe(16);
    expect(result.isDefaultPosition).toBe(false);
  });

  it('registry overrides merged.displayName local but pas lat', () => {
    const merged: MergedComponent = { ...baseMerged, displayName: 'From Import', lat: 48, lng: 16, isDefaultPosition: false };
    const registry = { displayName: 'From Registry' };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, registry }, defaultFallback);
    expect(result.displayName).toBe('From Registry');
    expect(result.lat).toBe(48);
  });

  it('ENTSO-E prend le pas sur registry pour les composants non-dumpés', () => {
    const merged: MergedComponent = { ...baseMerged, displayName: 'From Import' };
    const registry = { displayName: 'From Registry' };
    const entsoe = { displayName: 'From ENTSO-E' };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, registry, entsoe }, defaultFallback);
    expect(result.displayName).toBe('From ENTSO-E');
  });

  it('admin override beats everything', () => {
    const merged: MergedComponent = { ...baseMerged, displayName: 'From Import' };
    const registry = { displayName: 'From Registry' };
    const entsoe = { displayName: 'From ENTSO-E' };
    const override = { displayName: 'Admin choice' };
    const result = applyCascade('EIC-X', merged, { override, registry, entsoe }, defaultFallback);
    expect(result.displayName).toBe('Admin choice');
  });

  it('type field is surchargeable through cascade', () => {
    const merged: MergedComponent = { ...baseMerged, type: 'ENDPOINT' };
    const override = { type: 'BROKER' };
    const result = applyCascade('EIC-X', merged, { override, registry: null, entsoe: null }, defaultFallback);
    expect(result.type).toBe('BROKER');
  });

  it('registry coords fill a component whose import has no coord', () => {
    const merged: MergedComponent = { ...baseMerged, isDefaultPosition: true };
    const registry = { lat: 48.856, lng: 2.352 };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, registry }, defaultFallback);
    expect(result.lat).toBe(48.856);
    expect(result.lng).toBe(2.352);
    expect(result.isDefaultPosition).toBe(false);  // coords explicites présentes
  });

  it('projectName du dump sert de displayName quand pas d\'override', () => {
    const merged: MergedComponent = { ...baseMerged, projectName: 'INTERNET-EP1' };
    const result = applyCascade('EIC-X', merged, emptyInputs, defaultFallback);
    expect(result.displayName).toBe('INTERNET-EP1');
    expect(result.projectName).toBe('INTERNET-EP1');
  });

  it('merged.projectName prime sur ENTSOE et Registry (source officielle ECP)', () => {
    const merged: MergedComponent = { ...baseMerged, projectName: 'INTERNET-EP1' };
    const registry = { displayName: 'INTERNET-2' };
    const entsoe = { displayName: 'ENTSOE name' };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, registry, entsoe }, defaultFallback);
    expect(result.displayName).toBe('INTERNET-EP1');
    expect(result.projectName).toBe('INTERNET-EP1');
  });

  it('admin override bat même merged.projectName', () => {
    const merged: MergedComponent = { ...baseMerged, projectName: 'INTERNET-EP1' };
    const override = { displayName: 'Mon label manuel' };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, override }, defaultFallback);
    expect(result.displayName).toBe('Mon label manuel');
    // Mais le projectName brut reste exposé pour le popup UI (chip)
    expect(result.projectName).toBe('INTERNET-EP1');
  });

  it('registry.displayName est utilisé pour EICs partenaires sans projectName', () => {
    const merged: MergedComponent = { ...baseMerged, projectName: null };
    const registry = { displayName: 'TERNA CD' };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, registry }, defaultFallback);
    expect(result.displayName).toBe('TERNA CD');
    expect(result.projectName).toBeNull();
  });

  it('merged.projectName prime sur merged.displayName local', () => {
    const merged: MergedComponent = {
      ...baseMerged,
      projectName: 'INTERNET-EP1',
      displayName: 'legacy-name',
    };
    const result = applyCascade('EIC-X', merged, emptyInputs, defaultFallback);
    expect(result.displayName).toBe('INTERNET-EP1');
  });
});
