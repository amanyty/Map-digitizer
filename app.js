import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import {
  LINE_TYPES,
  escapeHtml,
  resolvePoiType,
  getPoiSvg,
  getPoiLabel,
  extractIconColor,
  renderLegend,
  renderToolbar,
  populateTypeSelect
} from './poiTypes.js';

const firebaseConfig = {
  projectId: "map-digitizer-baskhedi",
  appId: "1:511025802785:web:5165ca12f8d7787325fd60",
  storageBucket: "map-digitizer-baskhedi.firebasestorage.app",
  apiKey: "AIzaSyDny17QoBAyeBdXUM0Tzw1ePOEB0uzUi70",
  authDomain: "map-digitizer-baskhedi.firebaseapp.com",
  messagingSenderId: "511025802785"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize Lucide Icons on load
if (window.lucide) {
  window.lucide.createIcons();
}

// Global Application State
let map = null;
let mapboxToken = localStorage.getItem('mapbox_access_token') || '';

// --- VILLAGE CONFIGURATION ---
const defaultVillageConfig = {
  baskhedi: {
    name: "Baskhedi",
    center: [75.2644, 24.2589],
    imageOverlayUrl: "/baskhedi_enhanced.jpeg?v=14",
    imageCoordinates: [
      [75.2595, 24.2634],
      [75.2693, 24.2634],
      [75.2693, 24.2544],
      [75.2595, 24.2544]
    ],
    firestoreCollection: "features"
  },
  village2: {
    name: "Junapani (Map 2)",
    center: [74.6942, 21.6899],
    imageOverlayUrl: "/map2_enhanced.jpeg?v=3",
    imageCoordinates: [
      [74.6842, 21.7049],
      [74.7042, 21.7049],
      [74.7042, 21.6749],
      [74.6842, 21.6749]
    ],
    firestoreCollection: "features_village2"
  },
  village3: {
    name: "Shivni Padawa (Map 3)",
    center: [75.2644, 24.2589],
    imageOverlayUrl: "/map3_enhanced.jpeg?v=1",
    imageCoordinates: [
      [75.2544, 24.2671],
      [75.2744, 24.2671],
      [75.2744, 24.2506],
      [75.2544, 24.2506]
    ],
    firestoreCollection: "features_village3"
  }
};

let villageConfig = defaultVillageConfig;
let currentVillageId = localStorage.getItem('current_village_id') || 'baskhedi';

const villageTitle = document.getElementById('village-title');
const villageSelect = document.getElementById('village-select');

function updateVillageUI() {
  if (villageTitle && villageConfig[currentVillageId]) {
    villageTitle.innerText = villageConfig[currentVillageId].name;
  }

  if (villageSelect) {
    villageSelect.innerHTML = '';
    for (const [key, config] of Object.entries(villageConfig)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = config.name;
      villageSelect.appendChild(option);
    }
    villageSelect.value = currentVillageId;
  }
}

if (villageSelect) {
  villageSelect.addEventListener('change', (e) => {
    currentVillageId = e.target.value;
    localStorage.setItem('current_village_id', currentVillageId);
    if (map) {
      window.location.reload();
    }
  });
}



let currentGeoJSON = { type: 'FeatureCollection', features: [] };
let draw = null;
let isEditMode = false;
let drawHandlersAttached = false;
let activeEditTool = null; // POI type id, line type, or 'delete'
const markers = {}; // HTML markers

// POI State
let editingPoiId = null;
let editingPoiCoords = null;
let defaultPoiName = '';
let defaultPoiType = '';
let rememberPoiDetails = false;

// Routing coordinates state
let startCoords = null;
let endCoords = null;
let startMarker = null;
let endMarker = null;

// Client-side Routing Graph State
const routingGraph = {};
const uniqueNodes = [];
const SNAPPING_TOLERANCE_METERS = 50.0;

// UI Elements
const tokenInput = document.getElementById('mapbox-token-input');
const saveTokenBtn = document.getElementById('btn-save-token');
const tokenInputModal = document.getElementById('mapbox-token-input-modal');
const saveTokenBtnModal = document.getElementById('btn-save-token-modal');
const tokenOverlay = document.getElementById('token-required-overlay');
const tokenConfigDetails = document.getElementById('token-config-details');

const coordsStartDisplay = document.getElementById('coords-start');
const coordsEndDisplay = document.getElementById('coords-end');
const routeStatsContainer = document.getElementById('route-stats');
const routeDistanceDisplay = document.getElementById('route-distance');
const snapStartDisplay = document.getElementById('snap-start-distance');
const snapEndDisplay = document.getElementById('snap-end-distance');
const clearRouteBtn = document.getElementById('btn-clear-route');

const btnToggleEdit = document.getElementById('btn-toggle-edit');
const btnPrintMap = document.getElementById('btn-print-map');
const btnExportGeoJSON = document.getElementById('btn-export-geojson');
const authModal = document.getElementById('auth-modal');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnSubmitAuth = document.getElementById('btn-submit-auth');
const btnCancelAuth = document.getElementById('btn-cancel-auth');
const authError = document.getElementById('auth-error');

const poiModal = document.getElementById('poi-modal');
const poiNameInput = document.getElementById('poi-name');
const poiTypeInput = document.getElementById('poi-type');
const btnSavePoi = document.getElementById('btn-save-poi');
const btnCancelPoi = document.getElementById('btn-cancel-poi');
const btnDeletePoi = document.getElementById('btn-delete-poi');
const editToolbar = document.getElementById('edit-toolbar');
const editStatusText = document.getElementById('edit-status-text');
let toolBtns = [];

// Build legend, toolbar, and type select from shared catalog
renderLegend(document.querySelector('.legend-list'));
const toolbarTools = document.querySelector('.edit-toolbar-tools');
renderToolbar(toolbarTools);
populateTypeSelect(poiTypeInput);
toolBtns = Array.from(document.querySelectorAll('.btn-tool'));
if (window.lucide) window.lucide.createIcons();

// --- AUTHENTICATION & EDIT MODE ---
onAuthStateChanged(auth, user => {
  if (user) {
    btnToggleEdit.innerHTML = `<i data-lucide="log-out"></i> Exit Edit Mode`;
    if (window.lucide) window.lucide.createIcons();
    enableEditMode();
  } else {
    btnToggleEdit.innerHTML = `<i data-lucide="edit-2"></i> Enter Edit Mode`;
    if (window.lucide) window.lucide.createIcons();
    disableEditMode();
  }
});

btnToggleEdit.addEventListener('click', () => {
  if (auth.currentUser) {
    signOut(auth);
  } else {
    authModal.classList.remove('hidden');
  }
});

btnCancelAuth.addEventListener('click', () => authModal.classList.add('hidden'));

btnSubmitAuth.addEventListener('click', async () => {
  try {
    authError.style.display = 'none';
    await signInWithEmailAndPassword(auth, authEmail.value, authPassword.value);
    authModal.classList.add('hidden');
  } catch (err) {
    authError.innerText = err.message;
    authError.style.display = 'block';
  }
});

// --- POI MODAL LOGIC ---
btnCancelPoi.addEventListener('click', () => {
  poiModal.classList.add('hidden');
});

btnDeletePoi.addEventListener('click', async () => {
  if (editingPoiId) {
    await deleteDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, editingPoiId));
    if (markers[editingPoiId]) {
      markers[editingPoiId].marker.remove();
      delete markers[editingPoiId];
    }
  }
  poiModal.classList.add('hidden');
});

