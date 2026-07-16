import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

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
const villageConfig = {
  baskhedi: {
    name: "Baskhedi",
    center: [75.2644, 24.2589],
    imageOverlayUrl: "/baskhedi_ultra.png?v=9",
    imageCoordinates: [
      [75.2595, 24.2634], // top-left
      [75.2693, 24.2634], // top-right
      [75.2693, 24.2544], // bottom-right
      [75.2595, 24.2544]  // bottom-left
    ],
    firestoreCollection: "features"
  },
  village2: {
    name: "Junapani (Map 2)",
    center: [74.6942, 21.6899],
    imageOverlayUrl: "/map2_enhanced.jpeg?v=3", 
    imageCoordinates: [
      [74.6842, 21.7049], // top-left
      [74.7042, 21.7049], // top-right
      [74.7042, 21.6749], // bottom-right
      [74.6842, 21.6749]  // bottom-left
    ],
    firestoreCollection: "features_village2"
  },
  village3: {
    name: "Map 3",
    center: [75.2644, 24.2589],
    imageOverlayUrl: "/map3.jpeg?v=3",
    imageCoordinates: [
      [75.2544, 24.2671], // top-left
      [75.2744, 24.2671], // top-right
      [75.2744, 24.2506], // bottom-right
      [75.2544, 24.2506]  // bottom-left
    ],
    firestoreCollection: "features_village3"
  }
};

let currentVillageId = localStorage.getItem('current_village_id') || 'baskhedi';

// Update title on load
const villageTitle = document.getElementById('village-title');
if (villageTitle && villageConfig[currentVillageId]) {
  villageTitle.innerText = villageConfig[currentVillageId].name;
}

// Listen to village select dropdown
const villageSelect = document.getElementById('village-select');
if (villageSelect) {
  villageSelect.value = currentVillageId;
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
let activeEditTool = null; // 'house', 'school', 'shop', 'temple', 'church', 'landmark', 'road', 'delete'
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
const toolBtns = document.querySelectorAll('.btn-tool');

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
  
  poiModal.classList.add('hidden');
});

function enableEditMode() {
  isEditMode = true;
  editToolbar.classList.remove('hidden');
  
  if (!map) return;
  
  if (!draw) {
    draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {}
    });
  }
  map.addControl(draw);
  const linesOnly = {
      type: 'FeatureCollection',
      features: currentGeoJSON.features.filter(f => f.geometry && f.geometry.type === 'LineString')
  };
  draw.set(linesOnly);
  
  map.on('draw.create', syncDrawToFirestore);
  map.on('draw.update', syncDrawToFirestore);
  map.on('draw.delete', deleteFromFirestore);
  
  map.on('draw.selectionchange', async (e) => {
    if (isEditMode && activeEditTool === 'delete') {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        if (feature.id) {
          await deleteDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, feature.id));
          draw.delete(feature.id);
        }
      }
    }
  });
  
  // Make all HTML markers draggable
  for (const id in markers) {
    markers[id].marker.setDraggable(true);
  }
}

function disableEditMode() {
  isEditMode = false;
  editToolbar.classList.add('hidden');
  resetActiveTool();
  
  if (map && draw) {
    map.removeControl(draw);
    map.off('draw.create', syncDrawToFirestore);
    map.off('draw.update', syncDrawToFirestore);
    map.off('draw.delete', deleteFromFirestore);
    map.off('draw.selectionchange');
  }
  
  // Make all HTML markers non-draggable
  for (const id in markers) {
    markers[id].marker.setDraggable(false);
  }
}

