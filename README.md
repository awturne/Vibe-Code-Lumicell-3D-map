# Lumicell Cavity Mapper Prototype

This prototype now supports an **upload-first baseline workflow**:

1. Upload up to six baseline images.
2. Assign a unique orientation to each uploaded image (`posterior`, `lateral`, `superior`, `inferior`, `medial`, `anterior`).
   - Upload supports PNG/JPG/TIF/TIFF files and applies auto-contrast for TIFF previews so dim grayscale data remains visible.
3. For each upload, drag to center and wheel to zoom/crop inside the circular field.
4. The app computes average pixel intensity **inside that circular field** for each upload.
5. When all six orientations are assigned, build the cavity model and transition to live mode.
6. The live model uses a normalized jet map (blue = lowest average, red = highest average, with cyan/green/yellow in between) and maintains side mapping with display labels updated as requested: front=inferior data labeled anterior, back=posterior, left=lateral, right=medial, top=superior, bottom=anterior data labeled inferior.
7. Users can drag-rotate one unified 3D model and toggle between **collapsed cube** and **exploded + cavity** views, where a central black cavity opening is revealed by the exploded faces. Faces render double-sided so all six sides remain visible while rotating.
8. Baseline image crop preview is intentionally smaller for a tidier upload workspace, and the blue stage fully contains the crop circle diameter.
9. A jet heatmap legend bar is shown below the model with dynamic low/high intensity values.
10. A patient silhouette orientation graphic is included; clicking the chest cavity opens an expanded circular orientation heatmap.

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

## If the TIFF auto-contrast fix is not showing on GitHub

Use these PowerShell commands to force your local `main` to match GitHub, verify whether GitHub actually has the fix, and push if needed:

```powershell
cd "C:\Users\AveryTurner\OneDrive - LUMICELL INC\Documents\GitHub\Vibe-Code-Lumicell-3D-map"
git fetch origin
git checkout main
git reset --hard origin/main
git show origin/main:app.js | Select-String "autoContrastRgba"
```

- If that last command prints nothing, GitHub `main` still does not contain the fix.
- To publish your local fix branch to `main`:

```powershell
git checkout tiff-fix
git pull origin tiff-fix
git checkout main
git merge tiff-fix
git push origin main
```

Then run locally and bypass cache:

```powershell
python -m http.server 4173
```

Open: `http://localhost:4173/?v=3`.

## Quick interpretation of your PowerShell output ("does this look right?")

If you run the checks below and both are empty, your GitHub `main` branch still does **not** have the TIFF auto-contrast code yet:

```powershell
git show origin/main:README.md | Select-String "auto-contrast"
git show origin/main:app.js | Select-String "autoContrastRgba"
```

If your fix is currently on a `codex/...` branch, merge that branch into `main` with:

```powershell
git fetch origin
git checkout main
git pull origin main
git merge origin/codex/create-lumpectomy-imaging-app-prototype
git push origin main
```

Then re-check:

```powershell
git show origin/main:app.js | Select-String "autoContrastRgba"
```

If that returns a line, GitHub `main` now has the fix.
