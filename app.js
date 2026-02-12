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

const liveCanvas = document.getElementById("live-canvas");
const liveCtx = liveCanvas.getContext("2d");
const cubeEl = document.getElementById("cube");
const cubeLegend = document.getElementById("cube-legend");

let cubeRotationX = -22;
let cubeRotationY = 35;
let dragging = false;
let dragOrigin = { x: 0, y: 0 };

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
  const width = ifds[0].width;
  const height = ifds[0].height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCircularPreview(image) {
  const { width, height } = previewCanvas;
  const radius = width * 0.49;
  const cx = width / 2;
  const cy = height / 2;

  previewCtx.clearRect(0, 0, width, height);
  previewCtx.save();
  previewCtx.beginPath();
  previewCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  previewCtx.clip();
  previewCtx.drawImage(image, 0, 0, width, height);
  previewCtx.restore();
}

function circularAverageIntensity(image) {
  const off = document.createElement("canvas");
  off.width = 360;
  off.height = 360;
  const ctx = off.getContext("2d");
  ctx.drawImage(image, 0, 0, off.width, off.height);

  const { data } = ctx.getImageData(0, 0, off.width, off.height);
  const radius = off.width * 0.49;
  const cx = off.width / 2;
  const cy = off.height / 2;

  let total = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const x = idx % off.width;
    const y = Math.floor(idx / off.width);
    const dx = x - cx;
    const dy = y - cy;
    if (Math.hypot(dx, dy) > radius) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const intensity = (r + g + b) / 3;
    total += intensity;
    count += 1;
  }

  return count ? total / count : 0;
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
      const avg = circularAverageIntensity(image);
      uploads.push({ fileName: file.name, imageUrl, orientation: "", avg });
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

  event.target.value = "";

  renderCapturedGrid();
  refreshBuildState();
}

async function selectTile(index) {
  const item = uploads[index];
  if (!item) return;
  const image = await loadImage(item.imageUrl);
  drawCircularPreview(image);

  const avg = circularAverageIntensity(image);
  item.avg = avg;
  latestAverageLabel.textContent = avg.toFixed(1);

  renderCapturedGrid();
  refreshBuildState();
}

function removeUpload(index) {
  uploads.splice(index, 1);
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

function intensityToColor(intensity) {
  const normalized = Math.round((intensity / 255) * 255);
  const alpha = (0.22 + (intensity / 255) * 0.78).toFixed(2);
  return `rgba(${normalized}, 0, 0, ${alpha})`;
}

function updateCubeFaces() {
  cubeLegend.innerHTML = "";
  for (const face of document.querySelectorAll(".face")) {
    const orientation = face.dataset.face;
    const record = captures.get(orientation);
    const intensity = record ? record.avg : 0;
    face.textContent = orientation;
    face.style.background = intensityToColor(intensity);

    const li = document.createElement("li");
    li.textContent = `${orientation}: ${intensity.toFixed(1)} avg`;
    cubeLegend.append(li);
  }
}

function goToLivePage() {
  buildCapturesFromUploads();
  baselinePage.classList.remove("active");
  livePage.classList.add("active");
  updateCubeFaces();
  startLiveFeed();
}

function startLiveFeed() {
  function drawFrame(t) {
    const { width, height } = liveCanvas;
    liveCtx.fillStyle = "rgb(8, 11, 18)";
    liveCtx.fillRect(0, 0, width, height);

    for (let i = 0; i < 12; i++) {
      const pulse = Math.sin((t / 500) + i) * 0.5 + 0.5;
      const radius = 35 + pulse * 90;
      const x = ((i + 1) * width) / 13 + Math.sin(t / 800 + i) * 30;
      const y = height / 2 + Math.cos(t / 650 + i * 1.6) * 120;
      const gradient = liveCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 70, 70, ${0.14 + pulse * 0.2})`);
      gradient.addColorStop(1, "rgba(255, 40, 40, 0)");
      liveCtx.fillStyle = gradient;
      liveCtx.beginPath();
      liveCtx.arc(x, y, radius, 0, Math.PI * 2);
      liveCtx.fill();
    }

    liveCtx.strokeStyle = "rgba(255,255,255,0.22)";
    liveCtx.strokeRect(0, 0, width, height);
    liveCtx.fillStyle = "#b8c4d8";
    liveCtx.font = "16px sans-serif";
    liveCtx.fillText("Simulated Live Basler Feed", 20, 30);
    requestAnimationFrame(drawFrame);
  }

  requestAnimationFrame(drawFrame);
}

function applyCubeTransform() {
  cubeEl.style.transform = `rotateX(${cubeRotationX}deg) rotateY(${cubeRotationY}deg)`;
}

cubeEl.addEventListener("pointerdown", (event) => {
  dragging = true;
  dragOrigin = { x: event.clientX, y: event.clientY };
  cubeEl.classList.add("dragging");
  cubeEl.setPointerCapture(event.pointerId);
});

cubeEl.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const dx = event.clientX - dragOrigin.x;
  const dy = event.clientY - dragOrigin.y;
  dragOrigin = { x: event.clientX, y: event.clientY };
  cubeRotationY += dx * 0.5;
  cubeRotationX -= dy * 0.5;
  applyCubeTransform();
});

cubeEl.addEventListener("pointerup", (event) => {
  dragging = false;
  cubeEl.classList.remove("dragging");
  cubeEl.releasePointerCapture(event.pointerId);
});

imageUpload.addEventListener("change", handleUpload);
buildCubeBtn.addEventListener("click", goToLivePage);

renderCapturedGrid();
refreshBuildState();
applyCubeTransform();
