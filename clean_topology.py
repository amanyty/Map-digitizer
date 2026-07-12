#!/usr/bin/env python3
"""
Clean Topology Script
---------------------
This script cleans the road network topology of a georeferenced GeoJSON file.
It splits intersecting LineStrings at crossing points (noding) and preserves
all other geometry types (Points/POIs).

Usage:
    python clean_topology.py [input_file.geojson] [output_file.geojson]
"""

import sys
import json
import os
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

def main():
    if len(sys.argv) < 2:
        print("Usage: python clean_topology.py <input_file.geojson> [output_file.geojson]")
        sys.exit(1)

    input_file = sys.argv[1]
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)

    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file

    print(f"[*] Reading GeoJSON features from: {input_file}")
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading/parsing input file: {e}")
        sys.exit(1)

    if "features" not in data:
        print("Error: Invalid GeoJSON structure (missing 'features' array).")
        sys.exit(1)

    # Separate points and road linestrings
    points = []
    lines = []
    skipped_count = 0

    for idx, feature in enumerate(data["features"]):
        geom = feature.get("geometry")
        if not geom:
            continue
            
        geom_type = geom.get("type")
        if geom_type == "Point":
            points.append(feature)
        elif geom_type == "LineString":
            try:
                lines.append(shape(geom))
            except Exception as e:
                print(f"[!] Warning: Skipping invalid LineString at index {idx}: {e}")
                skipped_count += 1
        else:
            # Preserve other geometries (Polygons, etc.) without altering them
            points.append(feature)

    print(f"[*] Dissolving and noding {len(lines)} road segments...")
    try:
        union_result = unary_union(lines)
    except Exception as e:
        print(f"Error performing unary union to node intersections: {e}")
        sys.exit(1)

    # Reconstruct features list
    new_features = []
    
    # Extract segments from union
    if hasattr(union_result, "geoms"):
        geoms = list(union_result.geoms)
    else:
        geoms = [union_result] if union_result else []

    # Add noded road segments as features
    for segment in geoms:
        new_features.append({
            "type": "Feature",
            "properties": {"type": "road"},
            "geometry": mapping(segment)
        })

    # Add original POIs/Points back
    new_features.extend(points)

    # Write output
    output_data = data.copy()
    output_data["features"] = new_features

    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"[+] Cleaned topology successfully written to: {output_file}")
        print(f"    - Noded segments created: {len(geoms)}")
        print(f"    - POIs / Other elements preserved: {len(points)}")
        if skipped_count > 0:
            print(f"    - Skipped invalid elements: {skipped_count}")
    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