// --- CUSTOM EDIT TOOLBAR LOGIC ---
toolBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    toolBtns.forEach(b => b.classList.remove('active'));
    
    if (activeEditTool === btn.dataset.type) {
      // Toggle off
      resetActiveTool();
      return;
    }
    
    btn.classList.add('active');
    activeEditTool = btn.dataset.type;
    
    if (['road', 'curved_road', 'canal'].includes(activeEditTool)) {
      editStatusText.innerText = "Click to draw road. Double-click to finish.";
      if (draw) draw.changeMode('draw_line_string');
      map.getCanvas().style.cursor = 'crosshair';
    } else if (activeEditTool === 'delete') {
      editStatusText.innerText = "Click on a POI or road to delete it.";
      if (draw) draw.changeMode('simple_select');
      map.getCanvas().style.cursor = 'no-drop';
    } else {
      editStatusText.innerText = `Click anywhere to place a ${activeEditTool}.`;
      if (draw) draw.changeMode('simple_select');
      map.getCanvas().style.cursor = 'crosshair';
    }
  });
});

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
       f.properties.type = activeEditTool && ['road', 'curved_road', 'canal'].includes(activeEditTool) ? activeEditTool : 'road';
     }
     
     const data = JSON.parse(JSON.stringify(f));
     data.geometry.coordinates = JSON.stringify(data.geometry.coordinates);
     await setDoc(doc(db, villageConfig[currentVillageId].firestoreCollection, docId), data);
  }
  
  if (['road', 'curved_road', 'canal'].includes(activeEditTool)) {
    setTimeout(() => {
      if (draw && ['road', 'curved_road', 'canal'].includes(activeEditTool)) {
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
      pitch: 30,
      bearing: 0
    });
    
    map.on('load', () => {
      // AI Generated stylized map overlay
      const vConfig = villageConfig[currentVillageId];
      if (vConfig.imageOverlayUrl) {
          map.addSource('baskhedi-image', {
            type: 'image',
            url: vConfig.imageOverlayUrl,
            coordinates: vConfig.imageCoordinates
          });
          map.addLayer({
            id: 'baskhedi-overlay',
            type: 'raster',
            source: 'baskhedi-image',
            paint: { 'raster-opacity': 1.0 }
          });
      }



      map.addSource('baskhedi-features', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      

      map.addLayer({
        id: 'roads-line',
        type: 'line',
        source: 'baskhedi-features',
        filter: ['==', '$type', 'LineString'],
        paint: { 
            'line-color': [
                'match',
                ['get', 'type'],
                'canal', '#0ea5e9',
                /* default for road / curved_road */ '#000000'
            ],
            'line-width': 3.5, 
            'line-opacity': 1.0 
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' }
      });

      map.addLayer({
        id: 'roads-line-hover',
        type: 'line',
        source: 'baskhedi-features',
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
          try { data.geometry.coordinates = JSON.parse(data.geometry.coordinates); } catch (e) {}
       }
       data.id = docSnap.id;
       features.push(data);
    });
    
    currentGeoJSON.features = features;
    
    if (map && map.getSource('baskhedi-features')) {
      map.getSource('baskhedi-features').setData(currentGeoJSON);
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

function renderMarkers(features) {
  const incomingIds = new Set();
  
  features.forEach(feature => {
    if (feature.geometry && feature.geometry.type === 'Point') {
      incomingIds.add(feature.id);
      
      const coords = feature.geometry.coordinates;
      const props = feature.properties || {};
      
      if (!markers[feature.id]) {
        const el = document.createElement('div');
        el.className = `map-poi-marker ${props.type || 'poi'}`;
        
                const typeMap = {
          house: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2L2 22h20L12 2z" fill="none" stroke="#ef4444" stroke-width="2"/></svg>',
          empty_house: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 22L2 2h20L12 22z" fill="none" stroke="#ef4444" stroke-width="2"/></svg>',
          house_solid: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2L2 22h20L12 2z" fill="#ef4444"/></svg>',
          empty_house_solid: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 22L2 2h20L12 22z" fill="#ef4444"/></svg>',
          service_provider: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="#eab308"/></svg>',
          temple_mosque: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="white" stroke="black" stroke-width="2"/></svg>',
          school: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="2" y="6" width="20" height="12" fill="#8B4513"/></svg>',
          govt_building: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="2" y="6" width="20" height="12" fill="#d946ef"/></svg>',
          health_center: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="2" y="4" width="20" height="16" fill="white" stroke="black" stroke-width="1"/><path d="M12 7v10M7 12h10" stroke="#22c55e" stroke-width="4"/></svg>',
          tree: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="9" r="7" fill="#22c55e"/><path d="M12 16v6" stroke="#8B4513" stroke-width="3"/></svg>',
          pond: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="none" stroke="#3b82f6" stroke-width="2"/><line x1="5" y1="8" x2="19" y2="8" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2 2"/><line x1="3" y1="12" x2="21" y2="12" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2 2"/><line x1="5" y1="16" x2="19" y2="16" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2 2"/></svg>',
          handpump_working: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 4h8v16H8z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10l5-3" stroke="black" stroke-width="2"/><path d="M6 14h2v6H6z" fill="#3b82f6"/></svg>',
          handpump_broken: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 4h8v16H8z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10l5-3" stroke="black" stroke-width="2"/><path d="M4 14l6 6M10 14l-6 6" stroke="#ef4444" stroke-width="2"/></svg>',
          tap_working: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 10h12v4H4z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10v4h4" fill="none" stroke="black" stroke-width="2"/><circle cx="12" cy="18" r="3" fill="#3b82f6"/></svg>',
          tap_broken: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 10h12v4H4z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10v4h4" fill="none" stroke="black" stroke-width="2"/><path d="M9 16l6 6M15 16l-6 6" stroke="#ef4444" stroke-width="2"/></svg>',
          open_defecation: '<svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7" fill="none" stroke="black" stroke-width="2"/></svg>',
          road: '<svg viewBox="0 0 24 24" width="20" height="20"><line x1="2" y1="10" x2="22" y2="10" stroke="black" stroke-width="2"/><line x1="2" y1="14" x2="22" y2="14" stroke="black" stroke-width="2"/></svg>',
          curved_road: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M2 10 Q12 0 22 10" fill="none" stroke="black" stroke-width="2"/><path d="M2 14 Q12 4 22 14" fill="none" stroke="black" stroke-width="2"/></svg>',
          canal: '<svg viewBox="0 0 24 24" width="20" height="20"><line x1="2" y1="10" x2="22" y2="10" stroke="#0ea5e9" stroke-width="2"/><line x1="2" y1="14" x2="22" y2="14" stroke="#0ea5e9" stroke-width="2"/></svg>',
          water_tank: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6 Q12 2 18 6 v12 Q12 22 6 18 Z" fill="#3b82f6"/></svg>',
          underground_tank: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="6" width="18" height="12" fill="none" stroke="black" stroke-width="2"/><line x1="3" y1="18" x2="21" y2="6" stroke="black" stroke-width="2"/><line x1="3" y1="12" x2="12" y2="6" stroke="black" stroke-width="2"/><line x1="12" y1="18" x2="21" y2="12" stroke="black" stroke-width="2"/></svg>',
          transformer: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="none" stroke="black" stroke-width="2"/><line x1="4" y1="4" x2="20" y2="20" stroke="black" stroke-width="2"/><line x1="20" y1="4" x2="4" y2="20" stroke="black" stroke-width="2"/></svg>',
          solar_panel: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="6" width="18" height="12" fill="none" stroke="black" stroke-width="2"/><line x1="3" y1="12" x2="21" y2="12" stroke="black" stroke-width="1"/><line x1="9" y1="6" x2="9" y2="18" stroke="black" stroke-width="1"/><line x1="15" y1="6" x2="15" y2="18" stroke="black" stroke-width="1"/></svg>',
          power_center: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="none" stroke="black" stroke-width="2"/><line x1="6" y1="6" x2="6" y2="18" stroke="black" stroke-width="1"/><line x1="10" y1="6" x2="10" y2="18" stroke="black" stroke-width="1"/><line x1="14" y1="6" x2="14" y2="18" stroke="black" stroke-width="1"/><line x1="18" y1="6" x2="18" y2="18" stroke="black" stroke-width="1"/></svg>',
          playground: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2"/></svg>',
          well: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="#3b82f6"/><circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2" stroke-dasharray="2 2"/></svg>',
          misc: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="9" fill="#f43f5e"/><text x="12" y="16" font-size="12" font-family="sans-serif" text-anchor="middle" fill="white" font-weight="bold">?</text></svg>'
        };
          let typeToUse = props.type || 'poi';
          // Legacy mappings for existing GeoJSON data
          if (typeToUse === 'shop') typeToUse = 'service_provider';
          if (typeToUse === 'temple' || typeToUse === 'church') typeToUse = 'temple_mosque';
          if (typeToUse === 'landmark') typeToUse = 'govt_building';
          if (typeToUse === 'poi') typeToUse = 'house_solid';

          let iconHtml = typeMap[typeToUse] || '<i data-lucide="map-pin" style="color: #f43f5e"></i>';
          
          let extractColor = '#f43f5e';
          let strokeMatch = iconHtml.match(/stroke="([^"]+)"/);
          let fillMatch = iconHtml.match(/fill="([^"]+)"/);
          
          if (strokeMatch && strokeMatch[1] !== 'none' && strokeMatch[1] !== 'white' && strokeMatch[1] !== 'black') {
              extractColor = strokeMatch[1];
          } else if (fillMatch && fillMatch[1] !== 'none' && fillMatch[1] !== 'white' && fillMatch[1] !== 'black') {
              extractColor = fillMatch[1];
          } else if (strokeMatch && strokeMatch[1] === 'black') {
              extractColor = '#000';
          } else if (fillMatch && fillMatch[1] === 'black') {
              extractColor = '#000';
          }
          
          el.innerHTML = `
          <div class="poi-icon-wrapper" style="color: ${extractColor}; display: flex; flex-direction: column; align-items: center;" title="${props.name || props.type || 'POI'}">
            ${iconHtml}
          </div>
          ${props.name ? `
            <div class="poi-label-container">
              <span class="poi-label-text">${props.name}</span>
            </div>
          ` : ''}
        `;
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', draggable: isEditMode })
          .setLngLat(coords)
          .addTo(map);

        // Handle Marker Drag
        marker.on('dragstart', () => { el.setAttribute('data-dragging', 'true'); });
        marker.on('dragend', async () => {
          setTimeout(() => el.removeAttribute('data-dragging'), 100);
          const lngLat = marker.getLngLat();
          const docId = feature.id;
          const data = JSON.parse(JSON.stringify(feature));
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
          
          popup.setLngLat(marker.getLngLat())
            .setHTML(`
              <div class="popup-title">${props.name || 'Unnamed Point'}</div>
              <div class="popup-type">${props.type || 'POI'}</div>
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
            
            poiNameInput.value = props.name || '';
            poiTypeInput.value = props.type || 'poi';
            
            poiModal.classList.remove('hidden');
            btnDeletePoi.style.display = 'block';
            poiNameInput.focus();
          }
        });
        
        markers[feature.id] = { marker, el, props, feature };
      } else {
        markers[feature.id].marker.setLngLat(coords);
        markers[feature.id].feature = feature; // update reference
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
    if (activeEditTool && !['road', 'curved_road', 'canal', 'delete'].includes(activeEditTool)) {
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
  const R = 6371000.0, dLat = (c2[1]-c1[1])*Math.PI/180, dLon = (c2[0]-c1[0])*Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(c1[1]*Math.PI/180)*Math.cos(c2[1]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
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
      const p1 = getSnappedNode(coords[i]), p2 = getSnappedNode(coords[i+1]);
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

initTokenState();


if (btnPrintMap) {
  btnPrintMap.addEventListener('click', () => {
    if (map) {
      document.body.classList.add('is-printing');
      map.resize();
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('is-printing');
          map.resize();
        }, 500);
      }, 1000);
    } else {
      window.print();
    }
  });
}

