import json
from math import radians, cos, sin, asin, sqrt, atan2, degrees

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)


def load_config(path):
    import yaml
    with open(path, 'r') as f:
        return yaml.safe_load(f)


def haversine_distance(lat1, lon1, lat2, lon2):
    """Return distance in meters between two GPS coordinates."""
    # convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371000
    return c * r


def bearing_deg(lat1, lon1, lat2, lon2):
    """Return bearing in degrees from point A to B (0 = north)."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    x = sin(dlon) * cos(lat2)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)
    brng = atan2(x, y)
    brng = degrees(brng)
    brng = (brng + 360) % 360
    return brng


def cardinal_to_degree(cardinal):
    m = {
        'north': 0,
        'north-east': 45,
        'east': 90,
        'south-east': 135,
        'south': 180,
        'south-west': 225,
        'west': 270,
        'north-west': 315
    }
    return m.get(cardinal.lower(), None)


def is_direction_aligned(user_dir, camera_dir, tolerance_deg=60):
    """Check if camera direction is aligned with user's movement direction.
    user_dir: cardinal string (e.g., 'north-east')
    camera_dir: cardinal string (e.g., 'east')
    tolerance_deg: allowed angular difference
    """
    ud = cardinal_to_degree(user_dir)
    cd = cardinal_to_degree(camera_dir)
    if ud is None or cd is None:
        return True
    diff = abs((ud - cd + 180) % 360 - 180)
    return diff <= tolerance_deg

def get_alert_payload(best_camera, similarity, matches):
    """Generate alert payload for broadcasting."""
    return {
        "best_camera": best_camera,
        "similarity": similarity,
        "matches": matches
    }

