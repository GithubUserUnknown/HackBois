// Global map + markers
let map;
let cameraMarkers = {};

function initMap() {
    // Center map around your area
    map = L.map('map').setView([21.2285, 81.6790], 15);

    // Base layer — free OSM tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 1,
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    // Load camera markers from backend
    fetch('http://127.0.0.1:8000/cameras')
        .then(r => r.json())
        .then(data => {
            for (let cam_id in data) {
                addCameraMarker(cam_id, data[cam_id]);
            }
        })
        .catch(err => {
            console.error('Failed to load cameras from backend, falling back to local cameras.json', err);
            // fallback to embedded cameras variable if present
            if (typeof cameras !== 'undefined') {
                for (let cam_id in cameras) {
                    addCameraMarker(cam_id, cameras[cam_id]);
                }
            }
        });

    // Allow clicking on the map to place a new camera (open modal form)
    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        showCreateCameraForm(lat, lon);
    });

}

function addCameraMarker(cam_id, cam) {
    let lat = cam.gps[0];
    let lon = cam.gps[1];

    // Create camera marker
    let marker = L.divIcon({
        className: "camera-marker",
        iconSize: [20, 20]
    });

    let m = L.marker([lat, lon], { icon: marker }).addTo(map);
    cameraMarkers[cam_id] = m;

    // Build popup with upload form and display address if present
    const imgHtml = cam.image_path ? `<img src="http://127.0.0.1:8000/${cam.image_path}" width="180">` : '<div style="padding:8px;color:#666">No frames yet</div>';
    const addressHtml = cam.address ? `<div><b>Address:</b> ${cam.address}</div>` : '';
    const popupHtml = `
        <div>
            <b>Camera ID:</b> ${cam_id}<br>
            ${addressHtml}
            <b>Direction:</b> ${cam.direction || ''}<br>
            ${imgHtml}
            <hr>
            <input type="file" id="upload_${cam_id}" accept="image/*"><br>
            <button onclick="uploadCameraFrame('${cam_id}')">Upload Frame</button>
        </div>
    `;

    m.bindPopup(popupHtml);
}

// Show a small modal form to create a new camera and store address/direction
function showCreateCameraForm(lat, lon) {
    // create overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 10000;

    const form = document.createElement('div');
    form.style.background = '#fff';
    form.style.padding = '16px';
    form.style.borderRadius = '8px';
    form.style.width = '320px';
    form.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';

    const idDefault = 'cam_' + Date.now();
    form.innerHTML = `
        <h3 style="margin-top:0">Create Camera</h3>
        <label>Camera ID</label><br>
        <input id="new_cam_id" style="width:100%" value="${idDefault}"><br><br>
        <label>Address / Place name</label><br>
        <input id="new_cam_address" style="width:100%" placeholder="e.g. Phool Chowk"><br><br>
        <label>Direction (optional)</label><br>
        <input id="new_cam_dir" style="width:100%" placeholder="e.g. north"><br><br>
        <div style="text-align:right">
            <button id="create_cam_cancel">Cancel</button>
            <button id="create_cam_ok">Create</button>
        </div>
    `;

    overlay.appendChild(form);
    document.body.appendChild(overlay);

    document.getElementById('create_cam_cancel').onclick = function() { document.body.removeChild(overlay); };
    document.getElementById('create_cam_ok').onclick = function() {
        const camId = document.getElementById('new_cam_id').value.trim() || idDefault;
        const address = document.getElementById('new_cam_address').value.trim();
        const direction = document.getElementById('new_cam_dir').value.trim();
        const payload = { camera_id: camId, gps: [lat, lon], direction: direction, address: address };
        fetch('http://127.0.0.1:8000/camera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(r => r.json())
            .then(res => {
                addCameraMarker(camId, { gps: [lat, lon], direction: direction, image_path: null, address: address });
                alert('Camera created: ' + camId + '. Click the marker to upload images.');
                document.body.removeChild(overlay);
            }).catch(err => {
                console.error('Failed to create camera', err);
                alert('Failed to create camera');
                document.body.removeChild(overlay);
            });
    };
}
// Call this when backend returns a match
function highlightCamera(camera_id) {
    console.log("Highlight camera:", camera_id);

    // Remove previous highlights
    for (let id in cameraMarkers) {
        cameraMarkers[id]._icon.classList.remove("highlight");
    }

    // Highlight the matched camera
    if (cameraMarkers[camera_id]) {
        cameraMarkers[camera_id]._icon.classList.add("highlight");

        // Auto-open popup
        cameraMarkers[camera_id].openPopup();

        // Center map on the camera
        map.setView(cameraMarkers[camera_id].getLatLng(), 17, { animate: true });
    }
}

// Initialize the map
window.onload = initMap;

// upload handler called from popup
function uploadCameraFrame(camera_id) {
    const input = document.getElementById('upload_' + camera_id);
    if (!input || !input.files || input.files.length === 0) {
        alert('Select an image first');
        return;
    }
    const file = input.files[0];
    const fd = new FormData();
    fd.append('image', file);
    fetch(`http://127.0.0.1:8000/camera/${camera_id}/upload-frame`, { method: 'POST', body: fd })
        .then(r => r.json())
        .then(res => {
            alert('Uploaded and indexed ' + (res.added ? res.added.length : 0) + ' detections');
            // refresh marker popup image
            if (cameraMarkers[camera_id]) {
                cameraMarkers[camera_id].closePopup();
                // reload cameras and update popup
                fetch('http://127.0.0.1:8000/cameras').then(r => r.json()).then(data => {
                    const cam = data[camera_id];
                    if (cam && cameraMarkers[camera_id]) {
                        cameraMarkers[camera_id].unbindPopup();
                        const imgHtml = cam.image_path ? `<img src="http://127.0.0.1:8000/${cam.image_path}" width="180">` : '<div style="padding:8px;color:#666">No frames yet</div>';
                        const popupHtml = `\n        <div>\n            <b>Camera ID:</b> ${camera_id}<br>\n            <b>Direction:</b> ${cam.direction || ''}<br>\n            ${imgHtml}\n            <hr>\n            <input type=\"file\" id=\"upload_${camera_id}\" accept=\"image/*\"><br>\n            <button onclick=\"uploadCameraFrame('${camera_id}')\">Upload Frame</button>\n        </div>\n                        `;
                        cameraMarkers[camera_id].bindPopup(popupHtml);
                        cameraMarkers[camera_id].openPopup();
                    }
                });
            }
        }).catch(err => {
            console.error('Upload failed', err);
            alert('Upload failed');
        });
}
