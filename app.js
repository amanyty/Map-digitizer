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
const baskhediCenter = [75.2644, 24.2589]; // [longitude, latitude] for Mapbox

let currentGeoJSON = { type: 'FeatureCollection', features: [] };
let draw = null;
let isEditMode = false;
const markers = {}; // HTML markers

// Routing coordinates state
let startCoords = null; // {lng, lat}
let endCoords = null;   // {lng, lat}
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
const authModal = document.getElementById('auth-modal');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnSubmitAuth = document.getElementById('btn-submit-auth');
const btnCancelAuth = document.getElementById('btn-cancel-auth');
const authError = document.getElementById('auth-error');

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

btnCancelAuth.addEventListener('click', () => {
  authModal.classList.add('hidden');
});

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

function enableEditMode() {
  isEditMode = true;
  if (!map) return;
  
  if (!draw) {
    draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { point: true, line_string: true, polygon: true, trash: true }
    });
  }
  map.addControl(draw);
  draw.set(currentGeoJSON);
  
  map.on('draw.create', syncDrawToFirestore);
  map.on('draw.update', syncDrawToFirestore);
  map.on('draw.delete', deleteFromFirestore);
}

function disableEditMode() {
  isEditMode = false;
  if (map && draw) {
    map.removeControl(draw);
    map.off('draw.create', syncDrawToFirestore);
    map.off('draw.update', syncDrawToFirestore);
    map.off('draw.delete', deleteFromFirestore);
  }
}

async function syncDrawToFirestore(e) {
  const features = e.features;
  for (const f of features) {
     const docId = f.id || doc(collection(db, 'features')).id;
     f.id = docId;
     
     const data = JSON.parse(JSON.stringify(f));
     data.geometry.coordinates = JSON.stringify(data.geometry.coordinates);
     
     await setDoc(doc(db, 'features', docId), data);
  }
}

async function deleteFromFirestore(e) {
  const features = e.features;
  for (const f of features) {
     if (f.id) {
       await deleteDoc(doc(db, 'features', f.id));
     }
  }
}

// --- TOKEN MANAGEMENT ---
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
    
    if (map) {
      window.location.reload();
    } else {
      initializeMap();
    }
  } else {
    alert("Please enter a valid Mapbox Access Token.");
  }
}

saveTokenBtn.addEventListener('click', () => saveToken(tokenInput.value.trim()));
if (saveTokenBtnModal) {
  saveTokenBtnModal.addEventListener('click', () => saveToken(tokenInputModal.value.trim()));
}

// --- MAP INITIALIZATION ---
function initializeMap() {
  if (map) return;
  mapboxgl.accessToken = mapboxToken;
  
  try {
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: baskhediCenter,
      zoom: 15.5,
      pitch: 30,
      bearing: 0
    });
    
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    
    map.on('load', onMapLoad);
    map.on('click', onMapClick);
    
  } catch (error) {
    console.error("Mapbox initialization error:", error);
    alert("Failed to initialize Mapbox.");
  }
}

