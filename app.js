// Initialize Lucide Icons on load
if (window.lucide) {
  window.lucide.createIcons();
}

// Global Application State
let map = null;
let mapboxToken = localStorage.getItem('mapbox_access_token') || '';
const baskhediCenter = [75.2644, 24.2589]; // [longitude, latitude] for Mapbox

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

// --- TOKEN MANAGEMENT ---

function initTokenState() {
  if (mapboxToken) {
    tokenInput.value = mapboxToken;
    if (tokenInputModal) tokenInputModal.value = mapboxToken;
    tokenOverlay.classList.add('hidden');
    tokenConfigDetails.removeAttribute('open'); // close the panel to save space
    initializeMap();
  } else {
    tokenOverlay.classList.remove('hidden');
    tokenConfigDetails.setAttribute('open', '');
  }
}

// Function to handle saving token
function saveToken(token) {
  if (token) {
    localStorage.setItem('mapbox_access_token', token);
    mapboxToken = token;
    tokenOverlay.classList.add('hidden');
    tokenConfigDetails.removeAttribute('open');
    
    // Reload page or re-initialize map
    if (map) {
      window.location.reload();
    } else {
      initializeMap();
    }
  } else {
    alert("Please enter a valid Mapbox Access Token.");
  }
}

saveTokenBtn.addEventListener('click', () => {
  saveToken(tokenInput.value.trim());
});

if (saveTokenBtnModal) {
  saveTokenBtnModal.addEventListener('click', () => {
    saveToken(tokenInputModal.value.trim());
  });
}

// --- MAP INITIALIZATION ---

function initializeMap() {
  if (map) return; // already initialized
  
  mapboxgl.accessToken = mapboxToken;
  
  try {
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11', // Sleek premium dark mode
      center: baskhediCenter,
      zoom: 15.5,
      pitch: 30, // Slight tilt for 3D depth
      bearing: 0
    });
    
    // Add standard controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    
    // Add layers and sources when map loads
    map.on('load', onMapLoad);
    
    // Handle Map click to route
    map.on('click', onMapClick);
    
  } catch (error) {
    console.error("Mapbox initialization error:", error);
    alert("Failed to initialize Mapbox. Please check your Access Token or internet connection.");
  }
}

// --- DATA LAYER LOADING ---

