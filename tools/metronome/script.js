// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙 Dark' : '☀ Light';
  localStorage.setItem('theme', theme);
}

function setupTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);

  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      // If running as standalone (not in iframe), no need to notify parent
    });
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Audio context
let audioContext = null;

// Metronome state
let metronomeState = {
  isPlaying: false,
  tempo: 120,
  timeSignature: '4/4',
  soundPalette: 'metronome',
  basePitch: 700,
  currentBeat: 0,
  nextNoteTime: 0,
  scheduleAheadTime: 0.1,
  lookAhead: 25,
  timerID: null,
  beatTones: {}, // Store tone pitch for each beat: "sig_beatNum": pitch
  beatMutes: {}, // Store muted beats: "sig_beatNum": true/false
  accentFirstBeat: true, // Whether beat 1 plays with a different (accented) tone
};

// Pitch range configurations for each sound palette
const palettePitchRanges = {
  'woodenblock': { min: 150, max: 400, default: 250 },
  'cowbell': { min: 300, max: 800, default: 550 },
  'metronome': { min: 400, max: 1000, default: 700 },
  'beep': { min: 600, max: 1500, default: 1000 }
};

// Time signature configurations
const timeSignatures = {
  '4/4': 4,
  '3/4': 3,
  '5/4': 5,
  '12/8': 12,
  '7/8': 7,
  '9/8': 9,
  '15/16': 15,
};

// Knob rotation state — module-level so RESTORE_STATE can update it
let knobCurrentRotation = 0;

// Set the knob visual to match a given tempo value
function applyTempoToKnob(tempo) {
  const minTempo = 40, maxTempo = 240, rotationRange = 270;
  knobCurrentRotation = ((tempo - minTempo) / (maxTempo - minTempo)) * rotationRange;
  document.getElementById('tempoKnob').style.transform = `rotate(${knobCurrentRotation}deg)`;
}

// Initialize audio context
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Generate cleaner wooden tick sound
function playWoodenBlock(time = 0, isAccent = false, pitchOverride = null) {
  const ctx = initAudioContext();
  const pitch = pitchOverride !== null ? pitchOverride : metronomeState.basePitch;

  const attackTime = 0.008;
  const decayTime = isAccent ? 0.12 : 0.08;
  const volume = isAccent ? 0.7 : 0.5;

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = pitch;

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 200;
  hpFilter.Q.value = 4;

  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.value = 3000;
  lpFilter.Q.value = 2;

  const gainEnv = ctx.createGain();

  const bufferSize = ctx.sampleRate * 0.05;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = isAccent ? 0.15 : 0.08;

  osc1.connect(hpFilter);
  hpFilter.connect(lpFilter);
  lpFilter.connect(gainEnv);

  noiseSource.connect(noiseGain);
  noiseGain.connect(gainEnv);

  gainEnv.connect(ctx.destination);

  gainEnv.gain.setValueAtTime(0, time);
  gainEnv.gain.linearRampToValueAtTime(volume, time + attackTime);
  gainEnv.gain.exponentialRampToValueAtTime(0.01, time + attackTime + decayTime);

  osc1.start(time);
  osc1.stop(time + attackTime + decayTime);

  noiseSource.start(time);
  noiseSource.stop(time + attackTime + decayTime);
}

