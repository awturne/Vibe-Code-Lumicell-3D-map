const orientations = ["posterior", "lateral", "superior", "inferior", "medial", "anterior"];
const uploads = [];
const captures = new Map();

const baselinePage = document.getElementById("baseline-page");
const livePage = document.getElementById("live-page");
const imageUpload = document.getElementById("image-upload");
const buildCubeBtn = document.getElementById("build-cube-btn");
const captureStatus = document.getElementById("capture-status");
const previewCanvas = document.getElementById("preview-canvas");
const previewCtx = previewCanvas.getContext("2d");
const latestAverageLabel = document.getElementById("latest-average");
const captureGrid = document.getElementById("capture-grid");

const cubeEl = document.getElementById("cube");
const cubeLegend = document.getElementById("cube-legend");
const marginModelEl = document.getElementById("margin-model");
const marginLegend = document.getElementById("margin-legend");

let cubeRotationX = -22;
let cubeRotationY = 35;
let draggingCube = false;
let cubeDragOrigin = { x: 0, y: 0 };

let marginRotationX = -18;
let marginRotationY = 28;
let draggingMargin = false;
let marginDragOrigin = { x: 0, y: 0 };

let selectedTileIndex = -1;
let selectedImage = null;
let draggingPreview = false;
let previewDragOrigin = { x: 0, y: 0 };

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));

    if (fileIsTiff(file)) {
      reader.onload = () => {
        try {
          resolve(tiffArrayBufferToDataUrl(reader.result));
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function fileIsTiff(file) {
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".tif") || name.endsWith(".tiff") || file.type === "image/tiff";
}

function tiffArrayBufferToDataUrl(buffer) {
  if (!window.UTIF) {
    throw new Error("TIFF decoder is unavailable in this browser session.");
  }

  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error("No TIFF image data found.");

  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const displayRgba = autoContrastRgba(rgba);
  const width = ifds[0].width;
  const height = ifds[0].height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = new ImageData(new Uint8ClampedArray(displayRgba), width, height);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function autoContrastRgba(rgba) {
  if (!rgba || !rgba.length) return rgba;

  let min = 255;
  let max = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    const luminance = (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
    if (luminance < min) min = luminance;
    if (luminance > max) max = luminance;
  }

  const dynamicRange = max - min;
  if (dynamicRange < 2) return rgba;

  const output = new Uint8ClampedArray(rgba.length);
  const scale = 255 / dynamicRange;

  for (let i = 0; i < rgba.length; i += 4) {
    output[i] = Math.round((rgba[i] - min) * scale);
    output[i + 1] = Math.round((rgba[i + 1] - min) * scale);
    output[i + 2] = Math.round((rgba[i + 2] - min) * scale);
    output[i + 3] = rgba[i + 3];
  }

  return output;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function getCircleGeometry() {
  const { width, height } = previewCanvas;
  const radius = width * 0.49;
  return { width, height, radius, cx: width / 2, cy: height / 2 };
}

function ensureTransform(upload, image) {
  if (upload.scale && upload.scale > 0) return;

  const { radius } = getCircleGeometry();
  const diameter = radius * 2;
  const baseScale = Math.max(diameter / image.width, diameter / image.height);

  upload.scale = baseScale;
  upload.offsetX = 0;
  upload.offsetY = 0;
}

function drawCircularPreviewWithTransform(image, transform) {
  const { width, height, radius, cx, cy } = getCircleGeometry();

  previewCtx.clearRect(0, 0, width, height);
  previewCtx.save();
  previewCtx.beginPath();
  previewCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  previewCtx.clip();

  const drawWidth = image.width * transform.scale;
  const drawHeight = image.height * transform.scale;
  const x = cx - drawWidth / 2 + transform.offsetX;
  const y = cy - drawHeight / 2 + transform.offsetY;
  previewCtx.drawImage(image, x, y, drawWidth, drawHeight);
  previewCtx.restore();

  previewCtx.strokeStyle = "#7486aa";
  previewCtx.lineWidth = 3;
  previewCtx.beginPath();
  previewCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  previewCtx.stroke();
}

function circularAverageFromPreview() {
  const { width, radius, cx, cy } = getCircleGeometry();
  const { data } = previewCtx.getImageData(0, 0, width, width);

  let total = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const dx = x - cx;
    const dy = y - cy;
    if (Math.hypot(dx, dy) > radius) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    total += (r + g + b) / 3;
    count += 1;
  }

  return count ? total / count : 0;
}

function updateSelectedAverage() {
  if (selectedTileIndex < 0 || !selectedImage) return;
  const upload = uploads[selectedTileIndex];
  if (!upload) return;

  drawCircularPreviewWithTransform(selectedImage, upload);
  upload.avg = circularAverageFromPreview();
  latestAverageLabel.textContent = upload.avg.toFixed(1);
  renderCapturedGrid();
  refreshBuildState();
}

async function handleUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const allowed = Math.max(0, 6 - uploads.length);
  if (!allowed) {
    captureStatus.textContent = "Already have 6 uploads. Remove one to upload a different file.";
    return;
  }

  const selected = files.slice(0, allowed);
  let added = 0;

  for (const file of selected) {
    try {
      const imageUrl = await readFileAsDataUrl(file);
      const image = await loadImage(imageUrl);
      const upload = { fileName: file.name, imageUrl, orientation: "", avg: 0, scale: 0, offsetX: 0, offsetY: 0 };
      ensureTransform(upload, image);
      drawCircularPreviewWithTransform(image, upload);
      upload.avg = circularAverageFromPreview();
      uploads.push(upload);
      added += 1;
    } catch (error) {
      captureStatus.textContent = `Could not read ${file.name}. TIFF/PNG/JPG supported.`;
      console.error(error);
    }
  }

  if (!added) {
    event.target.value = "";
    renderCapturedGrid();
    refreshBuildState();
    return;
  }

  if (files.length > allowed) {
    captureStatus.textContent = `Only ${allowed} additional image(s) accepted (max 6).`;
  } else {
    captureStatus.textContent = `Uploaded ${added} image(s). Assign orientation for each.`;
  }

  if (selectedTileIndex < 0 && uploads.length) {
    await selectTile(0);
  } else {
    renderCapturedGrid();
    refreshBuildState();
  }

  event.target.value = "";
}

async function selectTile(index) {
  const item = uploads[index];
  if (!item) return;

  selectedTileIndex = index;
  selectedImage = await loadImage(item.imageUrl);
  ensureTransform(item, selectedImage);
  updateSelectedAverage();
}

function removeUpload(index) {
  uploads.splice(index, 1);

  if (selectedTileIndex === index) {
    selectedTileIndex = -1;
    selectedImage = null;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    latestAverageLabel.textContent = "--";
  } else if (selectedTileIndex > index) {
    selectedTileIndex -= 1;
  }

  captureStatus.textContent = "Removed upload.";
  renderCapturedGrid();
  refreshBuildState();
}

function usedOrientationsExcluding(index) {
  return uploads
    .map((u, i) => ({ i, orientation: u.orientation }))
    .filter(({ i, orientation }) => i !== index && orientation)
    .map(({ orientation }) => orientation);
}

function setOrientation(index, orientation) {
  const blocked = usedOrientationsExcluding(index);
  if (orientation && blocked.includes(orientation)) {
    captureStatus.textContent = `${orientation} is already assigned. Orientations must be unique.`;
    renderCapturedGrid();
    refreshBuildState();
    return;
  }

  uploads[index].orientation = orientation;
  captureStatus.textContent = "Orientation updated.";
  renderCapturedGrid();
  refreshBuildState();
}

function refreshBuildState() {
  const hasSix = uploads.length === 6;
  const hasAllOrientations = uploads.every((u) => u.orientation);
  const unique = new Set(uploads.map((u) => u.orientation).filter(Boolean)).size === 6;

  buildCubeBtn.disabled = !(hasSix && hasAllOrientations && unique);
}

function renderCapturedGrid() {
  captureGrid.innerHTML = "";

  for (let i = 0; i < 6; i++) {
    const card = document.createElement("article");
    card.className = "capture-item";

    const upload = uploads[i];
    if (!upload) {
      card.classList.add("empty");
      const footer = document.createElement("footer");
      footer.textContent = String(i + 1);
      card.append(footer);
      captureGrid.append(card);
      continue;
    }

    if (i === selectedTileIndex) {
      card.classList.add("selected");
    }

    const img = document.createElement("img");
    img.src = upload.imageUrl;
    img.alt = `Uploaded baseline ${i + 1}`;
    img.addEventListener("click", () => selectTile(i));
    card.append(img);

    const controls = document.createElement("div");
    controls.className = "tile-controls";

    const select = document.createElement("select");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Assign orientation";
    select.append(blank);

    const blocked = usedOrientationsExcluding(i);
    for (const orientation of orientations) {
      const option = document.createElement("option");
      option.value = orientation;
      option.textContent = orientation;
      option.selected = upload.orientation === orientation;
      if (blocked.includes(orientation) && !option.selected) option.disabled = true;
      select.append(option);
    }

    select.addEventListener("change", (e) => setOrientation(i, e.target.value));
    controls.append(select);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeUpload(i));
    controls.append(remove);

    card.append(controls);

    const footer = document.createElement("footer");
    const avgLabel = upload.avg == null ? "avg: --" : `avg: ${upload.avg.toFixed(1)}`;
    footer.textContent = `${i + 1} · ${upload.orientation || "unassigned"} · ${avgLabel}`;
    card.append(footer);

    captureGrid.append(card);
  }
}

function buildCapturesFromUploads() {
  captures.clear();

  for (const upload of uploads) {
    if (!upload.orientation) continue;
    captures.set(upload.orientation, {
      avg: upload.avg ?? 0,
      imageUrl: upload.imageUrl
    });
  }
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function jetColor(normalizedIntensity) {
  const t = clamp01(normalizedIntensity);
  const r = clamp01(1.5 - Math.abs(4 * t - 3));
  const g = clamp01(1.5 - Math.abs(4 * t - 2));
  const b = clamp01(1.5 - Math.abs(4 * t - 1));

  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function buildNormalizedIntensityMap() {
  const allIntensities = orientations.map((orientation) => captures.get(orientation)?.avg ?? 0);
  const minIntensity = Math.min(...allIntensities);
  const maxIntensity = Math.max(...allIntensities);
  const range = maxIntensity - minIntensity;

  const map = new Map();
  for (const orientation of orientations) {
    const intensity = captures.get(orientation)?.avg ?? 0;
    const normalized = range > 0 ? (intensity - minIntensity) / range : 0.5;
    map.set(orientation, { intensity, normalized });
  }

  return map;
}

function updateCubeFaces(intensityMap) {
  cubeLegend.innerHTML = "";

  for (const face of document.querySelectorAll(".face")) {
    const orientation = face.dataset.face;
    const reading = intensityMap.get(orientation) ?? { intensity: 0, normalized: 0.5 };

    face.textContent = orientation;
    face.style.background = jetColor(reading.normalized);

    const li = document.createElement("li");
    li.textContent = `${orientation}: ${reading.intensity.toFixed(1)} avg (${Math.round(reading.normalized * 100)}% jet)`;
    cubeLegend.append(li);
  }
}

function updateMarginModel(intensityMap) {
  marginLegend.innerHTML = "";

  const marginToOrientation = {
    superficial: "inferior",
    posterior: "posterior",
    lateral: "lateral",
    medial: "medial",
    superior: "superior",
    anterior: "anterior"
  };

  for (const face of document.querySelectorAll(".margin-face")) {
    const margin = face.dataset.margin;
    const orientation = marginToOrientation[margin] || "anterior";
    const reading = intensityMap.get(orientation) ?? { intensity: 0, normalized: 0.5 };

    face.textContent = margin;
    face.style.background = jetColor(reading.normalized);

    const li = document.createElement("li");
    li.textContent = `${margin}: ${reading.intensity.toFixed(1)} avg (${Math.round(reading.normalized * 100)}% jet · ${orientation})`;
    marginLegend.append(li);
  }
}

function goToLivePage() {
  buildCapturesFromUploads();
  baselinePage.classList.remove("active");
  livePage.classList.add("active");
  const intensityMap = buildNormalizedIntensityMap();
  updateCubeFaces(intensityMap);
  updateMarginModel(intensityMap);
}

function applyCubeTransform() {
  cubeEl.style.transform = `rotateX(${cubeRotationX}deg) rotateY(${cubeRotationY}deg)`;
}

function applyMarginTransform() {
  marginModelEl.style.transform = `rotateX(${marginRotationX}deg) rotateY(${marginRotationY}deg)`;
}

function clampScale(value, minScale) {
  return Math.min(Math.max(value, minScale), minScale * 4);
}

previewCanvas.addEventListener("pointerdown", (event) => {
  if (selectedTileIndex < 0) return;
  draggingPreview = true;
  previewDragOrigin = { x: event.clientX, y: event.clientY };
  previewCanvas.setPointerCapture(event.pointerId);
});

previewCanvas.addEventListener("pointermove", (event) => {
  if (!draggingPreview || selectedTileIndex < 0) return;
  const upload = uploads[selectedTileIndex];
  if (!upload) return;

  const dx = event.clientX - previewDragOrigin.x;
  const dy = event.clientY - previewDragOrigin.y;
  previewDragOrigin = { x: event.clientX, y: event.clientY };

  upload.offsetX += dx;
  upload.offsetY += dy;
  updateSelectedAverage();
});

previewCanvas.addEventListener("pointerup", (event) => {
  draggingPreview = false;
  previewCanvas.releasePointerCapture(event.pointerId);
});

previewCanvas.addEventListener("wheel", async (event) => {
  if (selectedTileIndex < 0) return;
  event.preventDefault();

  const upload = uploads[selectedTileIndex];
  if (!upload) return;

  if (!selectedImage) {
    selectedImage = await loadImage(upload.imageUrl);
  }

  const { radius } = getCircleGeometry();
  const minScale = Math.max((radius * 2) / selectedImage.width, (radius * 2) / selectedImage.height);
  const factor = event.deltaY < 0 ? 1.06 : 0.94;
  upload.scale = clampScale(upload.scale * factor, minScale);
  updateSelectedAverage();
}, { passive: false });

cubeEl.addEventListener("pointerdown", (event) => {
  draggingCube = true;
  cubeDragOrigin = { x: event.clientX, y: event.clientY };
  cubeEl.classList.add("dragging");
  cubeEl.setPointerCapture(event.pointerId);
});

cubeEl.addEventListener("pointermove", (event) => {
  if (!draggingCube) return;
  const dx = event.clientX - cubeDragOrigin.x;
  const dy = event.clientY - cubeDragOrigin.y;
  cubeDragOrigin = { x: event.clientX, y: event.clientY };
  cubeRotationY += dx * 0.5;
  cubeRotationX -= dy * 0.5;
  applyCubeTransform();
});

cubeEl.addEventListener("pointerup", (event) => {
  draggingCube = false;
  cubeEl.classList.remove("dragging");
  cubeEl.releasePointerCapture(event.pointerId);
});

marginModelEl.addEventListener("pointerdown", (event) => {
  draggingMargin = true;
  marginDragOrigin = { x: event.clientX, y: event.clientY };
  marginModelEl.classList.add("dragging");
  marginModelEl.setPointerCapture(event.pointerId);
});

marginModelEl.addEventListener("pointermove", (event) => {
  if (!draggingMargin) return;
  const dx = event.clientX - marginDragOrigin.x;
  const dy = event.clientY - marginDragOrigin.y;
  marginDragOrigin = { x: event.clientX, y: event.clientY };
  marginRotationY += dx * 0.45;
  marginRotationX -= dy * 0.45;
  applyMarginTransform();
});

marginModelEl.addEventListener("pointerup", (event) => {
  draggingMargin = false;
  marginModelEl.classList.remove("dragging");
  marginModelEl.releasePointerCapture(event.pointerId);
});

imageUpload.addEventListener("change", handleUpload);
buildCubeBtn.addEventListener("click", goToLivePage);

renderCapturedGrid();
refreshBuildState();
applyCubeTransform();
applyMarginTransform();