function onMapLoad() {
  console.log("[Mapbox] Loading Baskhedi georeferenced GeoJSON data...");
  
  // 1. Add Image Source from the hand-drawn digitized map
  map.addSource('baskhedi-image', {
    type: 'image',
    url: './google_maps_baskhedi.png',
    coordinates: [
      [75.2595, 24.2634], // Top Left
      [75.2693, 24.2634], // Top Right
      [75.2693, 24.2544], // Bottom Right
      [75.2595, 24.2544]  // Bottom Left
    ]
  });

  // 1b. Add Raster Layer to display the image
  map.addLayer({
    id: 'baskhedi-raster',
    type: 'raster',
    source: 'baskhedi-image',
    paint: {
      'raster-opacity': 1.0,
      'raster-fade-duration': 0
    }
  });

  // 2. Add Source from local geojson served by Vite
  map.addSource('baskhedi-features', {
    type: 'geojson',
    data: './baskhedi_georeferenced.geojson'
  });
  
  // 3. Add Road Network Layer
  map.addLayer({
    id: 'roads-line',
    type: 'line',
    source: 'baskhedi-features',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': '#F2C84B', // Google Maps Yellow
      'line-width': 4.5,
      'line-opacity': 0.85
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    }
  });

  // Highlight road layer hover effect
  map.addLayer({
    id: 'roads-line-hover',
    type: 'line',
    source: 'baskhedi-features',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': '#E5B82B', // Darker yellow on hover
      'line-width': 8,
      'line-opacity': 0.0
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    }
  });
  
  // 3. Load and render POI HTML markers with icons matching the village legend
  fetch('./baskhedi_georeferenced.geojson')
    .then(response => response.json())
    .then(data => {
      // Build the topological routing graph in the browser
      buildRoutingGraph(data);
      
      data.features.forEach(feature => {
        if (feature.geometry && feature.geometry.type === 'Point') {
          const coords = feature.geometry.coordinates;
          const props = feature.properties || {};
          
          // Create custom HTML element for marker styling
          const el = document.createElement('div');
          el.className = `map-poi-marker ${props.type || 'poi'}`;
          
          // Match legends in the original image to Lucide icons
          let iconName = 'map-pin';
          if (props.type === 'school') iconName = 'graduation-cap';
          else if (props.type === 'temple') iconName = 'shrub'; // Representing Indian shrine/tree elements
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
          
          // Add marker to map
          const marker = new mapboxgl.Marker({
            element: el,
            anchor: 'bottom'
          })
          .setLngLat(coords)
          .addTo(map);

          // Setup Popup with Routing Options
          const popup = new mapboxgl.Popup({ offset: [0, -27], closeButton: true, className: 'poi-popup' });
          
          el.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent map click from triggering
            
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
              
            // Re-render Lucide icons in the popup
            if (window.lucide) {
              window.lucide.createIcons();
            }

            // Bind click events inside popup (using timeout to guarantee render in DOM)
            setTimeout(() => {
              const btnStart = document.querySelector('.btn-route-start');
              const btnEnd = document.querySelector('.btn-route-end');
              
              if (btnStart) {
                btnStart.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  setStartEndpoint(coords[0], coords[1]);
                  popup.remove();
                });
              }
              if (btnEnd) {
                btnEnd.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  setEndEndpoint(coords[0], coords[1]);
                  popup.remove();
                });
              }
            }, 50);
          });
        }
      });
      
      // Update Lucide SVG icons within newly loaded HTML markers
      if (window.lucide) {
        window.lucide.createIcons();
      }
    })
    .catch(err => console.error("Error loading georeferenced POIs:", err));
  
  // 4. Initialize empty route source for navigation path
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });
  
  // Add navigation route rendering layer
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#06b6d4', // Cyan neon route line
      'line-width': 7,
      'line-opacity': 0.95
    }
  });
}

// --- CLICK TO ROUTE LOGIC ---

function setStartEndpoint(lng, lat) {
  // If we already had a complete route, clear it first
  if (startCoords && endCoords) {
    clearRoute();
  }
  
  startCoords = { lng, lat };
  coordsStartDisplay.innerText = `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  
  if (startMarker) startMarker.remove();
  
  const el = document.createElement('div');
  el.className = 'custom-marker start';
  startMarker = new mapboxgl.Marker(el)
    .setLngLat([lng, lat])
    .addTo(map);
    
  clearRouteBtn.classList.remove('disabled');
  clearRouteBtn.removeAttribute('disabled');
  
  if (endCoords) {
    fetchShortestRoute();
  }
}

function setEndEndpoint(lng, lat) {
  if (!startCoords) {
    alert("Please select a starting point first.");
    return;
  }
  
  endCoords = { lng, lat };
  coordsEndDisplay.innerText = `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  
  if (endMarker) endMarker.remove();
  
  const el = document.createElement('div');
  el.className = 'custom-marker end';
  endMarker = new mapboxgl.Marker(el)
    .setLngLat([lng, lat])
    .addTo(map);
    
  fetchShortestRoute();
}

function onMapClick(e) {
  // If clicked directly on a POI popup, don't trigger routing clicks
  if (e.originalEvent.target.closest('.mapboxgl-popup')) return;
  
  const coords = e.lngLat;
  
  if (!startCoords) {
    setStartEndpoint(coords.lng, coords.lat);
  } else if (!endCoords) {
    setEndEndpoint(coords.lng, coords.lat);
  } else {
    // Reset and start new route selection
    setStartEndpoint(coords.lng, coords.lat);
  }
}

