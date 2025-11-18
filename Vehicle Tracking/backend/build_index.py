import os
import json
import numpy as np
from PIL import Image

from src.detector import Detector
from src.reid_extractor import ReidExtractor
from src.indexer import Indexer
from src.utils import load_config, load_json

def main():
    # Load config
    config = load_config("config/settings.yaml")
    camera_meta = load_json(config["camera_config"])

    # Initialize YOLO detector + ReID model
    detector = Detector(
        model_path=config["models"]["yolo_model"],
        device=config.get("device", "cpu"),
        conf_thresh=0.3
    )
    reid = ReidExtractor(
        model_path=config["models"]["reid_model"],
        device=config.get("device", "cpu"),
        embedding_dim=config["faiss"]["embedding_dim"]
    )

    embedding_dim = config["faiss"]["embedding_dim"]

    all_embeddings = []
    all_ids = []
    metadata = {}

    index_counter = 0

    print("\n======== BUILDING FAISS INDEX ========\n")

    # Go through each camera
    for cam_id, cam in camera_meta.items():
        img_path = cam.get("image_path")

        if img_path is None or not os.path.exists(img_path):
            print(f"[SKIP] No image for camera {cam_id}")
            continue

        print(f"[PROCESS] Camera: {cam_id} — {img_path}")

        # Load image
        image = Image.open(img_path).convert("RGB")

        # Detect vehicle(s)
        detections = detector.detect(image)

        if len(detections) == 0:
            print(f"[NO CAR] No vehicle detected in {cam_id}")
            continue

        # For each detected vehicle in the camera image, extract embedding and store
        for det in sorted(detections, key=lambda d: d["score"], reverse=True):
            car_crop = det["crop"]

            # Extract embedding
            emb = reid.extract(car_crop)

            # Save embedding and metadata for this detection
            all_embeddings.append(emb)
            all_ids.append(index_counter)

            metadata[str(index_counter)] = {
                "camera_id": cam_id,
                "bbox": det["bbox"],
                "image_path": img_path,
                "gps": cam.get("gps"),
                "direction": cam.get("direction"),
                "intersection": cam.get("intersection"),
                "score": det["score"]
            }

            index_counter += 1

    if len(all_embeddings) == 0:
        print("\n[ERROR] No embeddings found. Make sure camera images contain cars.")
        return

    embeddings_np = np.vstack(all_embeddings).astype("float32")

    # Create FAISS index
    indexer = Indexer(
        dim=embedding_dim,
        index_path=config["faiss"]["index_path"],
        meta_path=config["faiss"]["meta_path"]
    )
    indexer.build_from_embeddings(embeddings_np, all_ids, metadata)

    # Save index + metadata
    indexer.save()

    print("\n======== DONE ========\n")
    print(f"Total embeddings saved: {len(all_embeddings)}")
    print(f"FAISS index saved to:   {config['faiss']['index_path']}")
    print(f"Metadata saved to:      {config['faiss']['meta_path']}")


if __name__ == "__main__":
    main()
