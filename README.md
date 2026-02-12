# Lumicell Cavity Mapper Prototype

This prototype now supports an **upload-first baseline workflow**:

1. Upload up to six baseline images.
2. Assign a unique orientation to each uploaded image (`posterior`, `lateral`, `superior`, `inferior`, `medial`, `anterior`).
   - Upload supports PNG/JPG/TIF/TIFF files.
3. The app computes average pixel intensity **inside a circular field** for each upload.
4. When all six orientations are assigned, build the cube and transition to live mode.
5. The cube face color intensity (red scale) reflects the assigned baseline averages.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Current scope

- Basler connection and true live feed are mocked.
- Live image is simulated for now.
- Baseline to cube mapping is driven by uploaded images and circular average intensity.
