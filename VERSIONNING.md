# Historique des versions — Carto ECP

| Version | Date | Composants modifiés | Description | Auteur |
|---------|------|---------------------|-------------|--------|
| 2.0.0-alpha.7 | 2026-04-20 | api/admin, api/entsoe, web/admin (DangerZoneTab + EntsoeAdminTab) | Zone danger (3 purges typing-to-confirm) + annuaire ENTSO-E uploadable (POST /api/entsoe/upload) | Claude + gwentey |
| 2.0.0-alpha.6 | 2026-04-20 | web/timeline-slider, web/map, store | Timeline slider UI : navigation historique par refDate, bouton retour au présent | Claude + gwentey |
| 2.0.0-alpha.5 | 2026-04-20 | api/overrides, web/admin (ComponentsAdminTable + ComponentOverrideModal) | Admin — surcharge EIC par composant : cascade 5 niveaux, PUT /api/overrides/:eic, GET /api/admin/components | Claude + gwentey |
| 2.0.0-alpha.4 | 2026-04-20 | web/admin (AdminPage + AdminTabs + ImportsAdminTable), web/upload | Admin panel — onglet Imports : liste, suppression, édition label/effectiveDate | Claude + gwentey |
| 2.0.0-alpha.3 | 2026-04-19 | web/map (node-icon, NodeMarker, EdgePath) | Icônes différenciées broker/CD/endpoint (Lucide + DivIcon) + badge isDefaultPosition + remplacement leaflet-curve par Polyline Bézier | Claude + gwentey |
| 2.0.0-alpha.2 | 2026-04-19 | api/ingestion (DumpTypeDetector, CsvPathReader, ImportBuilder), web/upload, web/upload-batch-table | Multi-upload ZIPs + détection fiable CSV par signatures + parser CD (CsvPathReader) + UploadBatchTable | Claude + gwentey |
| 2.0.0-alpha.1 | 2026-04-19 | api/ingestion, api/graph, api/envs, api/imports, BDD Prisma, shared/types | Refonte data model raw + compute-on-read : Import/ImportedComponent/ImportedPath, cascade 5 niveaux, GraphService.getGraph(env, refDate), suppression endpoints /snapshots | Claude + gwentey |
| 1.0.0 | 2026-04-18 | Tous | Slice #1 initial livré — pipeline ingestion 5 services, carte Leaflet, Snapshot/Component/MessagePath | Claude + gwentey |
