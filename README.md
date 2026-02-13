# Lumicell Cavity Mapper Prototype

This prototype now supports an **upload-first baseline workflow**:

1. Upload up to six baseline images.
2. Assign a unique orientation to each uploaded image (`posterior`, `lateral`, `superior`, `inferior`, `medial`, `anterior`).
   - Upload supports PNG/JPG/TIF/TIFF files and applies auto-contrast for TIFF previews so dim grayscale data remains visible.
3. For each upload, drag to center and wheel to zoom/crop inside the circular field.
4. The app computes average pixel intensity **inside that circular field** for each upload.
5. When all six orientations are assigned, build the cube and transition to cavity map mode.
6. The cube face color intensity (red scale) reflects the assigned baseline averages.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## GitHub Desktop quick sync (to avoid branch confusion)

Use this flow when GitHub Desktop shows multiple branches and you are not sure what is deployed:

1. In **Current Branch**, switch to `main`.
2. Click **Fetch origin**.
3. Click **Branch > Update from default branch**.
4. Open **Repository > Repository settings... > Remotes** and verify:
   - Name: `origin`
   - URL: `https://github.com/awturne/Vibe-Code-Lumicell-3D-map.git`
5. If your latest work is on another branch (for example `tiff-fix`), merge it into `main`:
   - **Branch > Choose a branch to merge into main**
   - Select `tiff-fix`
   - Commit merge
   - Click **Push origin**
6. In GitHub Pages settings, make sure Pages serves `main` from `/ (root)`.
7. Reload the site and hard-refresh (`Ctrl+Shift+R`) to clear cached JavaScript.

## Current scope

- Basler connection and true live feed are mocked.
- The live feed panel is intentionally hidden in this iteration.
- Baseline to cube mapping is driven by uploaded images and circular average intensity.
