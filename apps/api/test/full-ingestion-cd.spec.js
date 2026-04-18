"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const testing_1 = require("@nestjs/testing");
const supertest_1 = __importDefault(require("supertest"));
const app_module_js_1 = require("../src/app.module.js");
const prisma_service_js_1 = require("../src/prisma/prisma.service.js");
const fixtures_loader_js_1 = require("./fixtures-loader.js");
(0, vitest_1.describe)('Full ingestion — Component Directory', () => {
    let app;
    let prisma;
    let snapshotId;
    (0, vitest_1.beforeAll)(async () => {
        const ref = await testing_1.Test.createTestingModule({ imports: [app_module_js_1.AppModule] }).compile();
        app = ref.createNestApplication();
        app.setGlobalPrefix('api');
        await app.init();
        prisma = app.get(prisma_service_js_1.PrismaService);
        await prisma.snapshot.deleteMany({});
    });
    (0, vitest_1.afterAll)(async () => {
        if (snapshotId) {
            await prisma.snapshot.deleteMany({ where: { id: snapshotId } });
        }
        await app.close();
    });
    (0, vitest_1.it)('ingests the CD backup and detects componentType=COMPONENT_DIRECTORY', async () => {
        const zip = (0, fixtures_loader_js_1.buildZipFromFixture)(fixtures_loader_js_1.CD_FIXTURE);
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/snapshots')
            .field('label', 'Test CD')
            .field('envName', 'OPF')
            .attach('zip', zip, { filename: 'cd.zip', contentType: 'application/zip' })
            .expect(201);
        snapshotId = res.body.id;
        (0, vitest_1.expect)(res.body.componentType).toBe('COMPONENT_DIRECTORY');
        (0, vitest_1.expect)(res.body.sourceComponentCode).toBe('17V000002014106G');
        (0, vitest_1.expect)(res.body.cdCode).toBe('17V000002014106G');
        const graphRes = await (0, supertest_1.default)(app.getHttpServer())
            .get(`/api/snapshots/${snapshotId}/graph`)
            .expect(200);
        const hasCdNode = graphRes.body.nodes.some((n) => n.kind === 'RTE_CD' && n.eic === '17V000002014106G');
        (0, vitest_1.expect)(hasCdNode).toBe(true);
    });
});
//# sourceMappingURL=full-ingestion-cd.spec.js.map