// Store exercise data
const exercises = {
  categories: []
};

const OpenSheetMusicDisplay = window.opensheetmusicdisplay?.OpenSheetMusicDisplay;
let currentZoom = 100;
let osmd = null;

// Exercise structure definition
const exerciseStructure = [
  {
    name: '16th Note Accent',
    key: '16th-note-accent-exercises',
    path: '../../exercises/16th-note-accent-exercises/resources'
  },
  {
    name: '8th Note Triplet Accent',
    key: '8th-note-triplet-accent-exercises',
    path: '../../exercises/8th-note-triplet-accent-exercises/resources'
  },
  {
    name: 'Accent Grids',
    key: 'accent-grids',
    path: '../../exercises/accent-grids/resources'
  }
];

// Exercise files mapping
const exerciseFiles = {
  '16th-note-accent-exercises': [
    'single-accent.musicxml',
    'double-accent.musicxml',
    'triple-accent.musicxml',
    'mixed-accents-1.musicxml',
    'mixed-accents-2.musicxml',
    'mixed-accents-3.musicxml'
  ],
  '8th-note-triplet-accent-exercises': [
    'single-accent.musicxml',
    'double-accent.musicxml',
    'triple-accent.musicxml',
    'mixed-accents-1.musicxml',
    'mixed-accents-2.musicxml',
    'mixed-accents-3.musicxml',
    'mixed-accents-4.musicxml',
    'mixed-accents-5.musicxml',
    'mixed-accents-6.musicxml'
  ],
  'accent-grids': [
    '16th-note.musicxml',
    '8th-note-triplet.musicxml'
  ]
};

// Initialize the hub
document.addEventListener('DOMContentLoaded', async () => {
  // Show loading status
  const container = document.getElementById('osmdContainer');
  container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">⏳ Loading notation engine...</div>';

  try {
    // Clear loading message
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Select an exercise to begin</div>';

    // Setup UI
    populateExercises();
    setupZoomControls();
  } catch (error) {
    container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #d32f2f;">
                <p>⚠️ Failed to load notation engine</p>
                <p style="font-size: 0.9em; color: #999;">Please refresh the page and try again</p>
            </div>
        `;
    console.error('OSMD initialization error:', error);
  }
});

// Populate exercise list in sidebar
function populateExercises() {
  const exercisesList = document.getElementById('exercisesList');
  exercisesList.innerHTML = '';

  exerciseStructure.forEach(category => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'exercise-category';

    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'category-title expanded';
    categoryTitle.textContent = category.name;

    const exerciseItems = document.createElement('div');
    exerciseItems.className = 'exercise-items show';

    const files = exerciseFiles[category.key] || [];
    files.forEach(file => {
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
