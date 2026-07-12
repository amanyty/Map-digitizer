import os
import json
import math
from typing import Annotated
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import networkx as nx
from shapely.geometry import shape
from shapely.ops import unary_union

# Global Graph object representing the road network
G = nx.Graph()

def haversine_distance(lon1, lat1, lon2, lat2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) in meters.
    """
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371000.0  # Radius of Earth in meters
    return c * r

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan handler that runs on startup and shutdown.
    Loads georeferenced road LineStrings, nodes them using unary_union,
    snaps coordinates within tolerance, and builds the NetworkX graph.
    """
    geojson_path = "baskhedi_georeferenced.geojson"
    if not os.path.exists(geojson_path):
        print(f"[ERROR] Required georeferenced file not found: {geojson_path}")
        print("Please run georeference.py first to create this file.")
        yield
        return
        
    print(f"[*] Ingesting road network from: {geojson_path}")
    try:
        with open(geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to read/parse GeoJSON: {e}")
        yield
        return

    # Ingest shapely geometry objects
    lines = []
    line_count = 0
    for feature in data.get("features", []):
        geom = feature.get("geometry")
        if geom and geom.get("type") == "LineString":
            try:
                lines.append(shape(geom))
                line_count += 1
            except Exception as e:
                print(f"[!] Warning: Skipping invalid geometry: {e}")

    # Perform unary union to dissolve and split lines at all intersection crossings
    print("[*] Dissolving and noding intersecting roads...")
    try:
        union_result = unary_union(lines)
    except Exception as e:
        print(f"[ERROR] Unary union failed: {e}")
        union_result = lines

    # Convert MultiLineString/LineString to geometries list
    if hasattr(union_result, "geoms"):
        geoms = list(union_result.geoms)
    else:
        geoms = [union_result] if union_result else []

    # Snap coordinates within tolerance to bridge drawing gaps
    SNAPPING_TOLERANCE_METERS = 50.0
    unique_nodes = []

    def get_snapped_node(lon, lat):
        for n in unique_nodes:
            if haversine_distance(lon, lat, n[0], n[1]) <= SNAPPING_TOLERANCE_METERS:
                return n
        new_node = (lon, lat)
        unique_nodes.append(new_node)
        return new_node

    # Add edges to the graph
    for geom in geoms:
        coords = list(geom.coords)
        for i in range(len(coords) - 1):
            p1 = get_snapped_node(coords[i][0], coords[i][1])
            p2 = get_snapped_node(coords[i+1][0], coords[i+1][1])
            # Avoid self-loops from snapping adjacent points to the same node
            if p1 != p2:
                dist = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                G.add_edge(p1, p2, weight=dist)

    print(f"[+] Graph constructed successfully:")
    print(f"    - Nodes: {G.number_of_nodes()}")
    print(f"    - Edges: {G.number_of_edges()}")
    print(f"    - Source LineStrings parsed: {line_count}")
    
    components = list(nx.connected_components(G))
    print(f"    - Connected road components found: {len(components)}")
    
    yield
    # Cleanup on shutdown
    G.clear()

# Initialize FastAPI App
app = FastAPI(
    title="Baskhedi Routing Service",
    description="Provides routing capabilities over the georeferenced road network of Baskhedi, Madhya Pradesh.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def find_nearest_node(target_lon: float, target_lat: float):
    """
    Scan all graph nodes to find the node closest to the target coordinates.
    Returns: (nearest_node_tuple, distance_in_meters)
    """
    if not G.nodes:
        return None, float('inf')
    
    nearest_node = None
    min_dist = float('inf')
    for node in G.nodes:
        # node is (longitude, latitude)
        dist = haversine_distance(target_lon, target_lat, node[0], node[1])
        if dist < min_dist:
            min_dist = dist
            nearest_node = node
            
    return nearest_node, min_dist

@app.get("/")
def home():
    """
    Home endpoint. Returns instructions and metadata.
    """
    return {
        "message": "Welcome to the Baskhedi Routing API",
        "status": "Online",
        "endpoints": {
            "/api/route": "GET - Computes shortest path. Query params: start_lat, start_lon, end_lat, end_lon",
            "/api/graph-stats": "GET - Details on nodes, edges, and connectivity of the network"
        }
    }

@app.get("/api/graph-stats")
def graph_stats():
    """
    Endpoint to retrieve technical stats about the NetworkX road graph.
    """
    if not G.nodes:
        return {"status": "empty", "message": "Graph is not loaded."}
    
    components = list(nx.connected_components(G))
    return {
        "nodes_count": G.number_of_nodes(),
        "edges_count": G.number_of_edges(),
        "connected_components_count": len(components),
        "component_sizes": [len(c) for c in components]
    }

@app.get("/api/route")
def get_route(
    start_lat: Annotated[float, Query(description="Latitude of start position")],
    start_lon: Annotated[float, Query(description="Longitude of start position")],
    end_lat: Annotated[float, Query(description="Latitude of end position")],
    end_lon: Annotated[float, Query(description="Longitude of end position")],
    max_snap_dist: Annotated[float, Query(description="Max snapping distance to nearest road node in meters")] = 500.0
):
    """
    Find the shortest path between a start and end coordinate.
    
    Returns a GeoJSON Feature containing a LineString representation of the path,
    as well as routing metrics (total distance in meters).
    """
    if not G.nodes:
        raise HTTPException(
            status_code=503, 
            detail="Routing network graph is not loaded. Please ensure baskhedi_georeferenced.geojson exists."
        )

    # Find the closest nodes on the road network
    start_node, start_dist = find_nearest_node(start_lon, start_lat)
    end_node, end_dist = find_nearest_node(end_lon, end_lat)

    if not start_node or not end_node:
        raise HTTPException(
            status_code=404,
            detail="Could not map coordinates to any network nodes."
        )

    # Validate that snapping is within reasonable thresholds
    if start_dist > max_snap_dist:
        raise HTTPException(
            status_code=400,
            detail=f"Start location is too far from the nearest road segment ({start_dist:.1f}m > max {max_snap_dist}m)."
        )
    if end_dist > max_snap_dist:
        raise HTTPException(
            status_code=400,
            detail=f"End location is too far from the nearest road segment ({end_dist:.1f}m > max {max_snap_dist}m)."
        )

    # Compute shortest path using NetworkX Dijkstra implementation
    try:
        # nx.shortest_path returns a list of nodes (lon, lat) representing the path
        path = nx.shortest_path(G, source=start_node, target=end_node, weight="weight")
        
        # Calculate total distance along the path
        total_distance = nx.shortest_path_length(G, source=start_node, target=end_node, weight="weight")
    except nx.NetworkXNoPath:
        raise HTTPException(
            status_code=400,
            detail="A route cannot be found between these two points (road segments are disconnected)."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Shortest path calculation failed: {str(e)}"
        )

    # Build standard GeoJSON LineString Feature response
    # Coordinates in GeoJSON coordinates must be [longitude, latitude]
    geojson_feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [list(node) for node in path]
        },
        "properties": {
            "distance_meters": round(total_distance, 2),
            "snapped_start": {
                "distance_meters": round(start_dist, 2),
                "node_coordinates": start_node
            },
            "snapped_end": {
                "distance_meters": round(end_dist, 2),
                "node_coordinates": end_node
            }
        }
    }

    return geojson_feature