btnSavePoi.addEventListener('click', async () => {
  const name = poiNameInput.value.trim() || 'Custom POI';
  const type = poiTypeInput.value;

  // Close the modal immediately so the UI feels snappy
  poiModal.classList.add('hidden');

  const rememberCheckbox = document.getElementById('poi-remember');
  if (rememberCheckbox && rememberCheckbox.checked) {
    rememberPoiDetails = true;
    defaultPoiName = name;
    defaultPoiType = type;
  } else {
    rememberPoiDetails = false;
  }

  if (editingPoiId) {
    // Update existing
    await updateDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, editingPoiId), {
      'properties.name': name,
      'properties.type': type
    });
  } else if (editingPoiCoords) {
    // Create new
    const docId = doc(collection(db, villageConfig[currentVillageId].firestoreCollection)).id;
    const newFeature = {
      type: "Feature",
      id: docId,
      properties: { type: type, name: name },
      geometry: {
        type: "Point",
        coordinates: JSON.stringify(editingPoiCoords)
      }
    };
    await setDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, docId), newFeature);
  }
});

async function onDrawSelectionChange(e) {
  if (isEditMode && activeEditTool === 'delete') {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      if (feature.id) {
        await deleteDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, feature.id));
        draw.delete(feature.id);
      }
    }
  }
}

function attachDrawHandlers() {
  if (!map || drawHandlersAttached) return;
  map.on('draw.create', syncDrawToFirestore);
  map.on('draw.update', syncDrawToFirestore);
  map.on('draw.delete', deleteFromFirestore);
  map.on('draw.selectionchange', onDrawSelectionChange);
  drawHandlersAttached = true;
}

function detachDrawHandlers() {
  if (!map || !drawHandlersAttached) return;
  map.off('draw.create', syncDrawToFirestore);
  map.off('draw.update', syncDrawToFirestore);
  map.off('draw.delete', deleteFromFirestore);
  map.off('draw.selectionchange', onDrawSelectionChange);
  drawHandlersAttached = false;
}

function enableEditMode() {
  isEditMode = true;
  editToolbar.classList.remove('hidden');
  const customBgDetails = document.getElementById('custom-bg-details');
  if (customBgDetails) customBgDetails.classList.remove('hidden');

  if (document.getElementById('btn-add-map')) {
    document.getElementById('btn-add-map').classList.remove('hidden');
  }

  if (!map) return;

  if (!draw) {
    draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {}
    });
  }
  try {
    map.addControl(draw);
  } catch (_) {
    // already added
  }
  const linesOnly = {
    type: 'FeatureCollection',
    features: currentGeoJSON.features.filter(f => f.geometry && f.geometry.type === 'LineString')
  };
  draw.set(linesOnly);
  attachDrawHandlers();

  for (const id in markers) {
    markers[id].marker.setDraggable(true);
  }
}

