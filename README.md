# Lumicell Cavity Mapper Prototype

This prototype now supports an **upload-first baseline workflow**:

1. Upload up to six baseline images.
2. Assign a unique orientation to each uploaded image (`posterior`, `lateral`, `superior`, `inferior`, `medial`, `anterior`).
   - Upload supports PNG/JPG/TIF/TIFF files.
3. For each upload, drag to center and wheel to zoom/crop inside the circular field.
4. The app computes average pixel intensity **inside that circular field** for each upload.
5. When all six orientations are assigned, build the cube and transition to cavity map mode.
6. The cube face color intensity (red scale) reflects the assigned baseline averages.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Current scope

- Basler connection and true live feed are mocked.
- The live feed panel is intentionally hidden in this iteration.
- Baseline to cube mapping is driven by uploaded images and circular average intensity.