// Cowbell sound (bright, metallic)
function playCowbell(time = 0, isAccent = false, pitchOverride = null) {
  const ctx = initAudioContext();
  const pitch = pitchOverride !== null ? pitchOverride : metronomeState.basePitch; // Cowbell uses base pitch

  const attackTime = 0.01;
  const decayTime = isAccent ? 0.2 : 0.12;
  const volume = isAccent ? 0.6 : 0.4;

  // Two oscillators for cowbell character
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = pitch;

  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = pitch * 1.5; // Higher harmonic

  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.value = 4000;
  lpFilter.Q.value = 3;

  const gainEnv = ctx.createGain();
  const osc2Gain = ctx.createGain();
  osc2Gain.gain.value = 0.3;

  osc1.connect(lpFilter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(lpFilter);
  lpFilter.connect(gainEnv);

  gainEnv.connect(ctx.destination);

  gainEnv.gain.setValueAtTime(0, time);
  gainEnv.gain.linearRampToValueAtTime(volume, time + attackTime);
  gainEnv.gain.exponentialRampToValueAtTime(0.02, time + attackTime + decayTime);

  osc1.start(time);
  osc1.stop(time + attackTime + decayTime);

  osc2.start(time);
  osc2.stop(time + attackTime + decayTime);
}

// Classic metronome machine sound
function playMetronome(time = 0, isAccent = false, pitchOverride = null) {
  const ctx = initAudioContext();

  const attackTime = 0.005;
  const decayTime = isAccent ? 0.08 : 0.05;

  // Accent beats use higher pitch (scale by 1.33)
  const basePitch = pitchOverride !== null ? pitchOverride : metronomeState.basePitch;
  const pitch = isAccent ? basePitch * 1.33 : basePitch;
  const volume = isAccent ? 0.8 : 0.6;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = pitch;

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 400;
  hpFilter.Q.value = 6;

  const gainEnv = ctx.createGain();

  osc.connect(hpFilter);
  hpFilter.connect(gainEnv);
  gainEnv.connect(ctx.destination);

  gainEnv.gain.setValueAtTime(0, time);
  gainEnv.gain.linearRampToValueAtTime(volume, time + attackTime);
  gainEnv.gain.exponentialRampToValueAtTime(0.01, time + attackTime + decayTime);

  osc.start(time);
  osc.stop(time + attackTime + decayTime);
}

// Electronic beep sound
function playBeep(time = 0, isAccent = false, pitchOverride = null) {
  const ctx = initAudioContext();
  const pitch = pitchOverride !== null ? pitchOverride : metronomeState.basePitch;

  const attackTime = 0.015;
  const decayTime = isAccent ? 0.1 : 0.06;
  const volume = isAccent ? 0.7 : 0.5;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = pitch;

  const gainEnv = ctx.createGain();

  osc.connect(gainEnv);
  gainEnv.connect(ctx.destination);

  gainEnv.gain.setValueAtTime(0, time);
  gainEnv.gain.linearRampToValueAtTime(volume, time + attackTime);
  gainEnv.gain.exponentialRampToValueAtTime(0.02, time + attackTime + decayTime);

  osc.start(time);
  osc.stop(time + attackTime + decayTime);
}

// Main sound dispatcher
function playWoodenTick(time = 0, isAccent = false, pitchOverride = null) {
  switch (metronomeState.soundPalette) {
    case 'woodenblock':
      playWoodenBlock(time, isAccent, pitchOverride);
      break;
    case 'cowbell':
      playCowbell(time, isAccent, pitchOverride);
      break;
    case 'metronome':
      playMetronome(time, isAccent, pitchOverride);
      break;
    case 'beep':
      playBeep(time, isAccent, pitchOverride);
      break;
    default:
      playWoodenBlock(time, isAccent, pitchOverride);
  }
}

// Update pitch slider range and value based on selected palette
function updatePitchSliderRange(palette) {
  const pitchSlider = document.getElementById('pitchSlider');
  const range = palettePitchRanges[palette];

  if (range) {
    pitchSlider.min = range.min;
    pitchSlider.max = range.max;
    pitchSlider.value = range.default;
    metronomeState.basePitch = range.default;
    document.getElementById('pitchValue').textContent = range.default;
  }
}

// Schedule next beat
function scheduleNextBeat() {
  const beatsPerBar = timeSignatures[metronomeState.timeSignature];

  // Schedule beats within look-ahead window
  while (metronomeState.nextNoteTime < audioContext.currentTime + metronomeState.scheduleAheadTime) {
    scheduleNote(metronomeState.currentBeat, metronomeState.nextNoteTime);

    // Advance beat
    metronomeState.currentBeat = (metronomeState.currentBeat + 1) % beatsPerBar;
    metronomeState.nextNoteTime += (60.0 / metronomeState.tempo);
  }
}

// Schedule a note with custom tone support
function scheduleNote(beatNumber, time) {
  const isAccent = beatNumber === 0 && metronomeState.accentFirstBeat; // First beat is accented (if enabled)
  const sigKey = `${metronomeState.timeSignature}_${beatNumber}`;
  const customPitch = metronomeState.beatTones[sigKey];
  const isMuted = metronomeState.beatMutes[sigKey]; // Check if beat is muted

  // Play sound with custom pitch if set, unless muted
  if (!isMuted) {
    playWoodenTick(time, isAccent, customPitch);
  }

  // Update UI
  setTimeout(() => {
    updateBeatDisplay(beatNumber);
  }, (time - audioContext.currentTime) * 1000);
}

// Update beat display
function updateBeatDisplay(beatNumber) {
  const beatsPerBar = timeSignatures[metronomeState.timeSignature];
  const beatDisplay = document.getElementById('beatDisplay');

  // Clear previous
  beatDisplay.innerHTML = '';

  // Create beat dots
  for (let i = 0; i < beatsPerBar; i++) {
    const dot = document.createElement('div');
    dot.className = 'beat-dot';

    // First beat is accent
    if (i === 0) {
      dot.classList.add('accent');
    }

    // Check if beat is muted
    const sigKey = `${metronomeState.timeSignature}_${i}`;
    if (metronomeState.beatMutes[sigKey]) {
      dot.classList.add('muted');
    }

    // Highlight current beat
    if (i === beatNumber) {
      dot.classList.add('active');
    }

    beatDisplay.appendChild(dot);
  }

  // Update beat label
  document.getElementById('beatLabel').textContent = `Beat ${beatNumber + 1} / ${beatsPerBar}`;
}

// Main metronome loop
function metronomeLoop() {
  scheduleNextBeat();
}

// Start metronome
function startMetronome() {
  if (metronomeState.isPlaying) return;

  initAudioContext();

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  metronomeState.isPlaying = true;
  metronomeState.currentBeat = 0;
  metronomeState.nextNoteTime = audioContext.currentTime;

  // Start scheduling
  metronomeState.timerID = setInterval(metronomeLoop, metronomeState.lookAhead);

  // Update UI
  document.getElementById('playBtn').textContent = '⏸ Pause';
  document.getElementById('playBtn').classList.add('playing');
}

// Stop metronome
function stopMetronome() {
  metronomeState.isPlaying = false;

  if (metronomeState.timerID) {
    clearInterval(metronomeState.timerID);
    metronomeState.timerID = null;
  }

  // Clear display
  document.getElementById('beatDisplay').innerHTML = '';
  document.getElementById('beatLabel').textContent = 'Ready';

  // Update UI
  document.getElementById('playBtn').textContent = '▶ Start';
  document.getElementById('playBtn').classList.remove('playing');
}

// Infinite turnable knob interaction
function setupKnobControl() {
  const knob = document.getElementById('tempoKnob');
  let isRotating = false;
  let startAngle = 0;

  const minTempo = 40;
  const maxTempo = 240;
  const rotationRange = 270; // Use 270 degrees for infinite feel

  function getAngleFromEvent(e) {
    const rect = knob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  }

  function updateTempo() {
    // Map total rotation to tempo range (infinite rotation)
    const rotation = knobCurrentRotation % 360;
    const normRotation = ((rotation % 360) + 360) % 360;
    const tempoRange = maxTempo - minTempo;
    const tempoPosition = (normRotation / rotationRange) * tempoRange;
    const tempo = Math.round(minTempo + tempoPosition);

    metronomeState.tempo = Math.max(minTempo, Math.min(maxTempo, tempo));

    // Visual rotation (shows infinite turns)
    document.getElementById('tempoKnob').style.transform = `rotate(${knobCurrentRotation}deg)`;
    document.getElementById('bpmValue').value = metronomeState.tempo;
    _postStateToHub();
  }

  knob.addEventListener('mousedown', (e) => {
    isRotating = true;
    startAngle = getAngleFromEvent(e);
  });

  knob.addEventListener('touchstart', (e) => {
    isRotating = true;
    startAngle = getAngleFromEvent(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (!isRotating) return;

    const currentAngle = getAngleFromEvent(e);
    let angleDiff = currentAngle - startAngle;

    // Handle wraparound (when angle goes from 180 to -180 or vice versa)
    if (angleDiff > 180) {
      angleDiff -= 360;
    } else if (angleDiff < -180) {
      angleDiff += 360;
    }

    knobCurrentRotation += angleDiff;
    startAngle = currentAngle;

    updateTempo();
  });

  document.addEventListener('touchmove', (e) => {
    if (!isRotating) return;

    const currentAngle = getAngleFromEvent(e);
    let angleDiff = currentAngle - startAngle;

    // Handle wraparound
    if (angleDiff > 180) {
      angleDiff -= 360;
    } else if (angleDiff < -180) {
      angleDiff += 360;
    }

    knobCurrentRotation += angleDiff;
    startAngle = currentAngle;

    updateTempo();
  });

  document.addEventListener('mouseup', () => {
    isRotating = false;
  });

  document.addEventListener('touchend', () => {
    isRotating = false;
  });
}

// Setup event listeners
function setupEventListeners() {
  // Play/Stop buttons
  document.getElementById('playBtn').addEventListener('click', () => {
    if (metronomeState.isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  });

  document.getElementById('stopBtn').addEventListener('click', stopMetronome);

  // Space bar to toggle play/stop
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (metronomeState.isPlaying) {
        stopMetronome();
      } else {
        startMetronome();
      }
    }
  });

  // Sound palette buttons
  document.querySelectorAll('.sound-palette-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sound-palette-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      metronomeState.soundPalette = btn.dataset.palette;

      // Update pitch slider range for the selected palette
      updatePitchSliderRange(btn.dataset.palette);

      // Play preview
      playWoodenTick(audioContext.currentTime || 0, true);
      _postStateToHub();
    });
  });

  // Accent first beat toggle
  const accentFirstBeatBtn = document.getElementById('accentFirstBeatBtn');
  if (accentFirstBeatBtn) {
    accentFirstBeatBtn.addEventListener('click', () => {
      metronomeState.accentFirstBeat = !metronomeState.accentFirstBeat;
      accentFirstBeatBtn.classList.toggle('active', metronomeState.accentFirstBeat);
      _postStateToHub();
    });
  }

  // Time signature buttons
  document.querySelectorAll('.time-sig-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-sig-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      metronomeState.timeSignature = btn.dataset.sig;

      // Repopulate beat tone buttons
      populateBeatTones();

      // Reset beat display
      if (metronomeState.isPlaying) {
        metronomeState.currentBeat = 0;
        updateBeatDisplay(0);
      }
      _postStateToHub();
    });
  });

  // BPM input
  const bpmInput = document.getElementById('bpmValue');
  bpmInput.addEventListener('input', () => {
    const val = parseInt(bpmInput.value);
    if (!isNaN(val) && val >= 40 && val <= 240) {
      metronomeState.tempo = val;
      applyTempoToKnob(val);
      _postStateToHub();
    }
  });
  bpmInput.addEventListener('change', () => {
    let val = parseInt(bpmInput.value);
    val = Math.max(40, Math.min(240, isNaN(val) ? 120 : val));
    bpmInput.value = val;
    metronomeState.tempo = val;
    applyTempoToKnob(val);
    _postStateToHub();
  });

  // Pitch range slider
  const pitchSlider = document.getElementById('pitchSlider');
  const pitchValue = document.getElementById('pitchValue');

  pitchSlider.addEventListener('input', () => {
    metronomeState.basePitch = parseInt(pitchSlider.value);
    pitchValue.textContent = metronomeState.basePitch;
  });

  // Preview for pitch slider
  pitchSlider.addEventListener('change', () => {
    playWoodenTick(audioContext.currentTime || 0, false, metronomeState.basePitch);
    _postStateToHub();
  });
}

