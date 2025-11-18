import xml.etree.ElementTree as ET
import random
import os

def create_routes(
    net_file="grid3x3.net.xml",
    output_file="routes.rou.xml",
    num_routes=500,
    step=2.0,
    add_detectors=True
):
    """
    Generates random routes and optionally lane-area detectors for a SUMO 3×3 tic-tac-toe network.
    Each outer edge can act as a spawn or destination point.
    """

    # Load network
    tree = ET.parse(net_file)
    root = tree.getroot()

    # --- Parse coordinates safely for each edge ---
    edge_coords = {}
    for edge in root.findall("edge"):
        if edge.get("id", "").startswith(":"):
            continue  # skip internal junction edges

        lane = edge.find("lane")
        if lane is None or lane.get("shape") is None:
            continue

        coords = lane.get("shape").split()
        # Use mid-point of first and last coordinate
        x1, y1 = map(float, coords[0].split(','))
        x2, y2 = map(float, coords[-1].split(','))
        edge_coords[edge.get("id")] = ((x1 + x2) / 2, (y1 + y2) / 2)

    if not edge_coords:
        raise ValueError("No valid edge coordinates found in the network file.")

    # --- Determine boundary extents ---
    xs, ys = zip(*edge_coords.values())
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)

    # --- Identify outer edges as spawn/destination points ---
    entry_edges = []
    exit_edges = []
    for edge_id, (x, y) in edge_coords.items():
        # Boundary margin threshold (to avoid floating point drift)
        margin = 20.0
        if abs(x - min_x) < margin or abs(x - max_x) < margin or abs(y - min_y) < margin or abs(y - max_y) < margin:
            entry_edges.append(edge_id)
            exit_edges.append(edge_id)

    if not entry_edges:
        raise ValueError("No outer edges detected for spawns; check coordinate scale or margin.")

    print(f"Detected {len(entry_edges)} boundary edges for spawning/exit.")

    # --- Define vehicle types ---
    vehicle_types = {
        "car": {
            "accel": "2.6", "decel": "4.5", "sigma": "0.5", "length": "5.0", "maxSpeed": "13.9", "color": "1,1,0"
        },
        "bike": {
            "accel": "1.0", "decel": "3.0", "sigma": "0.6", "length": "2.0", "maxSpeed": "6.0", "color": "0,1,0"
        },
        "truck": {
            "accel": "1.2", "decel": "4.0", "sigma": "0.5", "length": "8.0", "maxSpeed": "11.1", "color": "0,0,1"
        },
        "bus": {
            "accel": "1.0", "decel": "4.0", "sigma": "0.5", "length": "10.0", "maxSpeed": "11.1", "color": "1,0,0"
        },
        "auto": {
            "accel": "1.8", "decel": "4.0", "sigma": "0.5", "length": "3.0", "maxSpeed": "8.0", "color": "1,0,1"
        },
        "ambulance": {
            "accel": "3.0", "decel": "5.0", "sigma": "0.4", "length": "5.0", "maxSpeed": "16.7", "color": "0,1,1"
        },
        "firetruck": {
            "accel": "2.8", "decel": "5.0", "sigma": "0.4", "length": "8.0", "maxSpeed": "15.0", "color": "1,0.5,0"
        },
        "police": {
            "accel": "3.0", "decel": "5.0", "sigma": "0.4", "length": "5.0", "maxSpeed": "16.0", "color": "0,0,1"
        }
    }

    # --- Root element for routes ---
    routes_root = ET.Element("routes", {
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:noNamespaceSchemaLocation": "http://sumo.dlr.de/xsd/routes_file.xsd"
    })

    # Add vehicle types
    for vtype, attrs in vehicle_types.items():
        ET.SubElement(routes_root, "vType", id=vtype, **attrs)

    # --- Generate random trips ---
    random.seed(42)  # deterministic runs
    for i in range(num_routes):
        from_edge, to_edge = random.sample(entry_edges, 2)  # distinct edges
        vtype = random.choices(
            population=list(vehicle_types.keys()),
            weights=[60, 10, 8, 6, 8, 3, 3, 2],  # spawn probabilities
            k=1
        )[0]

        ET.SubElement(routes_root, "trip", {
            "id": f"trip_{i}",
            "type": vtype,
            "depart": f"{i * step:.1f}",
            "from": from_edge,
            "to": to_edge,
        })

    # --- Write routes file ---
    ET.indent(routes_root, space="  ", level=0)
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    ET.ElementTree(routes_root).write(output_file, encoding="utf-8", xml_declaration=True)
    print(f"✅ Generated {num_routes} routes -> {output_file}")

    # --- Optional: generate detectors file ---
    if add_detectors:
        det_root = ET.Element("additional")
        for edge_id in entry_edges:
            for lane_idx in range(2):  # first 2 lanes assumed inbound
                ET.SubElement(det_root, "laneAreaDetector", {
                    "id": f"det_{edge_id}_{lane_idx}",
                    "lane": f"{edge_id}_{lane_idx}",
                    "pos": "50",
                    "length": "10",
                    "freq": "60",
                    "file": "detector_output.xml"
                })

        det_file = os.path.splitext(output_file)[0] + "_detectors.add.xml"
        ET.indent(det_root, space="  ", level=0)
        ET.ElementTree(det_root).write(det_file, encoding="utf-8", xml_declaration=True)
        print(f"📡 Generated lane-area detectors -> {det_file}")


if __name__ == "__main__":
    create_routes(
        net_file="grid3x3.net.xml",  # your network
        output_file="generated/routes.rou.xml",
        num_routes=500,
        step=2.0,
        add_detectors=True
    )