function disableEditMode() {
  isEditMode = false;
  editToolbar.classList.add('hidden');
  const customBgDetails = document.getElementById('custom-bg-details');
  if (customBgDetails) customBgDetails.classList.add('hidden');

  if (document.getElementById('btn-add-map')) {
    document.getElementById('btn-add-map').classList.add('hidden');
  }

  resetActiveTool();

  if (map && draw) {
    detachDrawHandlers();
    try {
      map.removeControl(draw);
    } catch (_) {
      // not attached
    }
  }

  for (const id in markers) {
    markers[id].marker.setDraggable(false);
  }
}

// --- CUSTOM EDIT TOOLBAR LOGIC ---
function bindToolButtons() {
  toolBtns = Array.from(document.querySelectorAll('.btn-tool'));
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toolBtns.forEach(b => b.classList.remove('active'));

      if (activeEditTool === btn.dataset.type) {
        resetActiveTool();
        return;
      }

      btn.classList.add('active');
      activeEditTool = btn.dataset.type;

      if (LINE_TYPES.has(activeEditTool)) {
        editStatusText.innerText = "Click to draw road. Double-click to finish.";
        if (draw) draw.changeMode('draw_line_string');
        if (map) map.getCanvas().style.cursor = 'crosshair';
      } else if (activeEditTool === 'delete') {
        editStatusText.innerText = "Click on a POI or road to delete it.";
        if (draw) draw.changeMode('simple_select');
        if (map) map.getCanvas().style.cursor = 'no-drop';
      } else {
        editStatusText.innerText = `Click anywhere to place a ${activeEditTool}.`;
        if (draw) draw.changeMode('simple_select');
        if (map) map.getCanvas().style.cursor = 'crosshair';
      }
    });
  });
}
bindToolButtons();

function resetActiveTool() {
  activeEditTool = null;
  toolBtns.forEach(b => b.classList.remove('active'));
  editStatusText.innerText = "Click a tool or drag icons";
  if (map) map.getCanvas().style.cursor = '';
  if (draw) draw.changeMode('simple_select');
}

// Mapbox Draw sync
async function syncDrawToFirestore(e) {
  const features = e.features;
  for (const f of features) {
    const docId = f.id || doc(collection(db, villageConfig[currentVillageId].firestoreCollection)).id;
    f.id = docId;

    // Force 'road' type if it was drawn with the line string tool
    if (!f.properties.type && f.geometry.type === 'LineString') {
      f.properties.type = activeEditTool && LINE_TYPES.has(activeEditTool) ? activeEditTool : 'road';
    }

    const data = JSON.parse(JSON.stringify(f));
    data.geometry.coordinates = JSON.stringify(data.geometry.coordinates);
    await setDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, docId), data);
  }

  if (LINE_TYPES.has(activeEditTool)) {
    setTimeout(() => {
      if (draw && LINE_TYPES.has(activeEditTool)) {
        draw.changeMode('draw_line_string');
      }
    }, 50);
  }
}

async function deleteFromFirestore(e) {
  const features = e.features;
  for (const f of features) {
    if (f.id) await deleteDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, f.id));
  }
}

// --- MAP INITIALIZATION ---
function initTokenState() {
  if (mapboxToken) {
    tokenInput.value = mapboxToken;
    if (tokenInputModal) tokenInputModal.value = mapboxToken;
    tokenOverlay.classList.add('hidden');
    tokenConfigDetails.removeAttribute('open');
    initializeMap();
  } else {
    tokenOverlay.classList.remove('hidden');
    tokenConfigDetails.setAttribute('open', '');
  }
}

function saveToken(token) {
  if (token) {
    localStorage.setItem('mapbox_access_token', token);
    mapboxToken = token;
    tokenOverlay.classList.add('hidden');
    tokenConfigDetails.removeAttribute('open');
    if (map) window.location.reload();
    else initializeMap();
  } else {
    alert("Please enter a valid Mapbox Access Token.");
  }
}

saveTokenBtn.addEventListener('click', () => saveToken(tokenInput.value.trim()));
if (saveTokenBtnModal) {
  saveTokenBtnModal.addEventListener('click', () => saveToken(tokenInputModal.value.trim()));
}


function initializeMap() {
  if (map) return;
  mapboxgl.accessToken = mapboxToken;

  try {
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: villageConfig[currentVillageId].center,
      zoom: 15.5,
      preserveDrawingBuffer: true,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false
    });

    map.on('load', () => {
      // AI Generated stylized map overlay
      const vConfig = villageConfig[currentVillageId];
      let urlToUse = vConfig.imageOverlayUrl;
      if (window.customBgUrl) {
        urlToUse = window.customBgUrl;
      }
      if (urlToUse) {
        map.addSource('village-image', {
          type: 'image',
          url: urlToUse,
          coordinates: vConfig.imageCoordinates
        });
        map.addLayer({
          id: 'village-overlay',
          type: 'raster',
          source: 'village-image',
          paint: { 'raster-opacity': 1.0 }
        });
      }



      map.addSource('village-features', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });


      map.addLayer({
        id: 'roads-line',
        type: 'line',
        source: 'village-features',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'canal', '#0ea5e9',
                /* default for road / curved_road */ '#000000'
          ],
          'line-width': [
            'match',
            ['get', 'type'],
            'canal', 6, // Make canal wider
            3.5 // Default
          ],
          'line-opacity': 1.0
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' }
      });

      map.addLayer({
        id: 'roads-line-hover',
        type: 'line',
        source: 'village-features',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'canal', '#0284c7',
            '#333333'
          ],
          'line-width': 7,
          'line-opacity': 0.0
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' }
      });
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#06b6d4', 'line-width': 7, 'line-opacity': 0.95 }
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      map.on('click', onMapClick);
      if (isEditMode) enableEditMode();
      loadFirestoreData();
    });

  } catch (error) {
    console.error("Mapbox initialization error:", error);
    alert("Failed to initialize Mapbox.");
  }
}

