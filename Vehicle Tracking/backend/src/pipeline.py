import os
from .detector import Detector
from .reid_extractor import ReidExtractor
from .indexer import Indexer
from .utils import load_json, haversine_distance, is_direction_aligned, cardinal_to_degree

class Pipeline:
    def __init__(self, config):
        self.config = config
        models_cfg = config.get('models', {})
        device = config.get('device', 'cpu')
        # Initialize detector and reid extractor with lower threshold for better detection
        self.detector = Detector(models_cfg.get('yolo_model'), device=device, conf_thresh=0.2)
        self.reid = ReidExtractor(models_cfg.get('reid_model'), device=device,
                                  embedding_dim=config['faiss']['embedding_dim'])
        # Initialize indexer
        self.indexer = Indexer(dim=config['faiss']['embedding_dim'],
                               index_path=config['faiss']['index_path'],
                               meta_path=config['faiss']['meta_path'])
        # try load index
        try:
            self.indexer.load()
        except Exception:
            print('FAISS index not found or failed to load. Build index first.')

        # load camera metadata
        self.cameras = load_json(config.get('camera_config'))
        self.max_distance = config['filters']['max_distance_meters']
        self.dir_tol = config['filters']['direction_tolerance_deg']
        self.time_window = config['filters']['time_window_seconds']

    def filter_cameras(self, user_gps, user_dir=None):
        # return a list of camera IDs to search
        # user_dir is now optional - if None or empty, skip direction filtering
        candidates = []
        for cam_id, cam in self.cameras.items():
            cam_gps = cam['gps']
            dist = haversine_distance(user_gps[0], user_gps[1], cam_gps[0], cam_gps[1])
            if dist > self.max_distance:
                continue
            # Only check direction if user_dir is provided
            if user_dir and user_dir.strip():
                if not is_direction_aligned(user_dir, cam.get('direction', ''), tolerance_deg=self.dir_tol):
                    continue
            candidates.append({'camera_id': cam_id, 'distance': dist, 'gps': cam_gps, 'image_path': cam.get('image_path')})
        # sort by distance
        candidates = sorted(candidates, key=lambda x: x['distance'])
        return candidates

    def find_matches(self, query_image, gps, direction, timestamp, severity=1, top_k=5):
        # 1. detect vehicle in query
        dets = self.detector.detect(query_image)
        print(f"\n[DEBUG] Detected {len(dets)} vehicles in uploaded image")
        for i, d in enumerate(dets):
            print(f"  {i+1}. {d.get('class', 'unknown')}: {d['score']*100:.1f}% confidence")

        if len(dets) == 0:
            return {'error': 'no_vehicle_detected', 'detection_count': 0}

        # 3. filter cameras by gps + direction (do once)
        candidates = self.filter_cameras(gps, direction)
        print(f"\n[DEBUG] Filtered {len(candidates)} cameras by GPS/direction")
        for c in candidates:
            print(f"  - {c['camera_id']}: {c['distance']:.1f}m away")

        if len(candidates) == 0:
            # Still return detection metadata so caller can show crops
            return {
                'error': 'no_cameras_in_area',
                'detection_count': len(dets),
                'detection_confidence': max(d['score'] for d in dets) if dets else None,
                'detection_bbox': dets[0]['bbox'] if dets else None,
                'detected_crop': dets[0]['crop'] if dets else None,
                'all_detections': [{'bbox': d['bbox'], 'score': d['score'], 'class': d.get('class', 'vehicle')} for d in dets]
            }

        # For each detection in the query image, extract embedding and query FAISS
        all_matches = []
        detections_results = []
        cand_ids = set([c['camera_id'] for c in candidates])

        for det in dets:
            crop = det['crop']
            detection_confidence = det['score']
            detection_bbox = det['bbox']
            detection_class = det.get('class', 'vehicle')

            emb = self.reid.extract(crop)

            results = self.indexer.query(emb, top_k=top_k)
            print(f"\n[DEBUG] FAISS returned {len(results)} results for a detection (score={detection_confidence:.3f}):")
            for i, r in enumerate(results):
                meta = r.get('meta', {})
                cam_id = meta.get('camera_id', 'unknown')
                similarity = 1.0 / (1.0 + r['dist'])
                print(f"  {i+1}. {cam_id}: distance={r['dist']:.4f}, similarity={similarity*100:.1f}%")

            # Keep only results whose camera_id is in candidate list
            filtered = []
            for r in results:
                meta = r.get('meta', {})
                cam_id = meta.get('camera_id') or meta.get('cam')
                if cam_id is not None and cam_id in cand_ids:
                    filtered.append({'camera_id': cam_id, 'dist': r['dist'], 'meta': meta})
                    print(f"  ✓ Kept {cam_id} (in candidate list)")
                else:
                    print(f"  ✗ Filtered out {cam_id} (not in candidate list or None)")

            matches = []
            for f in filtered:
                similarity_score = 1.0 / (1.0 + f['dist'])
                m = {
                    'camera_id': f['camera_id'],
                    'distance': f['dist'],
                    'similarity': similarity_score,
                    'meta': f['meta']
                }
                matches.append(m)
                all_matches.append(m)

            detections_results.append({
                'bbox': detection_bbox,
                'score': detection_confidence,
                'class': detection_class,
                'matches': matches,
                'detected_crop': crop
            })

        # Choose best overall match across all detections (highest similarity)
        best = None
        for m in all_matches:
            if best is None or m['similarity'] > best['similarity']:
                best = m

        resp = {
            'best_camera': best['camera_id'] if best else None,
            'best_similarity': None if best is None else best['similarity'],
            'camera_location': None if best is None else self.cameras.get(best['camera_id'], {}).get('gps'),
            'matches': all_matches,
            'severity': severity,
            # Detection metadata
            'detection_count': len(dets),
            'detection_confidence': max(d['score'] for d in dets) if dets else None,
            'detections': detections_results,
            'all_detections': [{'bbox': d['bbox'], 'score': d['score'], 'class': d.get('class', 'vehicle')} for d in dets]
        }

        print(f"\n[DEBUG] Final result: {len(all_matches)} total matches across {len(detections_results)} detections")
        if best:
            print(f"  Best match: {best['camera_id']} with {best['similarity']*100:.1f}% similarity")

        return resp
