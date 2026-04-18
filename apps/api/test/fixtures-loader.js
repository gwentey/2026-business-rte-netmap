"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CD_FIXTURE = exports.ENDPOINT_FIXTURE = void 0;
exports.buildZipFromFixture = buildZipFromFixture;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const adm_zip_1 = __importDefault(require("adm-zip"));
const REPO_ROOT = (0, node_path_1.join)(process.cwd(), '..', '..');
const FIXTURES_ROOT = (0, node_path_1.join)(REPO_ROOT, 'tests', 'fixtures');
const INGESTED_FILES = new Set([
    'application_property.csv',
    'component_directory.csv',
    'message_path.csv',
    'messaging_statistics.csv',
    'message_type.csv',
    'message_upload_route.csv',
    'component_statistics.csv',
    'synchronized_directories.csv',
    'pending_edit_directories.csv',
    'pending_removal_directories.csv',
]);
function buildZipFromFixture(folderName) {
    const dir = (0, node_path_1.join)(FIXTURES_ROOT, folderName);
    const zip = new adm_zip_1.default();
    for (const entry of (0, node_fs_1.readdirSync)(dir)) {
        if (!INGESTED_FILES.has(entry))
            continue;
        zip.addFile(entry, (0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, entry)));
    }
    return zip.toBuffer();
}
exports.ENDPOINT_FIXTURE = '17V000000498771C_2026-04-17T21_27_17Z';
exports.CD_FIXTURE = '17V000002014106G_2026-04-17T22_11_50Z';
//# sourceMappingURL=fixtures-loader.js.map