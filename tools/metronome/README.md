# Drum Metronome

A fully-featured web-based metronome designed for drummers with infinite knob control, multiple sound palettes, customizable pitches per beat, and wooden tone synthesis.

## Features

- **Multiple Sound Palettes**:
  - 🪵 **Wooden Block**: Natural wooden tick (customizable pitch)
  - 🔔 **Cowbell**: Bright, metallic cowbell tone (uses pitch slider)
  - ⏱️ **Metronome**: Classic mechanical metronome machine (scales pitch for accents)
  - 📱 **Beep**: Electronic digital beep (uses pitch slider)
- **Infinite Turnable Knob**: Rotate continuously to adjust BPM (40-240) without limits
- **Universal Pitch Control**: Range slider applies to all sound palettes
  - 🪵 Wooden Block: 150-400 Hz
  - 🔔 Cowbell: 300-800 Hz
  - ⏱️ Metronome: 400-1000 Hz
  - 📱 Beep: 600-1500 Hz
- **Per-Beat Tone Customization**: Set different pitches for each beat within a measure
- **Per-Beat Mute Control**: Right-click any beat to mute/unmute individual counts
- **Time Signatures**: Support for common and complex signatures:
  - 4/4, 3/4, 5/4 (common)
  - 12/8, 7/8, 9/8 (compound/complex)
  - 15/16 (extended)
- **Space Bar Toggle**: Press SPACE to start/stop playback
- **Visual Beat Indicator**: Shows current beat with accent highlighting on beat 1
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

1. **Open**: Load `index.html` in a web browser
2. **Choose Sound Palette**: Select from Wooden Block, Cowbell, Metronome, or Beep
3. **Set Tempo**: Rotate the knob to adjust BPM - rotations are infinite
4. **Adjust Pitch**: Use the pitch slider to control all palettes (range adjusts based on selected palette)
5. **Customize Individual Beats**: Click any beat button to set custom pitch for that beat
6. **Mute Beats**: Right-click any beat button to mute/unmute that specific count
7. **Choose Time Signature**: Select your desired time signature
8. **Play**: Click Start or press SPACE to begin

## Sound Palette Characteristics

### 🪵 Wooden Block

- Natural wooden tick with adjustable pitch
- Pitch Range: 150-400 Hz
- Attack: 8ms | Decay: 80-120ms
- Great for practice and warming up

### 🔔 Cowbell

- Bright, metallic cowbell tone
- Two frequency layers (fundamental + 1.5x harmonic) for rich character
- Pitch Range: 300-800 Hz
- Ideal for Latin rhythms and salsa

### ⏱️ Metronome

- Classic mechanical metronome sound
- Two distinct pitches: base pitch for normal beats | 1.33x pitch for accents
- Very sharp attack (5ms)
- Pitch Range: 400-1000 Hz
- Perfect for traditional metronome feel

### 📱 Beep

- Pure electronic sine wave beep
- Clean, digital sound
- Pitch Range: 600-1500 Hz
- Good for electronic music practice

## Per-Beat Customization

### Tone Customization

1. Click any numbered beat button
2. Choose a preset tone or set custom pitch
3. Click "Preview" to hear the tone
4. Apply your choice to that specific beat
5. Each time signature remembers its own beat configuration

### Mute Control

- Right-click any beat button to mute/unmute that count
- Muted beats will appear grayed out with a strikethrough
- Muted beats won't produce sound during playback
- Mute state is independent for each time signature

## Technical Details

- **Audio Engine**: Web Audio API for real-time synthesis
- **Knob Control**: Infinite rotation with angle wraparound detection
- **Sound Synthesis**:
  - Wooden Block: Sine osc + HP/LP filters + noise burst
  - Cowbell: Dual oscillators (sine + triangle) + LP filter
  - Metronome: Single sine + HP filter with two pitch modes
  - Beep: Pure sine wave oscillator
- **Beat Scheduling**: Accurate lookahead scheduling
- **Per-Beat Mapping**: Per-palette storage (e.g., Cowbell beats separate from Wooden beats)
- **No Dependencies**: Pure HTML, CSS, JavaScript

## Browser Compatibility

- Chrome/Edge 25+
- Firefox 25+
- Safari 14+
- Mobile browsers with Web Audio API support
