#!/usr/bin/env python3
"""
Georeference GeoJSON Script
----------------------------
This script performs an affine transformation on a GeoJSON file containing pixel-based coordinates,
mapping them from the pixel bounds (0,0 to 1000,1000) to a real-world geographic bounding box
(WGS84, EPSG:4326) for Baskhedi, Madhya Pradesh, India.

Usage:
    python georeference.py [input_file.geojson] [output_file.geojson]
"""

import os
import sys
import json
import argparse
from shapely.geometry import shape, mapping
from shapely.affinity import affine_transform

# ==============================================================================
# CONFIGURATION: EDIT REAL-WORLD COORDINATES HERE
# ==============================================================================
# Approximate bounding box for Baskhedi, Madhya Pradesh, India.
# You can easily edit these lat/lon coordinates to adjust the placement on the map.

# Top-Left (North-West) corner of the bounding box
LAT_TOP_LEFT = 24.2634      # Latitude (Decimal Degrees)
LON_TOP_LEFT = 75.2595      # Longitude (Decimal Degrees)

# Bottom-Right (South-East) corner of the bounding box
LAT_BOTTOM_RIGHT = 24.2544  # Latitude (Decimal Degrees)
LON_BOTTOM_RIGHT = 75.2693  # Longitude (Decimal Degrees)

# Coordinate system bounds (pixel bounds of the source image)
PIXEL_X_MIN = 0.0
PIXEL_X_MAX = 1000.0
PIXEL_Y_MIN = 0.0
PIXEL_Y_MAX = 1000.0

# Toggle Y-Axis Inversion:
# - In Leaflet Simple CRS (default for the digitizer), Y increases upwards (0 at bottom, 1000 at top).
#   Set INVERT_Y = False.
# - In standard image/pixel space, Y increases downwards (0 at top, 1000 at bottom).
#   Set INVERT_Y = True.
INVERT_Y = False
# ==============================================================================


def calculate_affine_matrix():
    """
    Calculates the 6-element affine transformation matrix coefficients:
    [a, b, d, e, xoff, yoff]

    Where:
        x_geo = a * x_px + b * y_px + xoff
        y_geo = d * x_px + e * y_px + yoff
    """
    # X mapping (Longitude)
    # x_pixel = PIXEL_X_MIN (0.0) -> LON_TOP_LEFT (West)
    # x_pixel = PIXEL_X_MAX (1000.0) -> LON_BOTTOM_RIGHT (East)
    x_range = PIXEL_X_MAX - PIXEL_X_MIN
    a = (LON_BOTTOM_RIGHT - LON_TOP_LEFT) / x_range
    b = 0.0
    xoff = LON_TOP_LEFT - a * PIXEL_X_MIN

    # Y mapping (Latitude)
    y_range = PIXEL_Y_MAX - PIXEL_Y_MIN
    if not INVERT_Y:
        # Y=0 is bottom (LAT_BOTTOM_RIGHT), Y=1000 is top (LAT_TOP_LEFT)
        e = (LAT_TOP_LEFT - LAT_BOTTOM_RIGHT) / y_range
        d = 0.0
        yoff = LAT_BOTTOM_RIGHT - e * PIXEL_Y_MIN
    else:
        # Y=0 is top (LAT_TOP_LEFT), Y=1000 is bottom (LAT_BOTTOM_RIGHT)
        e = (LAT_BOTTOM_RIGHT - LAT_TOP_LEFT) / y_range
        d = 0.0
        yoff = LAT_TOP_LEFT - e * PIXEL_Y_MIN

    return [a, b, d, e, xoff, yoff]


def round_coordinates(coords, precision=7):
    """
    Recursively round coordinate values to the specified decimal precision.
    7 decimal places in EPSG:4326 offers sub-meter accuracy.
    """
    if isinstance(coords, (int, float)):
        return round(coords, precision)
    elif isinstance(coords, (list, tuple)):
        return [round_coordinates(c, precision) for c in coords]
    return coords