function loadFirestoreData() {
  onSnapshot(collection(db, villageConfig[currentVillageId].firestoreCollection), (snapshot) => {
    const features = [];
    snapshot.forEach(docSnap => {
      let data = docSnap.data();
      if (data.geometry && typeof data.geometry.coordinates === 'string') {
        try { data.geometry.coordinates = JSON.parse(data.geometry.coordinates); } catch (e) { console.warn('Bad coordinates for feature', docSnap.id, e); return; }
      }
      data.id = docSnap.id;
      features.push(data);
    });

    currentGeoJSON.features = features;

    if (map && map.getSource('village-features')) {
      map.getSource('village-features').setData(currentGeoJSON);
    }

    buildRoutingGraph(currentGeoJSON);
    renderMarkers(features);

    if (isEditMode && draw) {
      const linesOnly = {
        type: 'FeatureCollection',
        features: currentGeoJSON.features.filter(f => f.geometry && f.geometry.type === 'LineString')
      };
      draw.set(linesOnly);
    }
  });
}

function paintPoiMarkerElement(el, props) {
  const typeToUse = resolvePoiType(props.type);
  const iconHtml = getPoiSvg(typeToUse);
  const extractColor = extractIconColor(iconHtml);
  const safeName = escapeHtml(props.name || '');
  const titleText = escapeHtml(props.name || props.type || 'POI');

  el.className = `map-poi-marker ${typeToUse || 'poi'}`;
  el.innerHTML = `
    <div class="poi-icon-wrapper" style="color: ${extractColor}; display: flex; flex-direction: column; align-items: center;" title="${titleText}">
      ${iconHtml}
    </div>
    ${safeName ? `
      <div class="poi-label-container">
        <span class="poi-label-text">${safeName}</span>
      </div>
    ` : ''}
  `;
}

function markerPropsSignature(props = {}) {
  return `${props.name || ''}|${props.type || ''}`;
}

function renderMarkers(features) {
  const incomingIds = new Set();

  features.forEach(feature => {
    if (feature.geometry && feature.geometry.type === 'Point') {
      incomingIds.add(feature.id);

      const coords = feature.geometry.coordinates;
      const props = feature.properties || {};

      if (!markers[feature.id]) {
        const el = document.createElement('div');
        paintPoiMarkerElement(el, props);

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', draggable: isEditMode })
          .setLngLat(coords)
          .addTo(map);

        // Handle Marker Drag — always read the latest feature from the markers map
        marker.on('dragstart', () => { el.setAttribute('data-dragging', 'true'); });
        marker.on('dragend', async () => {
          setTimeout(() => el.removeAttribute('data-dragging'), 100);
          const lngLat = marker.getLngLat();
          const docId = feature.id;
          const latest = markers[docId]?.feature || feature;
          const data = JSON.parse(JSON.stringify(latest));
          data.geometry.coordinates = JSON.stringify([lngLat.lng, lngLat.lat]);
          await setDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, docId), data);
        });

        const popup = new mapboxgl.Popup({ offset: [0, -27], closeButton: true, className: 'poi-popup' });

        el.addEventListener('click', async (e) => {
          if (el.getAttribute('data-dragging') === 'true') { e.stopPropagation(); return; }
          e.stopPropagation();

          if (isEditMode && activeEditTool === 'delete') {
            await deleteDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, feature.id));
            return;
          }

          if (isEditMode) return; // Disable popup in normal edit mode

          const latestProps = (markers[feature.id]?.feature?.properties) || props;
          popup.setLngLat(marker.getLngLat())
            .setHTML(`
              <div class="popup-title">${escapeHtml(latestProps.name || 'Unnamed Point')}</div>
              <div class="popup-type">${escapeHtml(getPoiLabel(latestProps.type) || latestProps.type || 'POI')}</div>
              <div class="popup-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-xs btn-route-start" style="padding: 4px 8px; font-size: 10px; border-radius: 4px;">
                  <i data-lucide="flag" style="width: 12px; height: 12px;"></i> Start Here
                </button>
                <button class="btn btn-primary btn-xs btn-route-end" style="padding: 4px 8px; font-size: 10px; border-radius: 4px;">
                  <i data-lucide="navigation" style="width: 12px; height: 12px;"></i> End Here
                </button>
              </div>
            `)
            .addTo(map);

          if (window.lucide) window.lucide.createIcons();
          setTimeout(() => {
            const btnStart = document.querySelector('.btn-route-start');
            const btnEnd = document.querySelector('.btn-route-end');
            if (btnStart) btnStart.addEventListener('click', (ev) => { ev.stopPropagation(); setStartEndpoint(marker.getLngLat().lng, marker.getLngLat().lat); popup.remove(); });
            if (btnEnd) btnEnd.addEventListener('click', (ev) => { ev.stopPropagation(); setEndEndpoint(marker.getLngLat().lng, marker.getLngLat().lat); popup.remove(); });
          }, 50);
        });

        // Add click listener to open the Edit POI modal
        el.addEventListener('click', (e) => {
          if (el.getAttribute('data-dragging') === 'true') { e.stopPropagation(); return; }
          if (isEditMode && activeEditTool !== 'delete') {
            e.stopPropagation();
            editingPoiId = feature.id;
            editingPoiCoords = null;

            const latestProps = (markers[feature.id]?.feature?.properties) || props;
            poiNameInput.value = latestProps.name || '';
            // Normalize legacy type ids so the select shows the correct option
            poiTypeInput.value = resolvePoiType(latestProps.type || 'misc');

            poiModal.classList.remove('hidden');
            btnDeletePoi.style.display = 'block';
            poiNameInput.focus();
          }
        });

        markers[feature.id] = {
          marker,
          el,
          props,
          feature,
          signature: markerPropsSignature(props)
        };
      } else {
        const existing = markers[feature.id];
        existing.marker.setLngLat(coords);
        existing.feature = feature;
        existing.props = props;
        const nextSig = markerPropsSignature(props);
        // Refresh icon/label when name or type changes (e.g. after edit in Firestore)
        if (existing.signature !== nextSig) {
          paintPoiMarkerElement(existing.el, props);
          existing.signature = nextSig;
        }
      }
    }
  });

  for (const id in markers) {
    if (!incomingIds.has(id)) {
      markers[id].marker.remove();
      delete markers[id];
    }
  }
  if (window.lucide) window.lucide.createIcons();
}

