/**
 * Offline integrity checks — no network, no browser.
 * Run: node _smoke_test.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    POI_TYPES,
    LINE_TYPES,
    escapeHtml,
    resolvePoiType,
    getPoiSvg,
    getPoiLabel
} from './poiTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
let failed = 0;

function ok(label) {
    console.log('OK  ', label);
}

function fail(label, err) {
    failed++;
    console.error('FAIL', label, err?.message || err);
}

// --- Archive GeoJSON ---
const archiveFiles = [
    'archive/baskhedi_georeferenced.geojson',
    'archive/baskhedi_raw_pixels.geojson',
    'archive/public_baskhedi_georeferenced.geojson'
];

for (const rel of archiveFiles) {
    try {
        const j = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
        if (j.type !== 'FeatureCollection' || !Array.isArray(j.features) || j.features.length === 0) {
            throw new Error('invalid FeatureCollection');
        }
        ok(`${rel} (${j.features.length} features)`);
    } catch (e) {
        fail(rel, e);
    }
}

// --- Runtime overlays ---
const overlays = [
    'public/baskhedi_enhanced.jpeg',
    'public/map2_enhanced.jpeg',
    'public/map3_enhanced.jpeg',
    'public/map2.jpeg',
    'public/map3.jpeg'
];

for (const rel of overlays) {
    try {
        const st = fs.statSync(path.join(root, rel));
        if (st.size < 1000) throw new Error(`too small: ${st.size}`);
        ok(`${rel} (${st.size} bytes)`);
    } catch (e) {
        fail(rel, e);
    }
}

// --- App source references ---
try {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    for (const must of [
        'poiTypes.js',
        'baskhedi_enhanced.jpeg',
        'map2_enhanced.jpeg',
        'map3_enhanced.jpeg',
        'paintPoiMarkerElement',
        'updateDoc',
        'village-image'
    ]) {
        if (!app.includes(must)) throw new Error(`missing reference: ${must}`);
    }
    for (const gone of ['baskhedi_clean.png', 'baskhedi_ai.png', 'digitizer.js', 'baskhedi-image']) {
        if (app.includes(gone)) throw new Error(`still references deleted asset: ${gone}`);
    }
    ok('app.js references');
} catch (e) {
    fail('app.js references', e);
}

// --- Shell files ---
try {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    if (!html.includes('./app.js')) throw new Error('missing app.js script');
    if (!html.includes('btn-export-geojson')) throw new Error('missing export button');
    if (!html.includes('btn-print-map')) throw new Error('missing print button');
    ok('index.html');
} catch (e) {
    fail('index.html', e);
}

try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (pkg.main !== 'main.js') throw new Error('package.main != main.js');
    if (!fs.existsSync(path.join(root, 'main.js'))) throw new Error('main.js missing');
    ok('package.json + main.js');
} catch (e) {
    fail('package/main', e);
}

// --- poiTypes module ---
try {
    if (!Array.isArray(POI_TYPES) || POI_TYPES.length < 5) throw new Error('POI_TYPES too small');
    if (!LINE_TYPES.has('road') || !LINE_TYPES.has('canal')) throw new Error('LINE_TYPES incomplete');
    if (escapeHtml('<x>') !== '&lt;x&gt;') throw new Error('escapeHtml broken');
    if (resolvePoiType('shop') !== 'service_provider') throw new Error('legacy shop map');
    if (resolvePoiType('temple') !== 'temple_mosque') throw new Error('legacy temple map');
    if (!getPoiSvg('house').includes('<svg')) throw new Error('getPoiSvg');
    if (!getPoiLabel('school')) throw new Error('getPoiLabel');
    ok(`poiTypes.js (${POI_TYPES.length} types)`);
} catch (e) {
    fail('poiTypes.js', e);
}

// --- dist (if built) ---
if (fs.existsSync(path.join(root, 'dist/index.html'))) {
    for (const rel of [
        'dist/baskhedi_enhanced.jpeg',
        'dist/map2_enhanced.jpeg',
        'dist/map3_enhanced.jpeg'
    ]) {
        try {
            if (!fs.existsSync(path.join(root, rel))) throw new Error('missing');
            ok(rel);
        } catch (e) {
            fail(rel, e);
        }
    }
} else {
    console.log('SKIP dist/ (run npm run build first)');
}

if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
}
console.log('\nALL CHECKS PASSED');
