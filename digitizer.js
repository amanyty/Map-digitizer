// Initialize Features Map
const features = new Map();
let selectedLayer = null;

// Map Settings
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 4,
  attributionControl: false
});

// Configure 1000x1000 Pixel Bounds
const bounds = [[0, 0], [1000, 1000]];

// Setup Local Image Overlay
const imageUrl = 'social map of Baskhedi (1)_2.jpg';
const imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);

// Set view and constraints
map.fitBounds(bounds);
map.setMaxBounds(L.latLngBounds(bounds).pad(0.15));

// Initialize Lucide Icons
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
refreshIcons();

// --- GEOMAN DRAWING SETUP ---
// Configure Leaflet-Geoman
map.pm.setLang('en');
map.pm.addControls({
  position: 'topleft',
  drawMarker: false,     // Handled by custom sidebar buttons
  drawCircleMarker: false,
  drawPolyline: false,   // Handled by custom sidebar buttons
  drawRectangle: false,
  drawPolygon: false,
  drawCircle: false,
  drawText: false,
  editMode: false,       // Handled by custom sidebar buttons
  dragMode: false,
  cutPolygon: false,
  removalMode: false     // Handled by custom sidebar buttons
});

// --- HELPER FUNCTIONS ---

// Generate Custom Div Icon for Markers based on Category
function createCustomIcon(type) {
  const safeType = type || 'poi';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="marker-pin ${safeType}"><div class="marker-glow"></div><div class="marker-dot"></div></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

// Get style options for LineStrings (Roads) based on Type
function getLineStyle(type) {
  switch (type) {
    case 'pakka':
      return { color: '#6366f1', weight: 5, opacity: 0.9 }; // Indigo solid thick
    case 'kaccha':
      return { color: '#f59e0b', weight: 3.5, opacity: 0.85, dashArray: '8, 8' }; // Amber dashed
    case 'road':
    default:
      return { color: '#3b82f6', weight: 3, opacity: 0.8 }; // Blue medium
  }
}

// Apply Styles to Layer based on its Properties
function updateLayerStyle(layer) {
  const props = layer.feature.properties;
  if (layer instanceof L.Marker) {
    layer.setIcon(createCustomIcon(props.type));
  } else if (layer instanceof L.Polyline) {
    layer.setStyle(getLineStyle(props.type));
  }
}

// Update the Statistics Display
function updateStats() {
  let roadsCount = 0;
  let poisCount = 0;

  features.forEach((layer) => {
    const type = layer.feature.properties.type;
    if (['road', 'pakka', 'kaccha'].includes(type)) {
      roadsCount++;
    } else if (['school', 'temple', 'church', 'house', 'landmark', 'shop', 'poi'].includes(type)) {
      poisCount++;
    }
  });

  document.getElementById('stat-roads').innerText = roadsCount;
  document.getElementById('stat-pois').innerText = poisCount;
}

// Update the Sidebar Features List
function updateFeaturesList() {
  const listContainer = document.getElementById('features-list');
  listContainer.innerHTML = '';

  if (features.size === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="info" class="info-icon"></i>
        <p>No features drawn yet. Draw a Road Line or POI Marker on the map.</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  features.forEach((layer, id) => {
    const props = layer.feature.properties;
    const isMarker = layer instanceof L.Marker;
    
    // Choose appropriate badge icon & class
    let badgeClass = props.type || 'poi';
    let iconName = 'map-pin';
    
    if (!isMarker) {
      badgeClass = props.type || 'road';
      if (props.type === 'pakka') iconName = 'route';
      else if (props.type === 'kaccha') iconName = 'milestone';
      else iconName = 'git-commit';
    } else {
      if (props.type === 'school') iconName = 'graduation-cap';
      else if (props.type === 'temple') iconName = 'landmark';
      else if (props.type === 'church') iconName = 'church';
      else if (props.type === 'house') iconName = 'home';
      else if (props.type === 'landmark') iconName = 'flag';
      else if (props.type === 'shop') iconName = 'shopping-bag';
    }

    const item = document.createElement('div');
    item.className = `feature-item ${selectedLayer === layer ? 'selected' : ''}`;
    item.dataset.id = id;
    
    item.innerHTML = `
      <div class="feature-info">
        <div class="feature-badge ${badgeClass}">
          <i data-lucide="${iconName}" style="width: 14px; height: 14px;"></i>
        </div>
        <div class="feature-details">
          <span class="feature-name-text">${props.name || 'Unnamed Feature'}</span>
          <span class="feature-type-text">${props.type}</span>
        </div>
      </div>
      <div class="feature-actions">
        <button class="btn-icon locate-btn" title="Center on map">
          <i data-lucide="crosshair" style="width: 14px; height: 14px;"></i>
        </button>
        <button class="btn-icon delete-btn delete" title="Delete feature">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    `;

    // Click on item selects it
    item.addEventListener('click', (e) => {
      // If delete button or locate button was clicked, don't trigger select
      if (e.target.closest('.delete-btn') || e.target.closest('.locate-btn')) return;
      selectFeature(layer);
    });

    // Locate action
    item.querySelector('.locate-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (isMarker) {
        map.setView(layer.getLatLng(), Math.max(map.getZoom(), 2));
      } else {
        map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 3 });
      }
      selectFeature(layer);
    });

    // Delete action
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      map.removeLayer(layer);
    });

    listContainer.appendChild(item);
  });

  refreshIcons();
}