// Map Clicks for Point Creation
async function onMapClick(e) {
  if (e.originalEvent.target.closest('.mapboxgl-popup') || e.originalEvent.target.closest('.map-poi-marker') || e.originalEvent.target.closest('.mapboxgl-ctrl')) return;

  if (isEditMode) {
    if (activeEditTool && !LINE_TYPES.has(activeEditTool) && activeEditTool !== 'delete') {
      // Instead of instantly saving, open the modal to customize name and type
      editingPoiId = null;
      editingPoiCoords = [e.lngLat.lng, e.lngLat.lat];

      const rememberCheckbox = document.getElementById('poi-remember');
      if (rememberPoiDetails && defaultPoiType) {
        poiNameInput.value = defaultPoiName;
        poiTypeInput.value = defaultPoiType;
        if (rememberCheckbox) rememberCheckbox.checked = true;
      } else {
        poiNameInput.value = `${activeEditTool.charAt(0).toUpperCase() + activeEditTool.slice(1).replace(/_/g, ' ')}`;
        poiTypeInput.value = activeEditTool;
        if (rememberCheckbox) rememberCheckbox.checked = false;
      }

      poiModal.classList.remove('hidden');
      btnDeletePoi.style.display = 'none'; // Don't show delete when creating a new one
      poiNameInput.focus();
    }
    return;
  }

  const coords = e.lngLat;
  if (!startCoords) setStartEndpoint(coords.lng, coords.lat);
  else if (!endCoords) setEndEndpoint(coords.lng, coords.lat);
  else setStartEndpoint(coords.lng, coords.lat);
}

// --- CLICK TO ROUTE LOGIC ---
function setStartEndpoint(lng, lat) {
  if (startCoords && endCoords) clearRoute();
  startCoords = { lng, lat };
  if (coordsStartDisplay) coordsStartDisplay.innerText = `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  if (startMarker) startMarker.remove();
  const el = document.createElement('div');
  el.className = 'custom-marker start';
  startMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
  if (clearRouteBtn) clearRouteBtn.classList.remove('disabled');
  if (clearRouteBtn) clearRouteBtn.removeAttribute('disabled');
  if (endCoords) fetchShortestRoute();
}

function setEndEndpoint(lng, lat) {
  if (!startCoords) { alert("Please select a starting point first."); return; }
  endCoords = { lng, lat };
  if (coordsEndDisplay) coordsEndDisplay.innerText = `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  if (endMarker) endMarker.remove();
  const el = document.createElement('div');
  el.className = 'custom-marker end';
  endMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
  fetchShortestRoute();
}

function fetchShortestRoute() {
  if (!startCoords || !endCoords) return;
  const startSnap = findNearestNode(startCoords.lng, startCoords.lat);
  const endSnap = findNearestNode(endCoords.lng, endCoords.lat);
  if (!startSnap.node || !endSnap.node) return;

  const result = solveDijkstra(startSnap.node, endSnap.node);
  if (result) {
    const routeGeoJSON = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: result.path },
      properties: { distance_meters: result.distance, snapped_start: { distance_meters: startSnap.distance }, snapped_end: { distance_meters: endSnap.distance } }
    };
    map.getSource('route').setData(routeGeoJSON);
    if (routeDistanceDisplay) routeDistanceDisplay.innerText = `${result.distance.toLocaleString()}m`;
    if (snapStartDisplay) snapStartDisplay.innerText = `${startSnap.distance.toFixed(1)}m`;
    if (snapEndDisplay) snapEndDisplay.innerText = `${endSnap.distance.toFixed(1)}m`;
    if (routeStatsContainer) routeStatsContainer.classList.remove('hidden');

    const bounds = new mapboxgl.LngLatBounds();
    result.path.forEach(c => bounds.extend(c));
    map.fitBounds(bounds, { padding: 80, maxZoom: 17, duration: 1000 });
  } else {
    alert("No route exists.");
    if (endMarker) { endMarker.remove(); endMarker = null; endCoords = null; if (coordsEndDisplay) coordsEndDisplay.innerText = "Not selected"; }
  }
}