// --- DATA LAYER LOADING (FIRESTORE) ---
function onMapLoad() {
  console.log("[Mapbox] Loading Baskhedi georeferenced GeoJSON data...");
  
  map.addSource('baskhedi-image', {
    type: 'image',
    url: './google_maps_baskhedi.png',
    coordinates: [
      [75.2595, 24.2634],
      [75.2693, 24.2634],
      [75.2693, 24.2544],
      [75.2595, 24.2544]
    ]
  });

  map.addLayer({
    id: 'baskhedi-raster',
    type: 'raster',
    source: 'baskhedi-image',
    paint: { 'raster-opacity': 1.0, 'raster-fade-duration': 0 }
  });

  map.addSource('baskhedi-features', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  
  map.addLayer({
    id: 'roads-line',
    type: 'line',
    source: 'baskhedi-features',
    filter: ['==', '$type', 'LineString'],
    paint: { 'line-color': '#F2C84B', 'line-width': 4.5, 'line-opacity': 0.85 },
    layout: { 'line-join': 'round', 'line-cap': 'round' }
  });

  map.addLayer({
    id: 'roads-line-hover',
    type: 'line',
    source: 'baskhedi-features',
    filter: ['==', '$type', 'LineString'],
    paint: { 'line-color': '#E5B82B', 'line-width': 8, 'line-opacity': 0.0 },
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

  if (isEditMode) enableEditMode();

  loadFirestoreData();
}

function loadFirestoreData() {
  onSnapshot(collection(db, 'features'), (snapshot) => {
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
       draw.set(currentGeoJSON);
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
        
        let iconName = 'map-pin';
        if (props.type === 'school') iconName = 'graduation-cap';
        else if (props.type === 'temple') iconName = 'shrub';
        else if (props.type === 'church') iconName = 'church';
        else if (props.type === 'shop') iconName = 'shopping-bag';
        else if (props.type === 'house') iconName = 'home';
        else if (props.type === 'landmark') iconName = 'flag';
        
        el.innerHTML = `
          <div class="poi-icon-wrapper" title="${props.name || props.type || 'POI'}">
            <i data-lucide="${iconName}"></i>
          </div>
          ${props.name ? `
            <div class="poi-label-container">
              <span class="poi-label-text">${props.name}</span>
            </div>
          ` : ''}
        `;
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(coords)
          .addTo(map);

        const popup = new mapboxgl.Popup({ offset: [0, -27], closeButton: true, className: 'poi-popup' });
        
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.setLngLat(coords)
            .setHTML(`
              <div class="popup-title">${props.name || 'Unnamed Point'}</div>
              <div class="popup-type">${props.type || 'POI'}</div>
              ${props.description ? `<div class="popup-desc">${props.description}</div>` : ''}
              <div class="popup-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-xs btn-route-start" style="padding: 4px 8px; font-size: 10px; border-radius: 4px; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                  <i data-lucide="flag" style="width: 12px; height: 12px;"></i> Start Here
                </button>
                <button class="btn btn-primary btn-xs btn-route-end" style="padding: 4px 8px; font-size: 10px; border-radius: 4px; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                  <i data-lucide="navigation" style="width: 12px; height: 12px;"></i> End Here
                </button>
              </div>
            `)
            .addTo(map);
            
          if (window.lucide) window.lucide.createIcons();
          setTimeout(() => {
            const btnStart = document.querySelector('.btn-route-start');
            const btnEnd = document.querySelector('.btn-route-end');
            if (btnStart) btnStart.addEventListener('click', (ev) => { ev.stopPropagation(); setStartEndpoint(coords[0], coords[1]); popup.remove(); });
            if (btnEnd) btnEnd.addEventListener('click', (ev) => { ev.stopPropagation(); setEndEndpoint(coords[0], coords[1]); popup.remove(); });
          }, 50);
        });
        
        markers[feature.id] = { marker, el, props };
      } else {
        markers[feature.id].marker.setLngLat(coords);
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

// --- CLICK TO ROUTE LOGIC ---
function setStartEndpoint(lng, lat) {
  if (startCoords && endCoords) clearRoute();
  
  startCoords = { lng, lat };
  coordsStartDisplay.innerText = `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  
  if (startMarker) startMarker.remove();
  const el = document.createElement('div');
  el.className = 'custom-marker start';
  startMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
    
  clearRouteBtn.classList.remove('disabled');
  clearRouteBtn.removeAttribute('disabled');
  
  if (endCoords) fetchShortestRoute();
}

function setEndEndpoint(lng, lat) {
  if (!startCoords) { alert("Please select a starting point first."); return; }
  
  endCoords = { lng, lat };
  coordsEndDisplay.innerText = `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  
  if (endMarker) endMarker.remove();
  const el = document.createElement('div');
  el.className = 'custom-marker end';
  endMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
    
  fetchShortestRoute();
}

function onMapClick(e) {
  if (e.originalEvent.target.closest('.mapboxgl-popup')) return;
  if (isEditMode) return; // Prevent routing clicks in edit mode
  
  const coords = e.lngLat;
  if (!startCoords) setStartEndpoint(coords.lng, coords.lat);
  else if (!endCoords) setEndEndpoint(coords.lng, coords.lat);
  else setStartEndpoint(coords.lng, coords.lat);
}

// --- CLIENT-SIDE ROUTE CALCULATION ---
function fetchShortestRoute() {
  if (!startCoords || !endCoords) return;
  
  const startSnap = findNearestNode(startCoords.lng, startCoords.lat);
  const endSnap = findNearestNode(endCoords.lng, endCoords.lat);
  
  if (!startSnap.node || !endSnap.node) { alert("Could not map coordinates to the road network."); return; }
  
  const maxSnapDist = 500.0;
  if (startSnap.distance > maxSnapDist) { alert(`Start location too far (${startSnap.distance.toFixed(1)}m).`); clearRoute(); return; }
  if (endSnap.distance > maxSnapDist) { alert(`Destination too far (${endSnap.distance.toFixed(1)}m).`); clearRoute(); return; }
  
  const result = solveDijkstra(startSnap.node, endSnap.node);
  
  if (result) {
    const routeGeoJSON = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: result.path },
      properties: {
        distance_meters: result.distance,
        snapped_start: { distance_meters: startSnap.distance, node_coordinates: startSnap.node },
        snapped_end: { distance_meters: endSnap.distance, node_coordinates: endSnap.node }
      }
    };
    displayRoute(routeGeoJSON);
  } else {
    alert("No route exists between these two points.");
    if (endMarker) { endMarker.remove(); endMarker = null; }
    endCoords = null;
    coordsEndDisplay.innerText = "Not selected";
  }
}

function displayRoute(routeGeoJSON) {
  if (!map) return;
  map.getSource('route').setData(routeGeoJSON);
  
  const props = routeGeoJSON.properties;
  routeDistanceDisplay.innerText = `${props.distance_meters.toLocaleString()} meters (${(props.distance_meters / 1000).toFixed(2)} km)`;
  snapStartDisplay.innerText = `${props.snapped_start.distance_meters.toFixed(1)}m`;
  snapEndDisplay.innerText = `${props.snapped_end.distance_meters.toFixed(1)}m`;
  routeStatsContainer.classList.remove('hidden');
  
  const bounds = new mapboxgl.LngLatBounds();
  routeGeoJSON.geometry.coordinates.forEach(c => bounds.extend(c));
  map.fitBounds(bounds, { padding: 80, maxZoom: 17, duration: 1000 });
}

function clearRoute() {
  startCoords = null;
  endCoords = null;
  if (startMarker) { startMarker.remove(); startMarker = null; }
  if (endMarker) { endMarker.remove(); endMarker = null; }
  if (map && map.getSource('route')) map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
  coordsStartDisplay.innerText = "Not selected";
  coordsEndDisplay.innerText = "Not selected";
  routeStatsContainer.classList.add('hidden');
  clearRouteBtn.classList.add('disabled');
  clearRouteBtn.setAttribute('disabled', '');
}
clearRouteBtn.addEventListener('click', clearRoute);

// --- ROUTING ENGINE HELPER FUNCTIONS ---
function haversineDistance(c1, c2) {
  const R = 6371000.0, dLat = (c2[1]-c1[1])*Math.PI/180, dLon = (c2[0]-c1[0])*Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(c1[1]*Math.PI/180)*Math.cos(c2[1]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildRoutingGraph(geojson) {
  for (const key in routingGraph) delete routingGraph[key];
  uniqueNodes.length = 0;
  
  function getSnappedNode(coords) {
    for (const node of uniqueNodes) {
      if (haversineDistance(coords, node) <= SNAPPING_TOLERANCE_METERS) return node;
    }
    uniqueNodes.push(coords);
    return coords;
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
  uniqueNodes.forEach(node => {
    const d = haversineDistance([lng, lat], node);
    if (d < md) { md = d; nn = node; }
  });
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