// Update both list, stats, and map bindings
function updateUI() {
  updateStats();
  updateFeaturesList();
}

// Select a feature to edit its properties
function selectFeature(layer) {
  // Deselect previous
  if (selectedLayer) {
    if (selectedLayer.getElement()) {
      selectedLayer.getElement().classList.remove('selected');
    }
  }

  selectedLayer = layer;
  if (layer.getElement()) {
    layer.getElement().classList.add('selected');
  }

  // Open property editor card
  const editor = document.getElementById('feature-editor');
  editor.classList.remove('hidden');

  const typeSelect = document.getElementById('feat-type');
  typeSelect.innerHTML = '';

  const isMarker = layer instanceof L.Marker;
  const props = layer.feature.properties;

  if (isMarker) {
    typeSelect.innerHTML = `
      <option value="school">School (POI)</option>
      <option value="temple">Temple (POI)</option>
      <option value="church">Church (POI)</option>
      <option value="house">House (POI)</option>
      <option value="landmark">Landmark (POI)</option>
      <option value="shop">Shop (POI)</option>
      <option value="poi">Other POI</option>
    `;
  } else {
    typeSelect.innerHTML = `
      <option value="pakka">Pakka Road</option>
      <option value="kaccha">Kaccha Road</option>
      <option value="road">Other Road</option>
    `;
  }

  typeSelect.value = props.type;
  document.getElementById('feat-name').value = props.name || '';
  document.getElementById('feat-description').value = props.description || '';

  // Highlight list item
  document.querySelectorAll('.feature-item').forEach((item) => {
    item.classList.remove('selected');
    if (item.dataset.id === layer.featureId) {
      item.classList.add('selected');
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// Close the property editor
function closeEditor() {
  if (selectedLayer && selectedLayer.getElement()) {
    selectedLayer.getElement().classList.remove('selected');
  }
  selectedLayer = null;
  document.getElementById('feature-editor').classList.add('hidden');
  document.querySelectorAll('.feature-item').forEach((item) => item.classList.remove('selected'));
}

// --- EVENT HANDLERS & LISTENERS ---

// Map Coordinates Tracking
map.on('mousemove', (e) => {
  document.getElementById('coord-x').innerText = Math.round(e.latlng.lng);
  document.getElementById('coord-y').innerText = Math.round(e.latlng.lat);
});

// Layer Creation Listener
map.on('pm:create', (e) => {
  const { layer, shape } = e;
  const featureId = 'feat-' + Date.now();
  
  layer.featureId = featureId;
  const isMarker = shape === 'Marker';

  // Read template type and custom name from dropdowns
  let type = 'poi';
  let name = 'New Feature';
  const customDefaultName = document.getElementById('active-feature-name').value.trim();

  if (isMarker) {
    type = document.getElementById('active-poi-type').value;
    if (customDefaultName) {
      name = customDefaultName;
    } else {
      const typeSelect = document.getElementById('active-poi-type');
      const selectedText = typeSelect.options[typeSelect.selectedIndex].text;
      name = `New ${selectedText}`;
    }
  } else {
    type = document.getElementById('active-road-type').value;
    if (customDefaultName) {
      name = customDefaultName;
    } else {
      const typeSelect = document.getElementById('active-road-type');
      const selectedText = typeSelect.options[typeSelect.selectedIndex].text;
      name = `New ${selectedText}`;
    }
  }

  // Default properties structure
  layer.feature = layer.feature || {
    type: 'Feature',
    properties: {
      id: featureId,
      type: type,
      name: name,
      description: ''
    }
  };

  updateLayerStyle(layer);

  // Bind click event
  layer.on('click', (ev) => {
    L.DomEvent.stopPropagation(ev);
    selectFeature(layer);
  });

  // Listen to edits
  layer.on('pm:edit', () => {
    updateUI();
    saveToLocalStorage();
  });

  // Listen to deletion/removal from map
  layer.on('remove', () => {
    features.delete(layer.featureId);
    if (selectedLayer === layer) {
      closeEditor();
    }
    updateUI();
    saveToLocalStorage();
  });

  // Store in active features collection
  features.set(featureId, layer);
  
  updateUI();
  selectFeature(layer);
  saveToLocalStorage();
});

// Handle custom tool activation and styling
function deactivateAllTools() {
  document.getElementById('tool-road').classList.remove('active');
  document.getElementById('tool-poi').classList.remove('active');
  document.getElementById('tool-edit').classList.remove('active');
  document.getElementById('tool-delete').classList.remove('active');
}

// Custom Draw Road Button
document.getElementById('tool-road').addEventListener('click', () => {
  const wasActive = document.getElementById('tool-road').classList.contains('active');
  deactivateAllTools();
  map.pm.disableDraw();
  map.pm.disableGlobalEditMode();
  map.pm.disableGlobalRemovalMode();

  if (!wasActive) {
    map.pm.enableDraw('Line', {
      snappingOption: true,
      templineStyle: { color: '#3b82f6', weight: 4 },
      hintlineStyle: { color: '#3b82f6', dashArray: '5,5', weight: 4 },
      pathOptions: { color: '#3b82f6', weight: 4 }
    });
    document.getElementById('tool-road').classList.add('active');
  }
});

// Custom Draw POI Button
document.getElementById('tool-poi').addEventListener('click', () => {
  const wasActive = document.getElementById('tool-poi').classList.contains('active');
  deactivateAllTools();
  map.pm.disableDraw();
  map.pm.disableGlobalEditMode();
  map.pm.disableGlobalRemovalMode();

  if (!wasActive) {
    map.pm.enableDraw('Marker');
    document.getElementById('tool-poi').classList.add('active');
  }
});

// Custom Edit Mode Button
document.getElementById('tool-edit').addEventListener('click', () => {
  const wasActive = document.getElementById('tool-edit').classList.contains('active');
  deactivateAllTools();
  map.pm.disableDraw();
  map.pm.disableGlobalRemovalMode();

  if (!wasActive) {
    map.pm.enableGlobalEditMode();
    document.getElementById('tool-edit').classList.add('active');
  } else {
    map.pm.disableGlobalEditMode();
  }
});

// Custom Delete Mode Button
document.getElementById('tool-delete').addEventListener('click', () => {
  const wasActive = document.getElementById('tool-delete').classList.contains('active');
  deactivateAllTools();
  map.pm.disableDraw();
  map.pm.disableGlobalEditMode();

  if (!wasActive) {
    map.pm.enableGlobalRemovalMode();
    document.getElementById('tool-delete').classList.add('active');
  } else {
    map.pm.disableGlobalRemovalMode();
  }
});

// Geoman status synchronization
map.on('pm:drawstart', (e) => {
  deactivateAllTools();
  if (e.shape === 'Line') {
    document.getElementById('tool-road').classList.add('active');
  } else if (e.shape === 'Marker') {
    document.getElementById('tool-poi').classList.add('active');
  }
});

map.on('pm:drawend', () => {
  deactivateAllTools();
});

// Save Properties Event
document.getElementById('editor-save').addEventListener('click', () => {
  if (!selectedLayer) return;

  const props = selectedLayer.feature.properties;
  props.type = document.getElementById('feat-type').value;
  props.name = document.getElementById('feat-name').value.trim() || `Unnamed ${selectedLayer instanceof L.Marker ? 'POI' : 'Road'}`;
  props.description = document.getElementById('feat-description').value.trim();

  // Re-apply style changes
  updateLayerStyle(selectedLayer);
  updateUI();
  saveToLocalStorage();
  
  // Highlight saving with visual feedback
  const saveBtn = document.getElementById('editor-save');
  const oldHTML = saveBtn.innerHTML;
  saveBtn.innerHTML = '<i data-lucide="check"></i> Saved!';
  saveBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  refreshIcons();

  setTimeout(() => {
    saveBtn.innerHTML = oldHTML;
    saveBtn.style.background = '';
    refreshIcons();
  }, 1500);
});

// Close editor card
document.getElementById('editor-close').addEventListener('click', () => {
  closeEditor();
});

// Clear All button
document.getElementById('btn-clear').addEventListener('click', () => {
  if (features.size === 0) return;
  if (confirm('Are you sure you want to clear all digitized layers?')) {
    features.forEach((layer) => {
      map.removeLayer(layer);
    });
    features.clear();
    closeEditor();
    updateUI();
    saveToLocalStorage();
  }
});

// --- EXPORT TO GEOJSON ---
function exportGeoJSON() {
  if (features.size === 0) {
    alert('Please draw some features on the map before exporting.');
    return;
  }

  const featureCollection = {
    type: 'FeatureCollection',
    features: []
  };

  features.forEach((layer) => {
    // Generate valid standard GeoJSON feature
    const geojsonFeature = layer.toGeoJSON();
    
    // Copy the custom properties back explicitly to ensure it is embedded correctly
    geojsonFeature.properties = { ...layer.feature.properties };
    
    // Round pixel coordinates to two decimal places for cleaner files
    if (geojsonFeature.geometry && geojsonFeature.geometry.coordinates) {
      const coords = geojsonFeature.geometry.coordinates;
      if (geojsonFeature.geometry.type === 'Point') {
        geojsonFeature.geometry.coordinates = [
          parseFloat(coords[0].toFixed(2)),
          parseFloat(coords[1].toFixed(2))
        ];
      } else if (geojsonFeature.geometry.type === 'LineString') {
        geojsonFeature.geometry.coordinates = coords.map(c => [
          parseFloat(c[0].toFixed(2)),
          parseFloat(c[1].toFixed(2))
        ]);
      }
    }

    featureCollection.features.push(geojsonFeature);
  });

  const jsonString = JSON.stringify(featureCollection, null, 2);
  
  // Browser download trigger
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'baskhedi_raw_pixels.geojson');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.getElementById('btn-export').addEventListener('click', exportGeoJSON);

// --- LOCAL STORAGE AUTO-SAVE/RESTORE ---

function saveToLocalStorage() {
  const featureCollection = {
    type: 'FeatureCollection',
    features: []
  };

  features.forEach((layer) => {
    const geojsonFeature = layer.toGeoJSON();
    geojsonFeature.properties = { ...layer.feature.properties };
    featureCollection.features.push(geojsonFeature);
  });

  localStorage.setItem('baskhedi_digitizer_save', JSON.stringify(featureCollection));
}

function importGeoJSONData(data, showFeedback = false) {
  // Clear existing
  features.forEach((layer) => map.removeLayer(layer));
  features.clear();
  closeEditor();

  // Add imported layers
  L.geoJSON(data, {
    pointToLayer: (feature, latlng) => {
      const marker = L.marker(latlng);
      marker.feature = feature;
      marker.featureId = feature.properties.id || 'feat-' + Date.now() + Math.random().toString(36).substr(2, 5);
      return marker;
    },
    onEachFeature: (feature, layer) => {
      layer.feature = feature;
      layer.featureId = feature.properties.id || 'feat-' + Date.now() + Math.random().toString(36).substr(2, 5);
      
      layer.feature.properties = layer.feature.properties || {};
      layer.feature.properties.id = layer.featureId;
      
      // Backward compatibility mappings
      let type = layer.feature.properties.type || '';
      if (type === 'highway') type = 'pakka';
      else if (type === 'path') type = 'kaccha';
      
      layer.feature.properties.type = type || (layer instanceof L.Marker ? 'school' : 'pakka');
      layer.feature.properties.name = layer.feature.properties.name || `Imported ${layer instanceof L.Marker ? 'POI' : 'Road'}`;
      layer.feature.properties.description = layer.feature.properties.description || '';

      updateLayerStyle(layer);

      // Click handler
      layer.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        selectFeature(layer);
      });

      // Edits handler
      layer.on('pm:edit', () => {
        updateUI();
        saveToLocalStorage();
      });

      // Remove handler
      layer.on('remove', () => {
        features.delete(layer.featureId);
        if (selectedLayer === layer) {
          closeEditor();
        }
        updateUI();
        saveToLocalStorage();
      });

      features.set(layer.featureId, layer);
    }
  }).addTo(map);

  updateUI();
  saveToLocalStorage();

  if (showFeedback) {
    alert(`Successfully loaded ${features.size} features.`);
  }
}

function loadFromLocalStorage() {
  const savedData = localStorage.getItem('baskhedi_digitizer_save');
  if (!savedData) return;

  try {
    const data = JSON.parse(savedData);
    if (data.type === 'FeatureCollection' && Array.isArray(data.features) && data.features.length > 0) {
      importGeoJSONData(data, false);
    }
  } catch (err) {
    console.error('Error loading saved progress from localStorage:', err);
  }
}

// --- IMPORT GEOJSON ---
document.getElementById('btn-import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        throw new Error('Not a valid GeoJSON FeatureCollection');
      }

      // Confirm override
      if (features.size > 0 && !confirm('Importing will clear your current digitized map. Continue?')) {
        return;
      }

      importGeoJSONData(data, true);
    } catch (err) {
      console.error(err);
      alert('Error parsing GeoJSON. Please ensure the file is valid and contains standard geometry.');
    }
  };

  reader.readAsText(file);
  // Clear file input so same file can be imported again if needed
  e.target.value = '';
});

// Setup map interaction to dismiss selection when clicking empty map areas
map.on('click', () => {
  closeEditor();
});

// Load any auto-saved data from localStorage on startup
loadFromLocalStorage();
