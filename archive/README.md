# Offline data archive

Local backups of digitized map data so cleanup of intermediate processing files does not lose recovery options.

## Contents

| File | Purpose |
|------|---------|
| `baskhedi_georeferenced.geojson` | Georeferenced Baskhedi features (roads + POIs). ~313 features. Source used by the original Firestore upload script. |
| `public_baskhedi_georeferenced.geojson` | Same snapshot as previously served under `public/`. |
| `baskhedi_raw_pixels.geojson` | Pre-georeference pixel coordinates (intermediate). |

## Live data

The running app loads features from **Firestore** collections:

- `features` — Baskhedi
- `features_village2` — Junapani (Map 2)
- `features_village3` — Shivni Padawa (Map 3)
- `features_*` — any maps created in the UI

Use **Export GeoJSON** in the app for an up-to-date dump of the active map.

## Restoring deleted processing assets from git history

Intermediate images and scripts were removed in the repo cleanup commit but remain in the parent commit (`b3c97ad`):

```bash
# Example: restore original Baskhedi scan
git show b3c97ad:"public/social map of Baskhedi (1)_2.jpg" > "archive/social_map_baskhedi_original.jpg"

# Example: restore a processing intermediate
git show b3c97ad:public/baskhedi_clean.png > archive/baskhedi_clean.png
```

Active runtime overlays (do **not** delete) live in `public/`:

- `baskhedi_enhanced.jpeg`
- `map2_enhanced.jpeg` / `map2.jpeg`
- `map3_enhanced.jpeg` / `map3.jpeg`
