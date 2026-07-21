# Map Digitizer

Georeferenced village social-map digitizer: overlay a scanned/AI-cleaned map, digitize roads and POIs (houses, handpumps, schools, etc.), compute on-network routes, print, and export GeoJSON.

Built with **Mapbox GL JS**, **Mapbox Draw**, **Firebase Auth + Firestore**, and **Vite**.

## Features

- Multi-village maps (config in Firestore `maps` collection, with local defaults)
- Auth-gated **Edit Mode** (draw roads, place/edit/delete POIs, custom background)
- Client-side **shortest path** routing on digitized road networks
- Print-friendly landscape layout (flat top-down view)
- **Export GeoJSON** of the active map features
- Shared POI catalog (`poiTypes.js`) for legend, toolbar, and markers

## Quick start

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

### Mapbox token

1. Create a free token at [mapbox.com](https://account.mapbox.com/access-tokens/).
2. Paste it into the app prompt (stored in `localStorage` as `mapbox_access_token`).
3. Restrict the token by URL in the Mapbox dashboard for production.

### Firebase

The web app uses the Firebase project configured in `app.js`. Edit mode requires a Firebase Auth **email/password** user.

Deploy rules after changing them:

```bash
firebase deploy --only firestore:rules
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run electron:start` | Open Electron shell (loads `dist/`) |
| `npm run electron:build` | Build web app + package Electron installer |

## Project layout

```
app.js              Main application (map, auth, edit, routing, print)
poiTypes.js         Single source of POI types / icons / labels
index.html          Shell UI (legend & toolbar filled from poiTypes)
styles.css          Dashboard styles + print CSS
public/             Static overlays and assets served by Vite
firestore.rules     Read/write rules for known collections only
main.js             Electron entry (hardened webPreferences)
```

### Active overlay assets

| Village (default) | Overlay file |
|-------------------|--------------|
| Baskhedi | `public/baskhedi_enhanced.jpeg` |
| Junapani (Map 2) | `public/map2_enhanced.jpeg` |
| Shivni Padawa (Map 3) | `public/map3_enhanced.jpeg` |

### Offline backups

`archive/` holds GeoJSON snapshots of Baskhedi features for recovery if Firestore is unavailable. Live data is still served from Firestore; use **Export GeoJSON** in the UI for the latest dump. See `archive/README.md` for restoring older processing images from git history.

## Data model (Firestore)

| Collection | Purpose |
|------------|---------|
| `maps/{mapId}` | Village name, center, image overlay URL, image corner coordinates, feature collection name |
| `features` / `features_*` | GeoJSON-like features (points & lines). Coordinates may be stored as JSON strings (Firestore nested-array workaround) |
| `village_settings/{mapId}` | Optional custom background (`customBackgroundUrl` as compressed base64 data URL) |

**Security:** public read on allowed collections; write requires `request.auth != null`. See `firestore.rules`.

## Editing workflow

1. **Enter Edit Mode** → sign in with admin credentials.
2. Choose a tool (house, road, canal, …) and click the map / draw lines.
3. Drag POIs to reposition; use delete tool to remove features.
4. Upload a custom background under **Custom Map Background** if needed.
5. **Export GeoJSON** or **Print Map** for handoff.

## Routing

Click the map (view mode) to set start, then end. Routing snaps to the nearest graph nodes built from `LineString` features and runs Dijkstra on the client.

## Deploy (Vercel)

```bash
npm run build
vercel --prod
```

Ensure Mapbox token URL restrictions include your production domain. Redeploy Firestore rules via Firebase CLI when rules change.

## License / credit

Baskhedi GIS Platform — village social mapping use case, 2026.