// Get beat tone button ID
function getBeatToneButtonId(beatNum) {
  return `beat-tone-${beatNum}`;
}

// Populate beat tone buttons
function populateBeatTones() {
  const beatsPerBar = timeSignatures[metronomeState.timeSignature];
  const grid = document.getElementById('beatTonesGrid');
  grid.innerHTML = '';

  for (let i = 0; i < beatsPerBar; i++) {
    const btn = document.createElement('button');
    btn.id = getBeatToneButtonId(i);
    btn.className = 'beat-tone-btn';
    if (i === 0) btn.classList.add('accent');
    btn.textContent = i + 1;

    // Check if custom tone is set
    const sigKey = `${metronomeState.timeSignature}_${i}`;
    if (metronomeState.beatTones[sigKey]) {
      btn.classList.add('set');
    }

    // Check if beat is muted
    if (metronomeState.beatMutes[sigKey]) {
      btn.classList.add('muted');
    }

    // Click to set tone
    btn.addEventListener('click', () => {
      setupBeatToneModal(i, btn);
    });

    // Right-click to toggle mute
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const sigKey = `${metronomeState.timeSignature}_${i}`;
      metronomeState.beatMutes[sigKey] = !metronomeState.beatMutes[sigKey];

      if (metronomeState.beatMutes[sigKey]) {
        btn.classList.add('muted');
      } else {
        btn.classList.remove('muted');
      }
      _postStateToHub();
    });

    grid.appendChild(btn);
  }
}