def main():
    parser = argparse.ArgumentParser(
        description="Georeference pixel-space GeoJSON features to WGS84 coordinates."
    )
    parser.add_argument(
        "input",
        nargs="?",
        help="Path to the input pixel-based GeoJSON file (default: autodetected in current directory)",
    )
    parser.add_argument(
        "output",
        nargs="?",
        default="baskhedi_georeferenced.geojson",
        help="Path to save the georeferenced output GeoJSON file (default: baskhedi_georeferenced.geojson)",
    )
    args = parser.parse_args()

    # Autodetect input file if not provided
    input_file = args.input
    if not input_file:
        default_files = ["baskhedi_raw_pixels.geojson", "baskhedi_raw_pixels (1).geojson"]
        for f in default_files:
            if os.path.exists(f):
                input_file = f
                break
        if not input_file:
            print("Error: Input GeoJSON file not found.", file=sys.stderr)
            print("Please specify the path, e.g.: python georeference.py my_file.geojson", file=sys.stderr)
            sys.exit(1)

    print(f"[*] Reading pixel coordinates from: {input_file}")

    try:
        with open(input_file, "r", encoding="utf-8") as f:
            geojson_data = json.load(f)
    except Exception as e:
        print(f"Error reading or parsing input JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if "features" not in geojson_data:
        print("Error: Invalid GeoJSON file structure (missing 'features' array).", file=sys.stderr)
        sys.exit(1)

    # Calculate affine transformation matrix
    matrix = calculate_affine_matrix()
    a, b, d, e, xoff, yoff = matrix

    print("\n--- Transformation Configuration ---")
    print(f"Top-Left (NW) Corner:  Lat = {LAT_TOP_LEFT:.6f}, Lon = {LON_TOP_LEFT:.6f}")
    print(f"Bottom-Right (SE) Corner: Lat = {LAT_BOTTOM_RIGHT:.6f}, Lon = {LON_BOTTOM_RIGHT:.6f}")
    print(f"Invert Y Axis:         {INVERT_Y}")
    print("\nCalculated Affine Matrix Coefficients:")
    print(f"  x_geo = {a:.10f} * x_px + {b:.10f} * y_px + {xoff:.10f}")
    print(f"  y_geo = {d:.10f} * x_px + {e:.10f} * y_px + {yoff:.10f}")
    print("------------------------------------\n")

    transformed_features = []
    point_count = 0
    linestring_count = 0
    other_count = 0

    for idx, feature in enumerate(geojson_data["features"]):
        if "geometry" not in feature or not feature["geometry"]:
            transformed_features.append(feature)
            continue

        try:
            # Parse GeoJSON geometry to a Shapely shape
            geom = shape(feature["geometry"])

            # Apply affine transformation
            transformed_geom = affine_transform(geom, matrix)

            # Convert Shapely shape back to GeoJSON mapping
            new_geom_mapping = mapping(transformed_geom)

            # Round coordinates for clean files (7 decimal places ~ 11mm precision)
            new_geom_mapping["coordinates"] = round_coordinates(new_geom_mapping["coordinates"])

            # Create updated feature dictionary
            transformed_feature = feature.copy()
            transformed_feature["geometry"] = new_geom_mapping
            transformed_features.append(transformed_feature)

            # Count geometry types
            geom_type = new_geom_mapping["type"]
            if geom_type == "Point":
                point_count += 1
            elif geom_type == "LineString":
                linestring_count += 1
            else:
                other_count += 1

        except Exception as err:
            print(f"[!] Warning: Failed to transform feature at index {idx}: {err}", file=sys.stderr)
            transformed_features.append(feature)

    # Write transformed GeoJSON to file
    output_data = geojson_data.copy()
    output_data["features"] = transformed_features
    # Update CRS metadata if it exists or add standard EPSG:4326 definition
    output_data["crs"] = {
        "type": "name",
        "properties": {
            "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
    }

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"[+] Successfully georeferenced {len(transformed_features)} features:")
        print(f"    - Points: {point_count}")
        print(f"    - LineStrings: {linestring_count}")
        if other_count > 0:
            print(f"    - Other types: {other_count}")
        print(f"[+] Output written to: {args.output}")
    except Exception as err:
        print(f"Error writing output file: {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
