# 🧪 Testing Guide - Vehicle Tracing & Alert System

## Quick Start Testing

### Step 1: Ensure Backend is Running

The backend should already be running. You can verify by checking:

```
http://127.0.0.1:8000/health
```

Expected response:
```json
{
  "status": "ok"
}
```

### Step 2: Open Test Interface

The test interface is already open in your browser at:
```
file:///c:/Users/MSI-PC/OneDrive/Desktop/ORGANISED/Build/Vehicle%20Tracking/mobile-map/test_report.html
```

## 🎯 Test Scenarios

### Test Case 1: Successful Vehicle Detection & Matching

**Objective**: Test complete pipeline with vehicle image

**Steps**:
1. Click "Choose File" and select a vehicle image (car, truck, bus)
2. Use default GPS coordinates: `21.229001, 81.678221`
3. Select direction: `east`
4. Set severity: `3`
5. Click "🔍 Analyze & Match Vehicle"

**Expected Results**:
- ✅ Detection confidence displayed (e.g., 85-95%)
- ✅ Similarity score shown (e.g., 70-90%)
- ✅ Original image with red bounding box displayed
- ✅ Detected vehicle crop shown
- ✅ Best matching camera identified (e.g., cam_A1)
- ✅ Match list with similarity scores

**Success Criteria**:
- Detection confidence > 70%
- At least 1 camera match found
- Images displayed correctly

---

### Test Case 2: No Vehicle Detected

**Objective**: Test error handling when no vehicle in image

**Steps**:
1. Upload an image without vehicles (landscape, building, etc.)
2. Use any GPS coordinates
3. Click "🔍 Analyze & Match Vehicle"

**Expected Results**:
- ⚠️ Warning badge displayed
- ⚠️ Error message: "No vehicle detected in the uploaded image"
- ℹ️ Detection count: 0

**Success Criteria**:
- Graceful error handling
- Clear error message
- No system crash

---

### Test Case 3: Vehicle Detected but No Cameras in Area

**Objective**: Test when vehicle is detected but no nearby cameras

**Steps**:
1. Upload a vehicle image
2. Change GPS to far location: `0.0, 0.0`
3. Click "🔍 Analyze & Match Vehicle"

**Expected Results**:
- ⚠️ Warning badge
- ⚠️ Error: "No cameras found in the specified area"
- ✅ Detection confidence still shown
- ✅ Detected vehicle image displayed

**Success Criteria**:
- Detection works correctly
- Filtering logic works
- Partial results shown

---

### Test Case 4: Multiple Camera Matches

**Objective**: Test ranking of multiple matches

**Steps**:
1. Upload a vehicle image
2. Use GPS near multiple cameras: `21.229001, 81.678221`
3. Select direction: `north-east`
4. Click "🔍 Analyze & Match Vehicle"

**Expected Results**:
- ✅ Multiple matches listed
- ✅ Matches sorted by similarity (highest first)
- ✅ Best match highlighted with 🏆 icon
- ✅ Each match shows:
  - Camera ID
  - Similarity percentage
  - Distance score
  - GPS location
  - Direction
  - Intersection

**Success Criteria**:
- Matches sorted correctly
- All metadata displayed
- Best match clearly indicated

---

### Test Case 5: Different Severity Levels

**Objective**: Test severity parameter handling

**Steps**:
1. Upload vehicle image
2. Test with severity = 1 (low priority)
3. Test with severity = 5 (critical)

**Expected Results**:
- ✅ System processes both requests
- ✅ Severity reflected in results
- ✅ Alert payload includes severity

**Success Criteria**:
- Severity parameter accepted
- No impact on detection/matching
- Severity available for alert system

---

## 📊 Accuracy Validation

### Understanding Metrics

#### 1. Detection Confidence
- **Source**: YOLOv8 model output
- **Range**: 0-100%
- **Interpretation**:
  - 90-100%: Excellent detection
  - 70-90%: Good detection
  - 50-70%: Fair detection
  - <50%: Poor detection

#### 2. Similarity Score
- **Source**: FAISS L2 distance converted to similarity
- **Formula**: `similarity = 1.0 / (1.0 + L2_distance)`
- **Range**: 0-100%
- **Interpretation**:
  - 80-100%: Very high match probability
  - 60-80%: High match probability
  - 40-60%: Moderate match probability
  - <40%: Low match probability

