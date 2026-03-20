# Drum Book Practice Hub

An integrated practice environment combining a music notation reader with a metronome tool. Browse drum exercises while practicing with customizable metronome settings.

## Features

- **📚 Exercise Browser**: Browse all drum exercises organized by category
  - 16th Note Accent exercises (6 variations)
  - 8th Note Triplet Accent exercises (9 variations)
  - Accent Grids (2 variations)
- **🎼 MusicXML Notation Viewer**: High-quality music notation rendering using OpenSheetMusicDisplay
  - Clear, professional display of exercises
  - Interactive zoom controls (50% - 200%)
- **🎵 Integrated Metronome**: Full-featured metronome built-in
  - Multiple sound palettes (Wooden Block, Cowbell, Metronome, Beep)
  - Dynamic pitch control per palette
  - Selectively mute individual counts
  - Per-beat tone customization
  - 7 time signature support
- **⌨️ Keyboard Shortcuts**:
  - `Ctrl+` (or `Cmd+` on Mac): Zoom in
  - `Ctrl−` (or `Cmd−` on Mac): Zoom out
  - `Ctrl+Scroll` (or `Cmd+Scroll`): Zoom with mouse wheel

## Layout

The hub uses a three-panel layout for optimal practice:

- **Left Panel (Sidebar)**: Exercise browser with categories and file list
- **Center Panel (Main)**: large notation viewer for studying exercises
- **Right Panel (Metronome)**: Full metronome tool for setting tempo, sound, and customizing beats

## How to Use

1. **Open the Hub**: Load `index.html` in your web browser
2. **Select an Exercise**:
   - Click on a category name to expand/collapse
   - Click on an exercise file to load it
   - The notation will display in the center panel
3. **Configure Metronome**: Use the right panel to set:
   - Tempo (BPM) with infinite rotation knob
   - Sound palette (Wooden Block, Cowbell, Metronome, or Beep)
   - Pitch for the selected palette
   - Mute specific beats by right-clicking them
4. **Practice**:
   - Study the exercise notation in the center
   - Start the metronome with the Play button or SPACE key
   - Use zoom controls as needed for better visibility
5. **Switch Exercises**: Click another exercise to load it while metronome continues

## Exercise Organization

### By Category

**16th Note Accent Exercises**

- Single Accent
- Double Accent
- Triple Accent
- Mixed Accents 1-3

**8th Note Triplet Accent Exercises**

- Single Accent
- Double Accent
- Triple Accent
- Mixed Accents 1-6

**Accent Grids**

- 16th Note
- 8th Note Triplet

## Responsive Design

The layout adapts to screen size:

- **Desktop (1200px+)**: Three-column layout (sidebar, viewer, metronome)
- **Tablet (1000px-1200px)**: Two rows with sidebar, viewer on top; metronome below
- **Mobile (<1000px)**: Stacked layout with sidebar at top, viewer in middle, metronome at bottom

## Technical Details

- **Notation Rendering**: OpenSheetMusicDisplay (OSMD) for MusicXML rendering
- **Metronome Engine**: Web Audio API for real-time synthesis
- **Layout**: CSS Grid for responsive design
- **File Format**: MusicXML standard format
- **No Dependencies**: Except for OpenSheetMusicDisplay CDN library

## Browser Compatibility

- Chrome/Edge 25+
- Firefox 25+
- Safari 14+
- Mobile browsers with Web Audio API support

## Tips for Practice

1. **Use Categories**: Start with simpler exercises (accent-grids) before moving to complex variations
2. **Adjust Metronome**: Start at a comfortable tempo, gradually increase as you master the pattern
3. **Mute Beats**: Use the mute feature to practice specific beat patterns without counting all beats
4. **Zoom**: Zoom in for easier reading of complex patterns
5. **Multiple Sounds**: Try different sound palettes to keep practice engaging
6. **Pitch Control**: Adjust pitch to match your practice environment

## Keyboard Shortcuts Summary

| Shortcut    | Action                |
| ----------- | --------------------- |
| SPACE       | Play/Stop metronome   |
| Ctrl+`+`    | Zoom in               |
| Ctrl+`−`    | Zoom out              |
| Ctrl+Scroll | Zoom with mouse wheel |

## File Structure

```
hub/
├── index.html       # Main hub interface
├── styles.css       # Layout and styling
├── script.js        # Hub functionality and OSMD integration
└── README.md        # This file
```

## References

- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay)
- [MusicXML Standard](https://www.musicxml.com/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