// Setup modal for selecting beat tone
function setupBeatToneModal(beatNum, sourceBtn) {
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.innerHTML = `
    <div class="modal-content">
      <h3>Set Tone for Beat ${beatNum + 1}</h3>
      <div class="modal-presets">
        <p>Quick Presets:</p>
        <div class="preset-buttons">
          <button class="preset-btn" data-freq="200">Low (200Hz)</button>
          <button class="preset-btn" data-freq="250">Low-Mid (250Hz)</button>
          <button class="preset-btn" data-freq="300">Mid (300Hz)</button>
          <button class="preset-btn" data-freq="350">Mid-High (350Hz)</button>
        </div>
      </div>
      <div class="modal-custom">
        <p>Custom Pitch:</p>
        <input type="range" class="custom-pitch" min="150" max="400" value="${metronomeState.basePitch}" />
        <span class="custom-pitch-value">${metronomeState.basePitch}</span> Hz
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-clear">Clear</button>
        <button class="modal-btn modal-close">Close</button>
      </div>
      <div class="modal-preview">
        <button class="preview-btn">Preview</button>
      </div>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  document.body.appendChild(overlay);
  document.body.appendChild(dialog);

  const sigKey = `${metronomeState.timeSignature}_${beatNum}`;
  const currentPitch = metronomeState.beatTones[sigKey];

  // Preview button
  dialog.querySelector('.preview-btn').addEventListener('click', () => {
    const pitch = parseInt(dialog.querySelector('.custom-pitch').value);
    playWoodenTick(audioContext.currentTime, beatNum === 0, pitch);
  });

  // Preset buttons
  dialog.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const freq = parseInt(btn.dataset.freq);
      metronomeState.beatTones[sigKey] = freq;
      sourceBtn.classList.add('set');
      playWoodenTick(audioContext.currentTime, beatNum === 0, freq);
      _postStateToHub();
      document.body.removeChild(overlay);
      document.body.removeChild(dialog);
    });
  });

  // Custom pitch range
  const customRange = dialog.querySelector('.custom-pitch');
  const customValue = dialog.querySelector('.custom-pitch-value');
  customRange.addEventListener('input', () => {
    customValue.textContent = customRange.value;
  });

  // Clear button
  dialog.querySelector('.modal-clear').addEventListener('click', () => {
    delete metronomeState.beatTones[sigKey];
    sourceBtn.classList.remove('set');
    _postStateToHub();
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });

  // Close button
  dialog.querySelector('.modal-close').addEventListener('click', () => {
    // Save custom pitch if changed
    const pitch = parseInt(customRange.value);
    if (pitch !== metronomeState.basePitch || currentPitch) {
      metronomeState.beatTones[sigKey] = pitch;
      sourceBtn.classList.add('set');
    }
    _postStateToHub();
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });

  // Close on overlay click
  overlay.addEventListener('click', () => {
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });

  initAudioContext();
}

// Add modal styles
function addModalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 12px;
      padding: 28px;
      box-shadow: var(--shadow-lg);
      z-index: 1001;
      max-width: 400px;
      width: 90%;
      color: var(--text-primary);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      z-index: 1000;
    }

    .modal-content h3 {
      color: var(--text-primary);
      margin-bottom: 20px;
      text-align: center;
    }

    .modal-presets,
    .modal-custom {
      margin-bottom: 20px;
    }

    .modal-presets p,
    .modal-custom p {
      font-size: 0.9em;
      color: var(--text-secondary);
      margin-bottom: 10px;
      font-weight: 600;
    }

    .preset-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .preset-btn {
      padding: 10px;
      border: 1px solid var(--border-default);
      border-radius: 6px;
      background: var(--bg-panel);
      color: var(--text-secondary);
      font-size: 0.85em;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .preset-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-subtle);
    }

    .modal-custom {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-custom input[type="range"] {
      flex: 1;
      height: 4px;
      background: var(--bg-hover);
      border-radius: 2px;
      -webkit-appearance: none;
      accent-color: var(--accent);
    }

    .modal-custom input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent);
      border: 2px solid var(--bg-elevated);
      cursor: pointer;
    }

    .modal-custom input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent);
      border: 2px solid var(--bg-elevated);
      cursor: pointer;
    }

    .custom-pitch-value {
      min-width: 40px;
      font-weight: 600;
      color: var(--accent);
    }

    .modal-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 15px;
    }

    .modal-btn {
      padding: 10px;
      border: 1px solid var(--border-default);
      border-radius: 6px;
      background: var(--bg-panel);
      color: var(--text-secondary);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .modal-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-subtle);
    }

    .modal-clear {
      background: var(--danger-subtle);
      border-color: var(--danger);
      color: var(--danger);
    }

    .preview-btn {
      width: 100%;
      padding: 10px;
      background: var(--accent);
      color: var(--text-inverse);
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, box-shadow 0.2s;
    }

    .preview-btn:hover {
      background: var(--accent-dim);
      box-shadow: 0 4px 12px var(--accent-glow);
    }
  `;
  document.head.appendChild(style);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  addModalStyles();
  setupKnobControl();
  setupEventListeners();
  populateBeatTones();
  updatePitchSliderRange(metronomeState.soundPalette);
  updateBeatDisplay(0);
  applyTempoToKnob(metronomeState.tempo);
  // Signal hub that the metronome iframe is ready to receive RESTORE_STATE
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'METRONOME_READY' }, '*');
  }
});