function clearRoute() {
  startCoords = null; endCoords = null;
  if (startMarker) { startMarker.remove(); startMarker = null; }
  if (endMarker) { endMarker.remove(); endMarker = null; }
  if (map && map.getSource('route')) map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
  if (coordsStartDisplay) coordsStartDisplay.innerText = "Not selected"; if (coordsEndDisplay) coordsEndDisplay.innerText = "Not selected";
  if (routeStatsContainer) routeStatsContainer.classList.add('hidden');
  if (clearRouteBtn) clearRouteBtn.classList.add('disabled'); if (clearRouteBtn) clearRouteBtn.setAttribute('disabled', '');
}
if (clearRouteBtn) clearRouteBtn.addEventListener('click', clearRoute);

// --- ROUTING ENGINE ---
function haversineDistance(c1, c2) {
  const R = 6371000.0, dLat = (c2[1] - c1[1]) * Math.PI / 180, dLon = (c2[0] - c1[0]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(c1[1] * Math.PI / 180) * Math.cos(c2[1] * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildRoutingGraph(geojson) {
  for (const key in routingGraph) delete routingGraph[key];
  uniqueNodes.length = 0;
  function getSnappedNode(coords) {
    for (const node of uniqueNodes) if (haversineDistance(coords, node) <= SNAPPING_TOLERANCE_METERS) return node;
    uniqueNodes.push(coords); return coords;
  }
  const lineStrings = geojson.features.filter(f => f.geometry && f.geometry.type === 'LineString');
  lineStrings.forEach(f => {
    const coords = f.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = getSnappedNode(coords[i]), p2 = getSnappedNode(coords[i + 1]);
      const p1K = p1.join(','), p2K = p2.join(',');
      if (p1K !== p2K) {
        const dist = haversineDistance(p1, p2);
        if (!routingGraph[p1K]) routingGraph[p1K] = [];
        if (!routingGraph[p2K]) routingGraph[p2K] = [];
        routingGraph[p1K].push({ node: p2, weight: dist });
        routingGraph[p2K].push({ node: p1, weight: dist });
      }
    }
  });
}

function findNearestNode(lng, lat) {
  let nn = null, md = Infinity;
  uniqueNodes.forEach(n => { const d = haversineDistance([lng, lat], n); if (d < md) { md = d; nn = n; } });
  return { node: nn, distance: md };
}

function solveDijkstra(startNode, endNode) {
  const startKey = startNode.join(','), endKey = endNode.join(',');
  const dists = {}, prev = {}, queue = new Set();
  uniqueNodes.forEach(n => { const k = n.join(','); dists[k] = Infinity; prev[k] = null; queue.add(k); });
  dists[startKey] = 0;
  while (queue.size > 0) {
    let minK = null, minD = Infinity;
    queue.forEach(k => { if (dists[k] < minD) { minD = dists[k]; minK = k; } });
    if (minK === null || minK === endKey) break;
    queue.delete(minK);
    (routingGraph[minK] || []).forEach(n => {
      const nK = n.node.join(',');
      if (!queue.has(nK)) return;
      const alt = dists[minK] + n.weight;
      if (alt < dists[nK]) { dists[nK] = alt; prev[nK] = minK; }
    });
  }
  const path = []; let curr = endKey;
  if (prev[curr] !== null || curr === startKey) {
    while (curr !== null) { path.unshift(curr.split(',').map(Number)); curr = prev[curr]; }
    return { path, distance: dists[endKey] };
  }
  return null;
}


const btnAddMap = document.getElementById('btn-add-map');
const newMapModal = document.getElementById('new-map-modal');
const btnCancelNewMap = document.getElementById('btn-cancel-new-map');
const btnSaveNewMap = document.getElementById('btn-save-new-map');

if (btnAddMap) {
  btnAddMap.addEventListener('click', () => {
    newMapModal.classList.remove('hidden');
  });
}

if (btnCancelNewMap) {
  btnCancelNewMap.addEventListener('click', () => {
    newMapModal.classList.add('hidden');
  });
}

if (btnSaveNewMap) {
  btnSaveNewMap.addEventListener('click', async () => {
    const mapNameInput = document.getElementById('new-map-name');
    const mapLngInput = document.getElementById('new-map-lng');
    const mapLatInput = document.getElementById('new-map-lat');

    const name = mapNameInput.value.trim();
    const lng = parseFloat(mapLngInput.value);
    const lat = parseFloat(mapLatInput.value);

    if (!name) return alert("Please enter a map name.");

    // Generate new unique ID
    const newId = `village_${Date.now()}`;
    const newConfig = {
      name: name,
      center: [lng, lat],
      imageOverlayUrl: "",
      imageCoordinates: [
        [lng - 0.01, lat + 0.01],
        [lng + 0.01, lat + 0.01],
        [lng + 0.01, lat - 0.01],
        [lng - 0.01, lat - 0.01]
      ],
      firestoreCollection: `features_${newId}`
    };

    // Stringify array for Firestore storage to avoid nested array issue
    const firestoreData = { ...newConfig, imageCoordinates: JSON.stringify(newConfig.imageCoordinates) };

    try {
      await setDoc(doc(db, 'maps', newId), firestoreData);

      // Update local config
      villageConfig[newId] = newConfig;

      // Select it and reload
      currentVillageId = newId;
      localStorage.setItem('current_village_id', currentVillageId);
      window.location.reload();
    } catch (err) {
      console.error("Error creating map", err);
      alert("Failed to create map. Make sure you are authenticated.");
    }
  });
}

async function startup() {
  try {
    const mapsSnapshot = await getDocs(collection(db, 'maps'));
    if (!mapsSnapshot.empty) {
      const loadedConfigs = {};
      mapsSnapshot.forEach(doc => {
        let data = doc.data();
        if (typeof data.imageCoordinates === 'string') {
          data.imageCoordinates = JSON.parse(data.imageCoordinates);
        }
        loadedConfigs[doc.id] = data;
      });
      villageConfig = loadedConfigs;
    }
  } catch (err) {
    console.error("Failed to load map configs from Firestore, using defaults", err);
  }

  // Update UI and ensure currentVillageId is valid
  if (!villageConfig[currentVillageId]) {
    currentVillageId = Object.keys(villageConfig)[0];
    localStorage.setItem('current_village_id', currentVillageId);
  }
  updateVillageUI();

  try {
    const url = await getCustomBackground(currentVillageId);
    if (url) {
      window.customBgUrl = url;
      if (document.getElementById('btn-reset-bg')) {
        document.getElementById('btn-reset-bg').disabled = false;
      }
    }
  } catch (e) {
    console.error("Error loading custom background", e);
  }
  initTokenState();
}


if (btnExportGeoJSON) {
  btnExportGeoJSON.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentGeoJSON, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", villageConfig[currentVillageId].name.replace(/\s+/g, '_') + "_export.geojson");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
}

function waitForMapIdle(timeoutMs = 900) {
  return new Promise((resolve) => {
    if (!map) return resolve();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    map.once('idle', done);
    setTimeout(done, timeoutMs);
  });
}

function getVillageBounds(config) {
  if (!config || !config.imageCoordinates || !config.imageCoordinates.length) return null;
  const coords = config.imageCoordinates;
  let minLng = coords[0][0], maxLng = coords[0][0];
  let minLat = coords[0][1], maxLat = coords[0][1];
  for (let i = 1; i < coords.length; i++) {
    minLng = Math.min(minLng, coords[i][0]);
    maxLng = Math.max(maxLng, coords[i][0]);
    minLat = Math.min(minLat, coords[i][1]);
    maxLat = Math.max(maxLat, coords[i][1]);
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

/** Capture WebGL map + HTML POI markers into a single PNG data URL. */
function captureMapForPrint() {
  const glCanvas = map.getCanvas();
  const out = document.createElement('canvas');
  out.width = glCanvas.width;
  out.height = glCanvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(glCanvas, 0, 0);

  const scaleX = glCanvas.width / Math.max(glCanvas.clientWidth, 1);
  const scaleY = glCanvas.height / Math.max(glCanvas.clientHeight, 1);
  const scale = (scaleX + scaleY) / 2;

  for (const id of Object.keys(markers)) {
    const entry = markers[id];
    if (!entry || !entry.marker) continue;
    const ll = entry.marker.getLngLat();
    const p = map.project(ll);
    const x = p.x * scaleX;
    const y = p.y * scaleY;
    if (x < -40 || y < -40 || x > out.width + 40 || y > out.height + 40) continue;

    const props = (entry.feature && entry.feature.properties) || entry.props || {};
    const iconWrap = entry.el && entry.el.querySelector ? entry.el.querySelector('.poi-icon-wrapper') : null;
    let color = '#f43f5e';
    if (iconWrap) {
      const cs = getComputedStyle(iconWrap).color;
      if (cs) color = cs;
    }

    const r = Math.max(4, 5 * scale);
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.arc(x, y - r * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (props.name) {
      const fontSize = Math.max(10, 11 * scale);
      ctx.font = '600 ' + fontSize + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const textY = y + r + 2 * scale;
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.fillStyle = '#111827';
      ctx.strokeText(props.name, x, textY);
      ctx.fillText(props.name, x, textY);
    }
  }

  return out.toDataURL('image/png');
}

function openCenteredPrintWindow(mapName, dataUrl) {
  const safeTitle = String(mapName || 'Map').replace(/[<>&"']/g, '');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} - Print</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%;
      background: #0f172a; color: #fff;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .bar {
      position: fixed; top: 0; left: 0; right: 0; height: 56px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 16px; background: #1e293b; z-index: 10;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    }
    .bar h1 { font-size: 15px; font-weight: 600; }
    .btn {
      background: #10b981; color: #fff; border: 0; border-radius: 8px;
      padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 14px;
    }
    .stage {
      min-height: 100%;
      padding: 72px 16px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stage img {
      max-width: 100%;
      max-height: calc(100vh - 88px);
      width: auto; height: auto;
      object-fit: contain;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    }
    @media print {
      @page { size: landscape; margin: 0; }
      html, body {
        width: 100% !important; height: 100% !important;
        background: #fff !important; overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .bar { display: none !important; }
      .stage {
        position: fixed !important;
        inset: 0 !important;
        min-height: 0 !important;
        width: 100% !important; height: 100% !important;
        margin: 0 !important; padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .stage img {
        max-width: 100% !important; max-height: 100% !important;
        width: auto !important; height: auto !important;
        object-fit: contain !important;
        border-radius: 0 !important; box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="bar">
    <h1>${safeTitle} (Print Preview)</h1>
    <button class="btn" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="stage">
    <img id="print-img" src="${dataUrl}" alt="${safeTitle}" />
  </div>
  <script>
    (function () {
      var img = document.getElementById('print-img');
      function go() { setTimeout(function () { window.focus(); window.print(); }, 150); }
      if (img.complete) go();
      else img.onload = go;
    })();
  </script>
</body>
</html>`;

  const printWin = window.open('', '_blank');
  if (!printWin) return false;
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  return true;
}

if (btnPrintMap) {
  btnPrintMap.addEventListener('click', async () => {
    if (!map) return window.print();

    const currentZoom = map.getZoom();
    const currentCenter = map.getCenter();
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();
    const config = villageConfig[currentVillageId];
    const mapName = (config && config.name) || 'Map';

    const restore = () => {
      document.body.classList.remove('is-printing');
      document.body.classList.remove('print-sheet-active');
      const sheet = document.getElementById('print-sheet');
      if (sheet) sheet.remove();
      try {
        map.jumpTo({
          center: currentCenter,
          zoom: currentZoom,
          pitch: currentPitch,
          bearing: currentBearing
        });
        map.resize();
      } catch (_) { /* map may be disposed */ }
    };

    try {
      map.setPitch(0);
      map.setBearing(0);

      // Expand map to full viewport BEFORE fitting bounds (prevents off-center print)
      document.body.classList.add('is-printing');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      map.resize();

      const bounds = getVillageBounds(config);
      if (bounds) {
        map.fitBounds(bounds, {
          padding: 40,
          animate: false,
          pitch: 0,
          bearing: 0
        });
      }
      await waitForMapIdle(1000);

      const dataUrl = captureMapForPrint();
      const opened = openCenteredPrintWindow(mapName, dataUrl);

      if (!opened) {
        // Popup blocked: in-page centered print sheet
        let sheet = document.getElementById('print-sheet');
        if (!sheet) {
          sheet = document.createElement('div');
          sheet.id = 'print-sheet';
          document.body.appendChild(sheet);
        }
        sheet.innerHTML = '';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = mapName;
        sheet.appendChild(img);
        document.body.classList.add('print-sheet-active');
        await new Promise((r) => setTimeout(r, 120));
        window.print();
      }
    } finally {
      setTimeout(restore, 500);
    }
  });
}



// --- CUSTOM BACKGROUND STORAGE (Firestore Base64) ---
function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Calculate new dimensions (max 2048px to keep it under 1MB)
        const MAX_DIMENSION = 2048;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}

async function saveCustomBackground(villageId, file) {
  const base64Url = await compressImageToBase64(file);
  await setDoc(doc(db, "village_settings", villageId), {
    customBackgroundUrl: base64Url
  }, { merge: true });
  return base64Url;
}

async function getCustomBackground(villageId) {
  const docRef = doc(db, "village_settings", villageId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().customBackgroundUrl) {
    return docSnap.data().customBackgroundUrl;
  }
  return null;
}

async function clearCustomBackground(villageId) {
  const docRef = doc(db, "village_settings", villageId);
  await setDoc(docRef, { customBackgroundUrl: null }, { merge: true });
}

const bgUploadInput = document.getElementById('bg-upload-input');
const btnResetBg = document.getElementById('btn-reset-bg');

if (bgUploadInput) {
  bgUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      bgUploadInput.disabled = true; // prevent multiple clicks
      try {
        const url = await saveCustomBackground(currentVillageId, file);
        window.customBgUrl = url;
        if (map && map.getSource('village-image')) {
          map.getSource('village-image').updateImage({ url: url });
        }
        if (btnResetBg) btnResetBg.disabled = false;
      } catch (e) {
        console.error("Error saving background", e);
        alert("Failed to upload background. Make sure you are logged in.");
      } finally {
        bgUploadInput.disabled = false;
      }
    }
  });
}

if (btnResetBg) {
  btnResetBg.addEventListener('click', async () => {
    btnResetBg.disabled = true;
    try {
      await clearCustomBackground(currentVillageId);
      window.customBgUrl = null;
      bgUploadInput.value = '';
      if (map && map.getSource('village-image')) {
        map.getSource('village-image').updateImage({ url: villageConfig[currentVillageId].imageOverlayUrl });
      }
    } catch (e) {
      console.error("Error clearing background", e);
      btnResetBg.disabled = false; // re-enable if failed
    }
  });
}

// Start app after all declarations are hoisted and initialized
startup();
