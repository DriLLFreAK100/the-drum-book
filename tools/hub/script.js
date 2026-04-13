// ─── Theme ────────────────────────────────────────────────────────────────────
// Shared via localStorage key 'theme'. Values: 'dark' (default) | 'light'.
// Hub broadcasts changes to the embedded metronome iframe via postMessage.

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙 Dark' : '☀ Light';
}

function setupTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('theme', next);
    // Broadcast to metronome iframe
    const iframe = document.querySelector('.metronome-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'APPLY_THEME', theme: next }, '*');
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// Store exercise data
const exercises = {
  categories: []
};

// webmscore: global WebMscore available after <script src="webmscore.js">
// OSMD: global opensheetmusicdisplay available after <script src="opensheetmusicdisplay.min.js">
let currentZoom = 100;
let currentRenderer = 'osmd';   // 'osmd' | 'webmscore'
let osmd = null;                // OpenSheetMusicDisplay instance (reused across loads)
let lastScoreFile = null;       // { mscz, xml, name } — for re-render on renderer switch
let lastSvgPages = [];         // raw SVG strings from last webmscore render

// ─── Music Player State ───────────────────────────────────────────────────────
// Uses HTMLAudioElement per stem — no fetch needed, works on file:// protocol.
const stemAudios = {};    // label → HTMLAudioElement
const stemEnabled = {};   // label → boolean
let playerDuration = 0;
let isPlaying = false;
let masterVolume = 1;
let rafId = null;
let leaderLabel = null;   // label of the primary audio element used for time tracking
let autoScroll = true;    // scroll notation container in sync with playback

// ─── URL State ────────────────────────────────────────────────────────────────
// Persists app state in location.hash as a base64-encoded JSON blob so that
// refreshing the page restores exactly where the user was.
//
// Shape: { item, renderer, zoom, autoScroll, tab, metronome }
//   item: { type: 'exercise'|'tune'|'pdf', id: string }
//   renderer: 'osmd'|'webmscore'
//   zoom: number
//   autoScroll: bool
//   tab: 'metronome'|'player'
//   metronome: { tempo, timeSig, palette, pitch, beatTones, beatMutes }

let _urlStateWriteLock = false; // prevent recursive writes during restore
let _pendingMetronomeRestore = null; // queued until METRONOME_READY fires

function urlStateGet() {
  try {
    const hash = location.hash.slice(1);
    if (!hash) return {};
    return JSON.parse(atob(hash));
  } catch {
    return {};
  }
}

function urlStateSet(patch) {
  if (_urlStateWriteLock) return;
  const current = urlStateGet();
  const next = Object.assign({}, current, patch);
  location.replace('#' + btoa(JSON.stringify(next)));
}

function urlStateClear(keys) {
  if (_urlStateWriteLock) return;
  const current = urlStateGet();
  keys.forEach(k => delete current[k]);
  location.replace('#' + btoa(JSON.stringify(current)));
}
// ─────────────────────────────────────────────────────────────────────────────

// Manifest is loaded dynamically from manifest.json at startup.
// Run tools/hub/generate-manifest.py whenever exercises or .ref books change.

// Initialize the hub
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('osmdContainer');

  try {
    const manifest = await loadManifest();
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Select an exercise to begin</div>';
    populateExercises(manifest);
    setupTheme();
    setupZoomControls();
    setupRendererToggle();
    setupAutoScrollToggle();
    setupSearch();
    setupPlayer();
    setupRightTabs();
    await restoreStateFromUrl(manifest);
  } catch (error) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #d32f2f;">
        <p>⚠️ Could not load exercise list</p>
        <p style="font-size: 0.85em; color: #999; margin-top: 8px;">${error.message}</p>
        <p style="font-size: 0.8em; color: #bbb; margin-top: 12px;">
          Run <code>python3 tools/hub/generate-manifest.py</code> then reload.
        </p>
        <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f5f5f5;">↺ Reload</button>
      </div>
    `;
    console.error('Hub init error:', error);
  }
});

// Load manifest — reads window.MANIFEST injected by manifest.js (works with file://).
// Falls back to fetch('manifest.json') when served over HTTP without the script tag.
async function loadManifest() {
  if (window.MANIFEST) return window.MANIFEST;

  // Fallback: try fetching JSON (requires HTTP server)
  try {
    const res = await fetch('manifest.json');
    if (!res.ok) throw new Error(`manifest.json returned ${res.status}`);
    return res.json();
  } catch {
    throw new Error(
      'manifest.js not found and manifest.json could not be fetched. ' +
      'Run tools/hub/generate-manifest.py to generate it.'
    );
  }
}

// Restore app state from URL hash. Called once after the manifest is loaded.
async function restoreStateFromUrl(manifest) {
  const s = urlStateGet();
  if (!Object.keys(s).length) return;

  _urlStateWriteLock = true;
  try {
    // ── renderer ──────────────────────────────────────────────────────────────
    if (s.renderer && s.renderer !== currentRenderer) {
      currentRenderer = s.renderer;
      document.querySelectorAll('.renderer-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.renderer === currentRenderer)
      );
    }

    // ── zoom ──────────────────────────────────────────────────────────────────
    if (s.zoom && s.zoom !== currentZoom) {
      currentZoom = s.zoom;
      document.getElementById('zoomLevel').textContent = currentZoom + '%';
    }

    // ── autoScroll ────────────────────────────────────────────────────────────
    if (typeof s.autoScroll === 'boolean' && s.autoScroll !== autoScroll) {
      autoScroll = s.autoScroll;
      const btn = document.getElementById('autoScrollBtn');
      if (btn) {
        btn.classList.toggle('active', autoScroll);
        btn.title = autoScroll ? 'Auto-scroll: on' : 'Auto-scroll: off';
      }
    }

    // ── right tab ─────────────────────────────────────────────────────────────
    if (s.tab) switchRightTab(s.tab, true);

    // ── selected item ─────────────────────────────────────────────────────────
    if (s.item) {
      const { type, id } = s.item;

      if (type === 'exercise') {
        // Find the matching exercise item in the sidebar and activate it
        const sidebarItem = document.querySelector(`.exercise-item[data-path="${CSS.escape(id)}"]`);
        if (sidebarItem) {
          document.querySelectorAll('.exercise-item').forEach(i => i.classList.remove('active'));
          sidebarItem.classList.add('active');
          // Build name the same way the click handler does
          const name = sidebarItem.dataset.name || id;
          lastScoreFile = { mscz: null, xml: id, name };
          _applyRendererToScore();
        }
      } else if (type === 'tune') {
        const tune = (manifest.musics || []).find(t => t.name === id);
        if (tune) {
          const sidebarItem = document.querySelector(`.tune-item[data-name="${CSS.escape(id)}"]`);
          if (sidebarItem) {
            document.querySelectorAll('.exercise-item').forEach(i => i.classList.remove('active'));
            sidebarItem.classList.add('active');
          }
          loadTune(tune, true);
        }
      } else if (type === 'pdf') {
        const book = (manifest.refBooks || []).find(b => b.path === id);
        if (book) {
          const sidebarItem = document.querySelector(`.ref-book-item[data-path="${CSS.escape(id)}"]`);
          if (sidebarItem) {
            document.querySelectorAll('.exercise-item').forEach(i => i.classList.remove('active'));
            sidebarItem.classList.add('active');
          }
          loadPdf(id, book.name, true);
        }
      }
    }

    // ── metronome ─────────────────────────────────────────────────────────────
    // Store for sending once the metronome iframe fires METRONOME_READY.
    if (s.metronome) {
      _pendingMetronomeRestore = s.metronome;
    }
  } finally {
    _urlStateWriteLock = false;
  }
}

// Populate exercise list in sidebar
function populateExercises(manifest) {
  const exercisesList = document.getElementById('exercisesList');
  exercisesList.innerHTML = '';

  manifest.exercises.forEach(category => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'exercise-category';

    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'category-title expanded';
    categoryTitle.textContent = category.name;

    const exerciseItems = document.createElement('div');
    exerciseItems.className = 'exercise-items show';

    (category.files || []).forEach(file => {
      const item = document.createElement('div');
      item.className = 'exercise-item';
      item.textContent = formatFileName(file);
      item.dataset.path = `${category.path}/${file}`;
      item.dataset.name = `${category.name} - ${formatFileName(file)}`;

      item.addEventListener('click', () => {
        document.querySelectorAll('.exercise-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadExercise(item.dataset.path, item.dataset.name);
      });

      exerciseItems.appendChild(item);
    });

    // Toggle category expansion
    categoryTitle.addEventListener('click', () => {
      exerciseItems.classList.toggle('show');
      categoryTitle.classList.toggle('expanded');
      categoryTitle.classList.toggle('collapsed');
    });

    categoryDiv.appendChild(categoryTitle);
    categoryDiv.appendChild(exerciseItems);
    exercisesList.appendChild(categoryDiv);
  });

  // Reference Books section
  const sectionDivider = document.createElement('div');
  sectionDivider.className = 'section-divider';
  sectionDivider.textContent = 'Reference Books';
  exercisesList.appendChild(sectionDivider);

  const booksCategory = document.createElement('div');
  booksCategory.className = 'exercise-category';

  (manifest.refBooks || []).forEach(book => {
    const item = document.createElement('div');
    item.className = 'exercise-item ref-book-item';
    item.textContent = book.name;
    item.dataset.path = book.path;
    item.dataset.name = book.name;
    item.dataset.type = 'pdf';
    if (book.pages) item.dataset.pages = book.pages;

    item.addEventListener('click', () => {
      document.querySelectorAll('.exercise-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      loadPdf(item.dataset.path, item.dataset.name);
    });

    booksCategory.appendChild(item);
  });

  exercisesList.appendChild(booksCategory);

  // Tunes section
  if (manifest.musics && manifest.musics.length > 0) {
    const tunesDivider = document.createElement('div');
    tunesDivider.className = 'section-divider';
    tunesDivider.textContent = 'Tunes';
    exercisesList.appendChild(tunesDivider);

    const tunesCategory = document.createElement('div');
    tunesCategory.className = 'exercise-category';

    const sortedMusics = manifest.musics.slice().sort((a, b) => a.name.localeCompare(b.name));
    sortedMusics.forEach(tune => {
      const item = document.createElement('div');
      item.className = 'exercise-item tune-item';
      item.textContent = tune.name;
      item.dataset.name = tune.name;
      item.dataset.type = 'tune';

      item.addEventListener('click', () => {
        document.querySelectorAll('.exercise-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadTune(tune);
      });

      tunesCategory.appendChild(item);
    });

    exercisesList.appendChild(tunesCategory);
  }
}

// Reload the sidebar with a fresh manifest (e.g. after files are added)
async function refreshManifest() {
  try {
    const manifest = await fetchManifest();
    populateExercises(manifest);
  } catch (e) {
    console.error('Could not refresh manifest:', e);
  }
}

// Format file name for display
function formatFileName(fileName) {
  return fileName
    .replace('.musicxml', '')
    .replace('.mscz', '')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Load and display an exercise score (.musicxml or .mscz from the exercises/ folder).
function loadExercise(filePath, exerciseName) {
  const isMscz = filePath.endsWith('.mscz');
  lastScoreFile = { mscz: isMscz ? filePath : null, xml: isMscz ? null : filePath, name: exerciseName };
  urlStateSet({ item: { type: 'exercise', id: filePath } });
  _applyRendererToScore();
}

// Core render dispatcher — reads lastScoreFile + currentRenderer, picks the right
// file, syncs the toggle buttons, and fires the appropriate renderer.
function _applyRendererToScore() {
  document.getElementById('currentExercise').textContent = lastScoreFile.name;

  const osmdAvailable = !!lastScoreFile.xml;
  const pdfAvailable = !!lastScoreFile.pdf;

  // Resolve effective renderer with fallback chain:
  //   pdf   → pdf (if available), else osmd (if xml), else webmscore
  //   osmd  → osmd (if xml available), else webmscore
  //   webmscore → webmscore
  let renderer = currentRenderer;
  if (renderer === 'pdf' && !pdfAvailable) {
    renderer = osmdAvailable ? 'osmd' : 'webmscore';
  } else if (renderer === 'osmd' && !osmdAvailable) {
    renderer = 'webmscore';
  }

  document.querySelectorAll('.renderer-btn').forEach(b => {
    if (b.dataset.renderer === 'osmd') b.disabled = !osmdAvailable;
    else if (b.dataset.renderer === 'pdf') b.disabled = !pdfAvailable;
    else b.disabled = false;
    b.classList.toggle('active', b.dataset.renderer === renderer);
  });

  if (renderer === 'pdf') {
    // Show PDF view
    document.getElementById('osmdContainer').style.display = 'none';
    document.getElementById('pdfContainer').style.display = '';
    document.getElementById('zoomInBtn').style.display = '';
    document.getElementById('zoomOutBtn').style.display = '';
    document.getElementById('zoomLevel').style.display = '';
    const pdfContainer = document.getElementById('pdfContainer');
    renderPdfWithPdfjs(lastScoreFile.pdf, pdfContainer).catch(err => {
      pdfContainer.innerHTML = `<div style="padding:20px;color:#d32f2f;text-align:center">Error loading PDF<br><small>${err.message}</small></div>`;
    });
    return;
  }

  // Switch to notation view
  document.getElementById('pdfContainer').style.display = 'none';
  _loadedPdfDoc = null;
  document.getElementById('osmdContainer').style.display = '';
  document.getElementById('zoomInBtn').style.display = '';
  document.getElementById('zoomOutBtn').style.display = '';
  document.getElementById('zoomLevel').style.display = '';

  const container = document.getElementById('osmdContainer');
  container.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Loading score…</div>';

  let filePath, isMscz;
  if (renderer === 'webmscore') {
    // Prefer mscz over xml when using webmscore
    isMscz = !!lastScoreFile.mscz;
    filePath = lastScoreFile.mscz || lastScoreFile.xml;
  } else {
    filePath = lastScoreFile.xml;
    isMscz = false;
  }

  const onError = err => {
    console.error('Error loading score:', err);
    container.innerHTML = `
      <div style="padding: 20px; color: #d32f2f; text-align: center;">
        <p>Error loading score</p>
        <p style="font-size: 0.9em; color: #999;">${err.message}</p>
      </div>
    `;
  };

  if (renderer === 'webmscore') {
    renderWithWebmscore(filePath, isMscz, container).catch(onError);
  } else {
    renderWithOsmd(filePath, container).catch(onError);
  }
}

async function renderWithWebmscore(filePath, isMscz, container) {
  await WebMscore.ready;
  const response = await fetch(filePath);
  if (!response.ok) throw new Error(`Failed to load: ${filePath}`);
  const buffer = await response.arrayBuffer();

  const fmt = isMscz ? 'mscz' : 'xml';
  const score = await WebMscore.load(fmt, new Uint8Array(buffer));
  const npages = await score.npages();

  lastSvgPages = [];
  for (let i = 0; i < npages; i++) {
    lastSvgPages.push(await score.saveSvg(i, true));
  }
  score.destroy();

  _renderSvgPages(container, currentZoom / 100);
}

// Inject scaled SVG pages into the container.
function _renderSvgPages(container, zoom) {
  container.innerHTML = '';
  for (const svgText of lastSvgPages) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'score-page';
    pageDiv.innerHTML = svgText;
    const svg = pageDiv.querySelector('svg');
    if (svg) {
      // SVG natural dimensions (e.g. 2977px) always exceed the container, so
      // CSS max-width:100% would cap both zoomed and unzoomed at identical sizes.
      // Use percentage width instead so zoom is relative to the container.
      svg.style.width = (zoom * 100) + '%';
      svg.style.height = 'auto';
      svg.style.maxWidth = 'none';
      svg.style.display = 'block';
      svg.style.margin = '0 auto';
    }
    container.appendChild(pageDiv);
  }
}

async function renderWithOsmd(filePath, container) {
  const response = await fetch(filePath);
  if (!response.ok) throw new Error(`Failed to load: ${filePath}`);
  const xmlContent = await response.text();

  if (!osmd) {
    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      pageFormat: 'A4',
      drawingParameters: 'default',
    });
  } else {
    // Re-attach to container in case it was replaced
    osmd.setOptions({ container });
  }

  container.innerHTML = '';
  await osmd.load(xmlContent);
  osmd.render();
}

// Render a PDF using PDF.js — appends one <canvas> per page into container.
// container is the #pdfContainer div; it must have overflow-y:auto set in CSS.
let _pdfRenderToken = 0;  // incremented each load so stale renders abort early
let _loadedPdfDoc = null; // cached pdf document for zoom re-renders without re-fetching

async function renderPdfWithPdfjs(filePath, container) {
  const token = ++_pdfRenderToken;
  container.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">Loading PDF…</div>';

  // pdf.min.js exposes pdfjsLib as a global; point its worker to our local copy.
  const lib = window.pdfjsLib;
  if (!lib) throw new Error('PDF.js not loaded');
  lib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

  const pdf = await lib.getDocument(filePath).promise;
  if (token !== _pdfRenderToken) return;  // superseded by a newer load

  _loadedPdfDoc = pdf;
  container.innerHTML = '';  // clear "Loading PDF…"
  await _drawPdfPages(pdf, container, token);
}

// Re-render cached PDF at current zoom — called by applyZoom when in PDF view.
async function _drawPdfPages(pdf, container, token) {
  container.innerHTML = '';
  const zoomFactor = currentZoom / 100;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (token !== _pdfRenderToken) return;  // superseded

    const page = await pdf.getPage(pageNum);
    // Base scale fits page to container width; zoomFactor scales on top of that.
    const containerWidth = container.clientWidth || 800;
    const viewport = page.getViewport({ scale: 1 });
    const baseScale = (containerWidth - 24) / viewport.width;
    const scaledViewport = page.getViewport({ scale: baseScale * zoomFactor });

    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'score-page pdf-page';
    pageWrapper.style.marginBottom = '8px';

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(scaledViewport.width);
    canvas.height = Math.floor(scaledViewport.height);
    canvas.style.display = 'block';
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';

    pageWrapper.appendChild(canvas);
    container.appendChild(pageWrapper);

    await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise;
  }
}

// Load and display a PDF reference book
function loadPdf(filePath, bookName, _skipUrlState) {
  if (!_skipUrlState) urlStateSet({ item: { type: 'pdf', id: filePath } });
  // Switch to PDF view
  document.getElementById('osmdContainer').style.display = 'none';
  document.getElementById('pdfContainer').style.display = '';
  document.getElementById('zoomInBtn').style.display = '';
  document.getElementById('zoomOutBtn').style.display = '';
  document.getElementById('zoomLevel').style.display = '';

  document.getElementById('currentExercise').textContent = bookName;

  const pdfContainer = document.getElementById('pdfContainer');
  renderPdfWithPdfjs(filePath, pdfContainer).catch(err => {
    pdfContainer.innerHTML = `<div style="padding:20px;color:#d32f2f;text-align:center">Error loading PDF<br><small>${err.message}</small></div>`;
  });
}

// Setup zoom controls
function setupZoomControls() {
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 10, 200);
    applyZoom(currentZoom / 100);
    urlStateSet({ zoom: currentZoom });
  });

  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 10, 50);
    applyZoom(currentZoom / 100);
    urlStateSet({ zoom: currentZoom });
  });
}

// Apply zoom level
function applyZoom(zoomValue) {
  document.getElementById('zoomLevel').textContent = `${Math.round(zoomValue * 100)}%`;
  if (currentRenderer === 'pdf') {
    if (_loadedPdfDoc) {
      const token = ++_pdfRenderToken;
      const container = document.getElementById('pdfContainer');
      _drawPdfPages(_loadedPdfDoc, container, token);
    }
    return;
  }
  if (currentRenderer === 'webmscore') {
    if (lastSvgPages.length > 0) {
      _renderSvgPages(document.getElementById('osmdContainer'), zoomValue);
    }
  } else if (osmd) {
    osmd.zoom = zoomValue;
    osmd.render();
  }
}

// Renderer toggle
function setupRendererToggle() {
  document.querySelectorAll('.renderer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chosen = btn.dataset.renderer;
      if (chosen === currentRenderer || btn.disabled) return;
      currentRenderer = chosen;
      // Reset OSMD instance when switching away from osmd so it re-attaches cleanly
      if (chosen !== 'osmd') osmd = null;
      // Clear any CSS transform applied by webmscore zoom when switching to OSMD or PDF
      if (chosen === 'osmd' || chosen === 'pdf') {
        const c = document.getElementById('osmdContainer');
        c.style.transform = '';
        c.style.transformOrigin = '';
        c.style.width = '';
      }
      // Also clear stored SVG pages so stale zoom doesn't bleed across
      lastSvgPages = [];
      // Also reset zoom level to 100% on renderer switch to avoid stale scale
      currentZoom = 100;
      document.getElementById('zoomLevel').textContent = '100%';
      urlStateSet({ renderer: chosen, zoom: 100 });
      if (lastScoreFile) {
        _applyRendererToScore();
      } else {
        document.querySelectorAll('.renderer-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.renderer === chosen)
        );
      }
    });
  });
}

// Search / filter sidebar items
function setupSearch() {
  const input = document.getElementById('sidebarSearch');

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    const exercisesList = document.getElementById('exercisesList');

    if (!query) {
      // Restore default state: show all items, keep categories expanded
      exercisesList.querySelectorAll('.exercise-item').forEach(item => {
        item.style.display = '';
      });
      exercisesList.querySelectorAll('.exercise-category').forEach(cat => {
        cat.style.display = '';
      });
      exercisesList.querySelectorAll('.section-divider').forEach(div => {
        div.style.display = '';
      });
      exercisesList.querySelectorAll('.exercise-items').forEach(group => {
        group.classList.add('show');
      });
      return;
    }

    // Filter each item; hide categories with zero visible children
    exercisesList.querySelectorAll('.exercise-category').forEach(cat => {
      const items = cat.querySelectorAll('.exercise-item');
      let anyVisible = false;

      items.forEach(item => {
        const matches = item.textContent.toLowerCase().includes(query);
        item.style.display = matches ? '' : 'none';
        if (matches) anyVisible = true;
      });

      cat.style.display = anyVisible ? '' : 'none';
      // Expand groups so matches are visible
      cat.querySelectorAll('.exercise-items').forEach(group => {
        if (anyVisible) group.classList.add('show');
      });
    });

    // Always show section dividers that precede visible categories
    exercisesList.querySelectorAll('.section-divider').forEach(divider => {
      // Look for the next sibling category
      let next = divider.nextElementSibling;
      let hasVisible = false;
      while (next && !next.classList.contains('section-divider')) {
        if (next.classList.contains('exercise-category') && next.style.display !== 'none') {
          hasVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      divider.style.display = hasVisible ? '' : 'none';
    });
  });
}

// ─── Right Panel Tab Switching ────────────────────────────────────────────────
function setupRightTabs() {
  document.querySelectorAll('.right-tab').forEach(btn => {
    btn.addEventListener('click', () => switchRightTab(btn.dataset.tab));
  });
}

function switchRightTab(tabName, _skipUrlState) {
  document.querySelectorAll('.right-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName)
  );
  document.querySelectorAll('.right-tab-content').forEach(c =>
    c.classList.toggle('active', c.id === tabName + 'Tab')
  );
  if (!_skipUrlState) urlStateSet({ tab: tabName });
}

// ─── Music Player ─────────────────────────────────────────────────────────────
function playerFormatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function loadTune(tune, _skipUrlState) {
  // Switch right panel to player tab
  switchRightTab('player', _skipUrlState);
  if (!_skipUrlState) urlStateSet({ item: { type: 'tune', id: tune.name } });

  // Show score in center if available, otherwise placeholder
  const msczPath = tune.score_mscz ? tune.score_mscz.split('/').map(encodeURIComponent).join('/') : null;
  const xmlPath = tune.score_musicxml ? tune.score_musicxml.split('/').map(encodeURIComponent).join('/') : null;
  const pdfPath = tune.score_pdf ? tune.score_pdf.split('/').map(encodeURIComponent).join('/') : null;
  if (msczPath || xmlPath || pdfPath) {
    lastScoreFile = { mscz: msczPath, xml: xmlPath, pdf: pdfPath, name: tune.name };
    // Default to pdf renderer when pdf is available (unless restoring from URL)
    if (!_skipUrlState && pdfPath) currentRenderer = 'pdf';
    _applyRendererToScore();
  } else {
    showCenterPlaceholder(tune.name);
  }

  // Stop and tear down previous playback
  stopPlayback();
  clearPlayerState();

  const loadingEl = document.getElementById('playerLoading');
  const tracksEl = document.getElementById('playerTracks');
  const transportEl = document.getElementById('playerTransport');

  tracksEl.innerHTML = '';
  transportEl.classList.add('disabled');
  loadingEl.style.display = 'block';

  const stems = tune.stems || [];
  if (stems.length === 0) {
    loadingEl.textContent = 'No audio stems found.';
    return;
  }

  let loadedCount = 0;
  leaderLabel = stems[0].label;

  // Pre-render track rows in stable order before any audio loads
  stems.forEach(stem => tracksEl.appendChild(buildTrackToggle(stem)));

  stems.forEach(stem => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = stem.path;
    audio.volume = stemEnabled[stem.label] === false ? 0 : masterVolume;
    stemAudios[stem.label] = audio;
    stemEnabled[stem.label] = true;

    const onReady = () => {
      loadedCount++;
      if (audio.duration > playerDuration) playerDuration = audio.duration;

      if (loadedCount === stems.length || loadedCount === 1) {
        // Enable transport as soon as at least one stem is ready
        loadingEl.style.display = 'none';
        const seekEl = document.getElementById('transportSeek');
        seekEl.max = playerDuration > 0 ? playerDuration : 100;
        seekEl.value = 0;
        document.getElementById('transportDuration').textContent = playerFormatTime(playerDuration);
        document.getElementById('transportCurrent').textContent = '0:00';
        transportEl.classList.remove('disabled');
      }

      // Once all stems are loaded, apply any persisted stem-enable states and position
      if (loadedCount === stems.length) {
        const saved = urlStateGet().player;
        if (saved && saved.position > 0) {
          seekAllTo(saved.position);
          updateSeekUI(saved.position);
        }
        if (saved && saved.stems) {
          Object.entries(saved.stems).forEach(([label, enabled]) => {
            if (label in stemEnabled) {
              stemEnabled[label] = enabled;
              const audio = stemAudios[label];
              if (audio) audio.volume = enabled ? masterVolume : 0;
              // Reflect in the track row UI
              const trackEl = document.getElementById('playerTracks')
                .querySelector(`.player-track[data-label="${CSS.escape(label)}"]`);
              if (trackEl) {
                trackEl.classList.toggle('active', enabled);
                const toggleBtn = trackEl.querySelector('.track-toggle-btn');
                if (toggleBtn) {
                  toggleBtn.textContent = enabled ? '✓' : '✗';
                  toggleBtn.setAttribute('aria-pressed', String(enabled));
                }
              }
            }
          });
        }
      }
    };

    audio.addEventListener('loadedmetadata', onReady, { once: true });
    audio.addEventListener('error', () => {
      console.warn(`Could not load stem "${stem.label}"`);
      loadedCount++;
      if (loadedCount === stems.length) loadingEl.style.display = 'none';
    }, { once: true });

    // Wire ended event on leader
    if (stem.label === leaderLabel) {
      audio.addEventListener('ended', () => {
        Object.values(stemAudios).forEach(a => { a.pause(); try { a.currentTime = 0; } catch { } });
        isPlaying = false;
        updateSeekUI(0);
        document.getElementById('playPauseBtn').textContent = '▶';
        stopRAF();
        const _ep = urlStateGet().player || {};
        urlStateSet({ player: Object.assign({}, _ep, { position: 0 }) });
      });
    }
  });
}

function buildTrackToggle(stem) {
  const el = document.createElement('div');
  el.className = 'player-track active';
  el.dataset.label = stem.label;
  el.innerHTML = `
    <span class="track-icon">${stem.icon}</span>
    <span class="track-label">${stem.label}</span>
    <button class="track-toggle-btn" title="Toggle track" aria-pressed="true">✓</button>
  `;

  const btn = el.querySelector('.track-toggle-btn');
  btn.addEventListener('click', () => {
    stemEnabled[stem.label] = !stemEnabled[stem.label];
    const enabled = stemEnabled[stem.label];
    const audio = stemAudios[stem.label];
    if (audio) audio.volume = enabled ? masterVolume : 0;
    el.classList.toggle('active', enabled);
    btn.textContent = enabled ? '✓' : '✗';
    btn.setAttribute('aria-pressed', String(enabled));
    // Persist stem states whenever one is toggled
    urlStateSet({ player: { stems: Object.assign({}, stemEnabled) } });
  });

  return el;
}

function seekAllTo(t) {
  Object.values(stemAudios).forEach(a => { try { a.currentTime = t; } catch { } });
}

function startPlayback(t) {
  const pos = t !== undefined ? Math.max(0, Math.min(t, playerDuration)) : getCurrentPosition();
  seekAllTo(pos);
  Object.entries(stemAudios).forEach(([label, audio]) => {
    audio.volume = stemEnabled[label] ? masterVolume : 0;
    audio.play().catch(() => { });
  });
  isPlaying = true;
  document.getElementById('playPauseBtn').textContent = '⏸';
  startRAF();
}

function pausePlayback() {
  Object.values(stemAudios).forEach(a => a.pause());
  isPlaying = false;
  document.getElementById('playPauseBtn').textContent = '▶';
  stopRAF();
  const _pp = urlStateGet().player || {};
  urlStateSet({ player: Object.assign({}, _pp, { position: getCurrentPosition() }) });
}

function stopPlayback() {
  Object.values(stemAudios).forEach(a => { a.pause(); try { a.currentTime = 0; } catch { } });
  isPlaying = false;
  stopRAF();
}

function clearPlayerState() {
  // Detach all audio elements
  Object.values(stemAudios).forEach(a => { a.pause(); a.src = ''; });
  Object.keys(stemAudios).forEach(k => delete stemAudios[k]);
  Object.keys(stemEnabled).forEach(k => delete stemEnabled[k]);
  playerDuration = 0;
  isPlaying = false;
  leaderLabel = null;
}

function getCurrentPosition() {
  const leader = leaderLabel && stemAudios[leaderLabel];
  return leader ? leader.currentTime : 0;
}

function startRAF() {
  stopRAF();
  const tick = () => {
    if (!isPlaying) return;
    const pos = getCurrentPosition();
    updateSeekUI(pos);
    if (autoScroll && playerDuration > 0) {
      // ── Notation view auto-scroll ──────────────────────────────────────────
      const notationContainer = document.querySelector('.notation-container');
      if (notationContainer) {
        const maxScroll = notationContainer.scrollHeight - notationContainer.clientHeight;
        notationContainer.scrollTop = (pos / playerDuration) * maxScroll;
      }
      // ── PDF view auto-scroll ───────────────────────────────────────────────
      // PDF pages are rendered as stacked canvases so scrollTop works identically.
      const pdfContainer = document.getElementById('pdfContainer');
      if (pdfContainer && pdfContainer.style.display !== 'none') {
        const maxScroll = pdfContainer.scrollHeight - pdfContainer.clientHeight;
        if (maxScroll > 0) pdfContainer.scrollTop = (pos / playerDuration) * maxScroll;
      }
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function setupAutoScrollToggle() {
  const btn = document.getElementById('autoScrollBtn');
  if (!btn) return;
  btn.classList.toggle('active', autoScroll);
  btn.addEventListener('click', () => {
    autoScroll = !autoScroll;
    btn.classList.toggle('active', autoScroll);
    btn.title = autoScroll ? 'Auto-scroll: on' : 'Auto-scroll: off';
    urlStateSet({ autoScroll });
  });
}

function stopRAF() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function updateSeekUI(pos) {
  document.getElementById('transportSeek').value = pos;
  document.getElementById('transportCurrent').textContent = playerFormatTime(pos);
}

function setupPlayer() {
  // Start in disabled state until a tune is loaded
  document.getElementById('playerTransport').classList.add('disabled');

  document.getElementById('playPauseBtn').addEventListener('click', () => {
    if (Object.keys(stemAudios).length === 0) return;
    isPlaying ? pausePlayback() : startPlayback();
  });

  document.getElementById('seekBackBtn').addEventListener('click', () => {
    const pos = Math.max(0, getCurrentPosition() - 10);
    if (isPlaying) { startPlayback(pos); } else { seekAllTo(pos); updateSeekUI(pos); const _bp = urlStateGet().player || {}; urlStateSet({ player: Object.assign({}, _bp, { position: pos }) }); }
  });

  document.getElementById('seekFwdBtn').addEventListener('click', () => {
    const pos = Math.min(playerDuration, getCurrentPosition() + 10);
    if (isPlaying) { startPlayback(pos); } else { seekAllTo(pos); updateSeekUI(pos); const _fp = urlStateGet().player || {}; urlStateSet({ player: Object.assign({}, _fp, { position: pos }) }); }
  });

  const seekEl = document.getElementById('transportSeek');
  let wasPlayingBeforeSeek = false;
  seekEl.addEventListener('pointerdown', () => {
    wasPlayingBeforeSeek = isPlaying;
    if (isPlaying) pausePlayback();
  });
  seekEl.addEventListener('input', () => {
    seekAllTo(+seekEl.value);
    updateSeekUI(+seekEl.value);
  });
  seekEl.addEventListener('pointerup', () => {
    if (wasPlayingBeforeSeek) { startPlayback(+seekEl.value); } else { const _sp = urlStateGet().player || {}; urlStateSet({ player: Object.assign({}, _sp, { position: +seekEl.value }) }); }
  });
}

function showCenterPlaceholder(name) {
  document.getElementById('pdfContainer').style.display = 'none';
  document.getElementById('osmdContainer').style.display = '';
  document.getElementById('zoomInBtn').style.display = 'none';
  document.getElementById('zoomOutBtn').style.display = 'none';
  document.getElementById('zoomLevel').style.display = 'none';
  document.getElementById('currentExercise').textContent = name;
  document.getElementById('osmdContainer').innerHTML = `
    <div style="padding: 60px 40px; text-align: center; color: #ccc;">
      <div style="font-size: 3.5em; margin-bottom: 16px;">🎵</div>
      <p style="font-size: 1em; color: #bbb;">No score available for this tune</p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Metronome postMessage bridge ─────────────────────────────────────────────
// METRONOME_READY: the iframe fires this when its DOMContentLoaded runs, so we
// know it's safe to send RESTORE_STATE (eliminates the iframe load-race).
// (METRONOME_STATE_CHANGED is no longer used — the metronome writes the hash directly.)
window.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'METRONOME_READY') {
    const iframe = document.querySelector('.metronome-iframe');
    // Send current theme so the iframe matches from the start
    if (iframe && iframe.contentWindow) {
      const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      iframe.contentWindow.postMessage({ type: 'APPLY_THEME', theme }, '*');
    }
    if (_pendingMetronomeRestore) {
      if (iframe) {
        iframe.contentWindow.postMessage(
          { type: 'RESTORE_STATE', state: _pendingMetronomeRestore }, '*'
        );
      }
      _pendingMetronomeRestore = null;
    }
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Spacebar: toggle play/pause (skip when focus is inside an input)
  if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    if (Object.keys(stemAudios).length > 0) {
      isPlaying ? pausePlayback() : startPlayback();
    }
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      document.getElementById('zoomInBtn').click();
    } else if (e.key === '-') {
      e.preventDefault();
      document.getElementById('zoomOutBtn').click();
    }
  }
});

// Handle scroll wheel zoom
document.getElementById('osmdContainer')?.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      document.getElementById('zoomInBtn').click();
    } else {
      document.getElementById('zoomOutBtn').click();
    }
  }
});