// Listen for theme / state messages from parent hub
window.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'APPLY_THEME') {
    applyTheme(e.data.theme);
  }
});

// ─── Hub state bridge ────────────────────────────────────────────────────────
// Write metronome state directly into the parent hub's URL hash (synchronous,
// so no data is lost on immediate page refresh).
function _postStateToHub() {
  if (window.parent === window) return;
  try {
    const parentLoc = window.parent.location;
    let current = {};
    try {
      const hash = parentLoc.hash.slice(1);
      if (hash) current = JSON.parse(atob(hash));
    } catch { }
    current.metronome = {
      tempo: metronomeState.tempo,
      timeSig: metronomeState.timeSignature,
      palette: metronomeState.soundPalette,
      pitch: metronomeState.basePitch,
      beatTones: Object.assign({}, metronomeState.beatTones),
      beatMutes: Object.assign({}, metronomeState.beatMutes),
      accentFirstBeat: metronomeState.accentFirstBeat,
    };
    const basePath = parentLoc.href.split('#')[0];
    parentLoc.replace(basePath + '#' + btoa(JSON.stringify(current)));
  } catch (e) {
    // Cross-origin fallback (shouldn't happen in normal use)
    window.parent.postMessage({ type: 'METRONOME_STATE_CHANGED', state: current.metronome }, '*');
  }
}

