# MXL Generation Convention

**Location:** `tools/exercise-xml-generator/`

**To run:** `python3 tools/exercise-xml-generator/index.py` (from project root)

---

This document describes the convention used to automatically generate MXL music files from markdown exercise files.

## Overview

Instead of hardcoding exercise names in the generator script, the system now uses an **HTML comment markup convention** in markdown files to indicate which sections should be converted to MXL files.

## Convention Format

Mark sections for MXL generation by placing an HTML comment with configuration directly before the section heading:

```markdown
<!-- mxl: time-sig=4/4, note-type=16th -->

## Exercise Name (32 Bars)
```

Bar 1: 1000 0100 0010 0001
...

```

```

## Configuration Parameters

The mxl comment accepts the following comma-separated parameters:

| Parameter   | Values           | Description                     |
| ----------- | ---------------- | ------------------------------- |
| `time-sig`  | `4/4`, `12/8`    | Time signature for the exercise |
| `note-type` | `16th`, `eighth` | The note subdivision type       |

### Common Combinations

| Time Signature | Note Type | Used For                          |
| -------------- | --------- | --------------------------------- |
| `4/4`          | `16th`    | 16th-note accent exercises        |
| `12/8`         | `eighth`  | 8th-note triplet accent exercises |

## Filename Generation

The system automatically generates output filenames by:

1. Converting the heading to lowercase
2. Removing patterns like `(32 Bars)` or `(55 Bars)`
3. Removing the word `exercise`
4. Replacing spaces with hyphens

### Examples

| Heading                              | Output Filename        |
| ------------------------------------ | ---------------------- |
| `Single Accent Exercise (32 Bars)`   | `single-accent.mxl`    |
| `Double Accent Exercise (32 Bars)`   | `double-accent.mxl`    |
| `Mixed Accents Exercise 1 (32 Bars)` | `mixed-accents-1.mxl`  |
| `16th Note`                          | `16th-note.mxl`        |
| `8th note triplet`                   | `8th-note-triplet.mxl` |

## Bar Pattern Format

Bars are defined using the notation system specified in each markdown file:

- **16th-note exercises**: Groups of 4 notes per beat

  ```
  Bar 1: 1000 0100 0010 0001
  ```

  Each `1` is an accented note, `0` is unaccented.

- **8th-note triplet exercises**: Groups of 3 notes per beat
  ```
  Bar 1: 100 010 001 100
  ```
  Each `1` is an accented note, `0` is unaccented.

## File Organization

```
exercises/
├── 16th-note-accent-exercises/
│   ├── index.md                    (Contains mxl comments)
│   └── resources/
│       ├── single-accent.mxl       (Auto-generated)
│       ├── double-accent.mxl
│       └── ...
├── 8th-note-triplet-accent-exercises/
│   ├── index.md                    (Contains mxl comments)
│   └── resources/
│       ├── single-accent.mxl       (Auto-generated)
│       ├── double-accent.mxl
│       └── ...
└── accent-grids/
    ├── index.md                    (Contains mxl comments)
    └── resources/
        ├── 16th-note.mxl           (Auto-generated)
        └── 8th-note-triplet.mxl    (Auto-generated)
```

## How to Use

### Add a New Exercise

1. Add your exercise content to the appropriate markdown file (e.g., `index.md`)
2. Place the mxl comment directly before the exercise heading:

   ```markdown
   <!-- mxl: time-sig=4/4, note-type=16th -->

   ## New Exercise Name (32 Bars)
   ```

3. Add your bar patterns with the standard format
4. Run: `python3 generate_musicxml.py`
5. MXL files are automatically generated in the `resources/` folder

### Modify Configuration

To change the time signature or note type for an existing exercise, just edit the mxl comment parameters:

```markdown
<!-- mxl: time-sig=12/8, note-type=eighth -->
```

### Skip a Section

To prevent a section from generating an MXL file, simply don't add an mxl comment before it.

## Implementation Details

The `generate_musicxml.py` script:

1. **Scans** each markdown file for HTML comments matching the pattern `<!-- mxl: ... -->`
2. **Parses** the configuration parameters from each comment
3. **Extracts** the heading immediately after the comment as the exercise title
4. **Collects** all bar patterns following the heading until the next mxl comment
5. **Generates** an MXL file with:
   - Proper MusicXML structure
   - MuseScore-compatible formatting
   - Correct time signature and note types
   - Accent notation matching the input patterns
6. **Names** the output file based on the exercise title

## Benefits

- **Data-Driven**: No hardcoded exercise names in the generator
- **Flexible**: Easy to add new sections or modify existing ones
- **Clear**: The markdown file structure reflects what MXL files will be generated
- **Maintainable**: Changes to exercises are immediately reflected in generated files
- **Discoverable**: Future developers can easily see which sections generate MXL files
