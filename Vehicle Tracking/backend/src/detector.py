from ultralytics import YOLO
import numpy as np
from PIL import Image

class Detector:
    # COCO dataset vehicle classes
    VEHICLE_CLASSES = {
        2: 'car',
        3: 'motorcycle',
        5: 'bus',
        7: 'truck'
    }

    def __init__(self, model_path, device='cpu', conf_thresh=0.25):
        self.model = YOLO(model_path)
        self.conf_thresh = conf_thresh
        self.device = device

    def detect(self, pil_image):
        # returns list of dicts: {'bbox': [x1,y1,x2,y2], 'score': s, 'crop': PIL.Image, 'class': cls_name}
        # Only detects vehicles (car, motorcycle, bus, truck)
        results = self.model.predict(
            source=np.asarray(pil_image),
            imgsz=640,
            device=self.device,
            conf=self.conf_thresh,
            verbose=False
        )
        out = []
        if len(results) == 0:
            return out
        res = results[0]
        boxes = res.boxes

        for box in boxes:
            cls = int(box.cls.numpy()[0]) if hasattr(box, 'cls') else None
            conf = float(box.conf.numpy()[0]) if hasattr(box, 'conf') else 0.0

            # Only keep vehicle classes
            if cls not in self.VEHICLE_CLASSES:
                continue

            if conf < self.conf_thresh:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy.numpy()[0])

            # Skip very small detections (likely false positives)
            width = x2 - x1
            height = y2 - y1
            if width < 30 or height < 30:
                continue

            crop = pil_image.crop((x1, y1, x2, y2))
            out.append({
                'bbox': [x1, y1, x2, y2],
                'score': conf,
                'crop': crop,
                'class': self.VEHICLE_CLASSES[cls],
                'class_id': cls
            })

        # Sort by confidence (highest first)
        out = sorted(out, key=lambda x: x['score'], reverse=True)
        return out