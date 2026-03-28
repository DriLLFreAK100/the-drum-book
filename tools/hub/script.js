// Store exercise data
const exercises = {
  categories: []
};

const OpenSheetMusicDisplay = window.opensheetmusicdisplay?.OpenSheetMusicDisplay;
let currentZoom = 100;
let osmd = null;

// ─── Music Player State ───────────────────────────────────────────────────────
// Uses HTMLAudioElement per stem — no fetch needed, works on file:// protocol.
const stemAudios = {};    // label → HTMLAudioElement
const stemEnabled = {};   // label → boolean
let playerDuration = 0;
let isPlaying = false;
let masterVolume = 1;
let rafId = null;
let leaderLabel = null;   // label of the primary audio element used for time tracking
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
    setupZoomControls();
    setupSearch();
    setupPlayer();
    setupRightTabs();
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

    manifest.musics.forEach(tune => {
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
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Load and display exercise using OSMD
async function loadExercise(filePath, exerciseName) {
  // Switch to notation view
  document.getElementById('pdfContainer').style.display = 'none';
  document.getElementById('osmdContainer').style.display = '';
  document.getElementById('zoomInBtn').style.display = '';
  document.getElementById('zoomOutBtn').style.display = '';
  document.getElementById('zoomLevel').style.display = '';

  try {
    const container = document.getElementById('osmdContainer');
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Loading exercise...</div>';

    document.getElementById('currentExercise').textContent = exerciseName;

    // Fetch the MusicXML file
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load: ${filePath}`);
    }

    const xmlContent = await response.text();

    // Initialize OSMD if not already done
    if (!osmd) {
      container.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Loading exercise...</div>';

      osmd = new OpenSheetMusicDisplay(container, {
        autoResize: true,
        pageFormat: 'A4',
        drawingParameters: 'default'
      });
    }

    // Clear previous content
    container.innerHTML = '';

    // Load and render the MusicXML
    await osmd.load(xmlContent);
    osmd.render();

  } catch (error) {
    console.error('Error loading exercise:', error);
    document.getElementById('osmdContainer').innerHTML = `
            <div style="padding: 20px; color: #d32f2f; text-align: center;">
                <p>Error loading exercise</p>
                <p style="font-size: 0.9em; color: #999;">${error.message}</p>
            </div>
        `;
  }
}

// Load and display a PDF reference book
function loadPdf(filePath, bookName) {
  // Switch to PDF view
  document.getElementById('osmdContainer').style.display = 'none';
  document.getElementById('pdfContainer').style.display = '';
  document.getElementById('zoomInBtn').style.display = 'none';
  document.getElementById('zoomOutBtn').style.display = 'none';
  document.getElementById('zoomLevel').style.display = 'none';

  document.getElementById('currentExercise').textContent = bookName;

  const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  document.getElementById('pdfFrame').src = encodedPath;
}

// Setup zoom controls
function setupZoomControls() {
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 10, 200);
    applyZoom(currentZoom / 100);
  });

  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 10, 50);
    applyZoom(currentZoom / 100);
  });
}

// Apply zoom level
function applyZoom(zoomValue) {
  if (!osmd) return;
  osmd.zoom = zoomValue;
  osmd.render();
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

function switchRightTab(tabName) {
  document.querySelectorAll('.right-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName)
  );
  document.querySelectorAll('.right-tab-content').forEach(c =>
    c.classList.toggle('active', c.id === tabName + 'Tab')
  );
}

// ─── Music Player ─────────────────────────────────────────────────────────────
function playerFormatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function loadTune(tune) {
  // Switch right panel to player tab
  switchRightTab('player');

  // Show score in center if available, otherwise placeholder
  if (tune.score) {
    const encodedScore = tune.score.split('/').map(encodeURIComponent).join('/');
    loadExercise(encodedScore, tune.name);
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
      tracksEl.appendChild(buildTrackToggle(stem));

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
        isPlaying = false;
        seekAllTo(0);
        updateSeekUI(0);
        document.getElementById('playPauseBtn').textContent = '▶';
        stopRAF();
      });
    }
  });
}

function buildTrackToggle(stem) {
  const el = document.createElement('div');
  el.className = 'player-track active';
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
    updateSeekUI(getCurrentPosition());
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
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
    isPlaying ? startPlayback(pos) : (seekAllTo(pos), updateSeekUI(pos));
  });

  document.getElementById('seekFwdBtn').addEventListener('click', () => {
    const pos = Math.min(playerDuration, getCurrentPosition() + 10);
    isPlaying ? startPlayback(pos) : (seekAllTo(pos), updateSeekUI(pos));
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
    if (wasPlayingBeforeSeek) startPlayback(+seekEl.value);
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