#### 3. Distance Score
- **Source**: L2 distance in embedding space
- **Range**: 0-∞ (lower is better)
- **Interpretation**:
  - 0-0.5: Excellent match
  - 0.5-1.5: Good match
  - 1.5-3.0: Fair match
  - >3.0: Poor match

---

## 🔍 Visual Inspection

### What to Look For:

1. **Bounding Box Accuracy**
   - ✅ Box tightly fits vehicle
   - ✅ No excessive padding
   - ✅ Correct vehicle selected (if multiple)

2. **Detected Crop Quality**
   - ✅ Clear vehicle image
   - ✅ Minimal background
   - ✅ Good resolution

3. **UI/UX**
   - ✅ Smooth animations
   - ✅ Responsive layout
   - ✅ Color-coded metrics
   - ✅ Clear error messages

---

## 🐛 Troubleshooting

### Issue: "Failed to connect to backend"

**Solution**:
1. Check if backend is running: `http://127.0.0.1:8000/health`
2. Restart backend: `uvicorn app:app --reload --port 8000`
3. Check for port conflicts

### Issue: "No vehicle detected" (but vehicle is visible)

**Possible Causes**:
1. Image quality too low
2. Vehicle too small in image
3. Unusual vehicle angle
4. YOLOv8 confidence threshold too high

**Solution**:
- Try different image
- Ensure vehicle is prominent
- Check `conf_thresh` in `detector.py` (default: 0.3)

### Issue: Low similarity scores

**Possible Causes**:
1. Different vehicle in camera feed
2. Different lighting conditions
3. Different vehicle angle
4. ReID model limitations

**Solution**:
- This is expected for different vehicles
- High similarity (>70%) indicates same vehicle
- Low similarity (<40%) indicates different vehicle

### Issue: Images not displaying

**Possible Causes**:
1. Base64 encoding failed
2. Image format not supported
3. Browser compatibility

**Solution**:
- Check browser console for errors
- Try different image format (JPEG recommended)
- Use modern browser (Chrome, Firefox, Edge)

---

## 📝 Test Checklist

- [ ] Backend health check passes
- [ ] Frontend loads without errors
- [ ] Image upload works
- [ ] Form validation works
- [ ] Vehicle detection succeeds
- [ ] Bounding box displayed correctly
- [ ] Detected crop shown
- [ ] Metrics displayed (confidence, similarity)
- [ ] Camera matches listed
- [ ] Best match highlighted
- [ ] Error handling works (no vehicle)
- [ ] Error handling works (no cameras)
- [ ] Loading animation shows
- [ ] Results animation smooth
- [ ] Responsive design works
- [ ] Console shows no errors

---

## 🎓 Sample Test Data

### Good Test Images:
- Vehicle images from `backend/camera_feeds/cam_A1/`
- Vehicle images from `backend/camera_feeds/cam_B1/`
- Vehicle images from `backend/camera_feeds/cam_C1/`

### GPS Coordinates for Testing:
- **Near cam_A1**: `21.229001, 81.678221` (direction: east)
- **Near cam_B1**: `21.228510, 81.678701` (direction: north)
- **Near cam_C1**: `21.227900, 81.679120` (direction: north-east)
- **Far away**: `0.0, 0.0` (should find no cameras)

---

## 📈 Performance Benchmarks

Expected processing times (CPU):
- Image upload: <100ms
- Vehicle detection: 130-210ms
- Embedding extraction: 50-100ms
- FAISS search: <10ms
- Image encoding: 50-100ms
- **Total**: 300-500ms

If processing takes >1 second, check:
- CPU usage
- Image size (resize large images)
- Model loading (should be cached)

---

## ✅ Success Indicators

Your system is working correctly if:

1. ✅ Detection confidence consistently >70% for clear vehicle images
2. ✅ Similarity scores >60% for same vehicle
3. ✅ Similarity scores <40% for different vehicles
4. ✅ Processing time <1 second
5. ✅ All images display correctly
6. ✅ Error handling works gracefully
7. ✅ UI is responsive and smooth

---

**Happy Testing! 🚀**

