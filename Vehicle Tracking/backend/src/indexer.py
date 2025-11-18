import faiss
import numpy as np
import json
import threading
import os

class Indexer:
    def __init__(self, dim, index_path=None, meta_path=None):
        self.dim = dim
        self.index = faiss.IndexFlatL2(dim)
        self.ids = []
        self.meta = {}
        self.index_path = index_path
        self.meta_path = meta_path
        # lock to protect concurrent index updates
        self._lock = threading.Lock()

    def build_from_embeddings(self, embeddings_np, id_list, meta_dict):
        # embeddings_np: numpy array shape (N, dim)
        self.index.add(embeddings_np.astype('float32'))
        self.ids = id_list
        self.meta = meta_dict

    def save(self):
        with self._lock:
            if self.index_path:
                faiss.write_index(self.index, self.index_path)
            if self.meta_path:
                with open(self.meta_path, 'w') as f:
                    json.dump(self.meta, f)

    def add(self, vector, meta):
        """Add a single embedding vector (1D numpy array) and its metadata to the index.
        Returns the assigned index id (int).
        """
        vec = np.array([vector]).astype('float32')
        with self._lock:
            self.index.add(vec)
            # New id is position at end of meta
            new_id = len(self.meta)
            self.meta[str(new_id)] = meta
        return new_id

    def load(self):
        with self._lock:
            if self.index_path and os.path.exists(self.index_path):
                self.index = faiss.read_index(self.index_path)
            if self.meta_path and os.path.exists(self.meta_path):
                with open(self.meta_path, 'r') as f:
                    self.meta = json.load(f)

    def stats(self):
        with self._lock:
            return {'n_embeddings': len(self.meta)}

    def query(self, vector, top_k=5):
        D, I = self.index.search(np.array([vector]).astype('float32'), top_k)
        results = []
        for dist, idx in zip(D[0], I[0]):
            if idx < 0:
                continue
            # If we had ids mapping, index mapping should be consistent. Here index is positional.
            meta = self.meta.get(str(int(idx)), {})
            results.append({'id': int(idx), 'dist': float(dist), 'meta': meta})
        return results