// --- CLIENT-SIDE ROUTE CALCULATION ---

function fetchShortestRoute() {
  if (!startCoords || !endCoords) return;
  
  console.log(`[JS Router] Calculating route: Start(${startCoords.lat}, ${startCoords.lng}) -> End(${endCoords.lat}, ${endCoords.lng})`);
  
  // Find the closest snapped nodes on the road network
  const startSnap = findNearestNode(startCoords.lng, startCoords.lat);
  const endSnap = findNearestNode(endCoords.lng, endCoords.lat);
  
  if (!startSnap.node || !endSnap.node) {
    alert("Could not map coordinates to the road network.");
    return;
  }
  
  // Snapping distance threshold
  const maxSnapDist = 500.0; // meters
  if (startSnap.distance > maxSnapDist) {
    alert(`Start location is too far from the nearest road segment (${startSnap.distance.toFixed(1)}m > max ${maxSnapDist}m).`);
    clearRoute();
    return;
  }
  if (endSnap.distance > maxSnapDist) {
    alert(`Destination is too far from the nearest road segment (${endSnap.distance.toFixed(1)}m > max ${maxSnapDist}m).`);
    clearRoute();
    return;
  }
  
  // Solve shortest path using client-side Dijkstra
  const result = solveDijkstra(startSnap.node, endSnap.node);
  
  if (result) {
    // Construct standard GeoJSON LineString Feature response matching backend schema
    const routeGeoJSON = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: result.path
      },
      properties: {
        distance_meters: result.distance,
        snapped_start: {
          distance_meters: startSnap.distance,
          node_coordinates: startSnap.node
        },
        snapped_end: {
          distance_meters: endSnap.distance,
          node_coordinates: endSnap.node
        }
      }
    };
    displayRoute(routeGeoJSON);
  } else {
    alert("No route exists between these two points (road segments are disconnected).");
    if (endMarker) {
      endMarker.remove();
      endMarker = null;
    }
    endCoords = null;
    coordsEndDisplay.innerText = "Not selected";
  }
}

// --- DISPLAY CALCULATED ROUTE ---

function displayRoute(routeGeoJSON) {
  if (!map) return;
  
  // 1. Update the route source on the map
  map.getSource('route').setData(routeGeoJSON);
  
  // 2. Read properties
  const props = routeGeoJSON.properties;
  const dist = props.distance_meters;
  const snapStart = props.snapped_start.distance_meters;
  const snapEnd = props.snapped_end.distance_meters;
  
  // 3. Update stats UI
  routeDistanceDisplay.innerText = `${dist.toLocaleString()} meters (${(dist / 1000).toFixed(2)} km)`;
  snapStartDisplay.innerText = `${snapStart.toFixed(1)}m`;
  snapEndDisplay.innerText = `${snapEnd.toFixed(1)}m`;
  routeStatsContainer.classList.remove('hidden');
  
  // 4. Fit map bounds to show entire route path
  const coordinates = routeGeoJSON.geometry.coordinates;
  const bounds = new mapboxgl.LngLatBounds();
  
  coordinates.forEach(coord => {
    bounds.extend(coord);
  });
  
  map.fitBounds(bounds, {
    padding: 80, // pixels padding
    maxZoom: 17,
    duration: 1000 // anim duration in ms
  });
}

// --- RESET STATE ---

function clearRoute() {
  // Reset Coordinates
  startCoords = null;
  endCoords = null;
  
  // Remove markers
  if (startMarker) {
    startMarker.remove();
    startMarker = null;
  }
  if (endMarker) {
    endMarker.remove();
    endMarker = null;
  }
  
  // Reset Map route layer source
  if (map && map.getSource('route')) {
    map.getSource('route').setData({
      type: 'FeatureCollection',
      features: []
    });
  }
  
  // Reset UI
  coordsStartDisplay.innerText = "Not selected";
  coordsEndDisplay.innerText = "Not selected";
  routeStatsContainer.classList.add('hidden');
  
  clearRouteBtn.classList.add('disabled');
  clearRouteBtn.setAttribute('disabled', '');
  
  console.log("[Mapbox] Route cleared.");
}

