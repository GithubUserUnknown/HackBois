import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

# Try to use torchreid if available, otherwise fallback to simple ResNet backbone
try:
    import torchreid
    _HAS_TORCHREID = True
except Exception:
    _HAS_TORCHREID = False


class ReidExtractor:
    def __init__(self, model_path=None, device='cpu', embedding_dim=512):
        self.device = torch.device(device)
        self.embedding_dim = embedding_dim
        if _HAS_TORCHREID and model_path is not None:
            # Load a torchreid model if provided (user may place pretrained weights)
            # Example placeholder - actual torchreid loading may vary with model config
            try:
                self.model = torchreid.models.build_model(
                    name='resnet50',
                    num_classes=1000,
                    loss='softmax'
                )
                self.model.load_state_dict(torch.load(model_path, map_location=self.device))
                self.model.eval()
                self.model.to(self.device)
            except Exception:
                self._build_fallback()
        else:
            self._build_fallback()

        self.transform = transforms.Compose([
            transforms.Resize((256, 128)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225])
        ])

    def _build_fallback(self):
        # Simple ResNet50 backbone with global average pooling to produce embeddings
        backbone = models.resnet50(pretrained=True)
        modules = list(backbone.children())[:-1]
        self.model = nn.Sequential(*modules)
        self.model.eval()
        self.model.to(self.device)

    def extract(self, pil_image):
        x = self.transform(pil_image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            feat = self.model(x)
            feat = feat.view(feat.size(0), -1)
            # normalize
            feat = feat / (feat.norm(p=2, dim=1, keepdim=True) + 1e-6)
            return feat.cpu().numpy()[0]