// Listen for RESTORE_STATE from hub (sent after page reload).
window.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'RESTORE_STATE') return;
  const s = e.data.state;
  if (!s) return;

  if (s.tempo) {
    metronomeState.tempo = s.tempo;
    document.getElementById('bpmValue').value = s.tempo;
    applyTempoToKnob(s.tempo);
  }
  if (s.timeSig) {
    metronomeState.timeSignature = s.timeSig;
    document.querySelectorAll('.time-sig-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.sig === s.timeSig)
    );
    populateBeatTones();
  }
  if (s.palette) {
    metronomeState.soundPalette = s.palette;
    document.querySelectorAll('.sound-palette-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.palette === s.palette)
    );
    updatePitchSliderRange(s.palette);
  }
  if (s.pitch) {
    metronomeState.basePitch = s.pitch;
    const slider = document.getElementById('pitchSlider');
    if (slider) slider.value = s.pitch;
    const val = document.getElementById('pitchValue');
    if (val) val.textContent = s.pitch;
  }
  if (s.beatTones) Object.assign(metronomeState.beatTones, s.beatTones);
  if (s.beatMutes) Object.assign(metronomeState.beatMutes, s.beatMutes);
  if (s.accentFirstBeat !== undefined) {
    metronomeState.accentFirstBeat = s.accentFirstBeat;
    const btn = document.getElementById('accentFirstBeatBtn');
    if (btn) btn.classList.toggle('active', s.accentFirstBeat);
  }

  // Refresh beat grid to reflect restored tones/mutes
  populateBeatTones();
});
// ─────────────────────────────────────────────────────────────────────────────