clearRouteBtn.addEventListener('click', clearRoute);

// --- ROUTING ENGINE HELPER FUNCTIONS ---

function haversineDistance(c1, c2) {
  const lon1 = c1[0], lat1 = c1[1];
  const lon2 = c2[0], lat2 = c2[1];
  const R = 6371000.0; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function buildRoutingGraph(geojson) {
  // Clear previous state
  for (const key in routingGraph) delete routingGraph[key];
  uniqueNodes.length = 0;
  
  // Snap coordinates within tolerance to resolve gaps
  function getSnappedNode(coords) {
    for (const node of uniqueNodes) {
      if (haversineDistance(coords, node) <= SNAPPING_TOLERANCE_METERS) {
        return node;
      }
    }
    uniqueNodes.push(coords);
    return coords;
  }
  
  // Filter all road LineStrings
  const lineStrings = geojson.features.filter(f => f.geometry && f.geometry.type === 'LineString');
  
  lineStrings.forEach(feature => {
    const coords = feature.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = getSnappedNode(coords[i]);
      const p2 = getSnappedNode(coords[i+1]);
      
      const p1Key = p1.join(',');
      const p2Key = p2.join(',');
      
      if (p1Key !== p2Key) {
        const dist = haversineDistance(p1, p2);
        
        if (!routingGraph[p1Key]) routingGraph[p1Key] = [];
        if (!routingGraph[p2Key]) routingGraph[p2Key] = [];
        
        routingGraph[p1Key].push({ node: p2, weight: dist });
        routingGraph[p2Key].push({ node: p1, weight: dist });
      }
    }
  });
  
  console.log(`[JS Router] Graph built: ${uniqueNodes.length} nodes, Snapping: ${SNAPPING_TOLERANCE_METERS}m.`);
}

function findNearestNode(lng, lat) {
  let nearestNode = null;
  let minDist = Infinity;
  uniqueNodes.forEach(node => {
    const dist = haversineDistance([lng, lat], node);
    if (dist < minDist) {
      minDist = dist;
      nearestNode = node;
    }
  });
  return { node: nearestNode, distance: minDist };
}

function solveDijkstra(startNode, endNode) {
  const startKey = startNode.join(',');
  const endKey = endNode.join(',');
  
  const distances = {};
  const previous = {};
  const queue = new Set();
  
  uniqueNodes.forEach(node => {
    const key = node.join(',');
    distances[key] = Infinity;
    previous[key] = null;
    queue.add(key);
  });
  
  distances[startKey] = 0;
  
  while (queue.size > 0) {
    // Find node with minimum distance
    let minNodeKey = null;
    let minDistance = Infinity;
    queue.forEach(key => {
      if (distances[key] < minDistance) {
        minDistance = distances[key];
        minNodeKey = key;
      }
    });
    
    if (minNodeKey === null || minNodeKey === endKey) {
      break;
    }
    
    queue.delete(minNodeKey);
    
    const neighbors = routingGraph[minNodeKey] || [];
    neighbors.forEach(neighbor => {
      const neighborKey = neighbor.node.join(',');
      if (!queue.has(neighborKey)) return;
      
      const alt = distances[minNodeKey] + neighbor.weight;
      if (alt < distances[neighborKey]) {
        distances[neighborKey] = alt;
        previous[neighborKey] = minNodeKey;
      }
    });
  }
  
  // Reconstruct path
  const path = [];
  let currentKey = endKey;
  if (previous[currentKey] !== null || currentKey === startKey) {
    while (currentKey !== null) {
      const coords = currentKey.split(',').map(Number);
      path.unshift(coords);
      currentKey = previous[currentKey];
    }
    return {
      path,
      distance: distances[endKey]
    };
  }
  return null;
}

// Initialize token state on startup
initTokenState();
