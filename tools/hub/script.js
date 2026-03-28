// Store exercise data
const exercises = {
  categories: []
};

const OpenSheetMusicDisplay = window.opensheetmusicdisplay?.OpenSheetMusicDisplay;
let currentZoom = 100;
let osmd = null;

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

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
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
