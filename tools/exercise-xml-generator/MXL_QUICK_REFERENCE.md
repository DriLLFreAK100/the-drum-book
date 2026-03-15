# Quick Reference: MXL Generation Convention

## How It Works

Instead of hardcoding which sections to export, mark sections in markdown with an HTML comment:

```markdown
<!-- mxl: time-sig=4/4, note-type=16th -->

## Exercise Name (32 Bars)
```

Bar 1: 1000 0100 0010 0001
...

```

```

## Parameters

- **time-sig**: Time signature (`4/4` or `12/8`)
- **note-type**: Note value (`16th` or `eighth`)

## Example

### 16th-Note Exercise

```markdown
<!-- mxl: time-sig=4/4, note-type=16th -->

## Single Accent Exercise (32 Bars)
```

### 8th-Note Triplet Exercise

```markdown
<!-- mxl: time-sig=12/8, note-type=eighth -->

## Single Accent Exercise (32 Bars)
```

## Filename Generation

Headings are auto-converted to filenames:

- `Single Accent Exercise (32 Bars)` → `single-accent.mxl`
- `Mixed Accents Exercise 1 (32 Bars)` → `mixed-accents-1.mxl`
- `16th Note` → `16th-note.mxl`

## Running the Generator

From the project root:

```bash
python3 tools/exercise-xml-generator/index.py
```

Or from the tool directory:

```bash
cd tools/exercise-xml-generator
python3 index.py
```

## Files Generated

```
16th-note-accent-exercises/resources/
  ├── single-accent.mxl
  ├── double-accent.mxl
  ├── triple-accent.mxl
  └── mixed-accents-{1,2,3}.mxl

8th-note-triplet-accent-exercises/resources/
  ├── single-accent.mxl
  ├── double-accent.mxl
  ├── triple-accent.mxl
  └── mixed-accents-{1,2,3}.mxl

accent-grids/resources/
  ├── 16th-note.mxl (55 bars)
  └── 8th-note-triplet.mxl (32 bars)
```

## To Add New Exercises

1. Add `<!-- mxl: time-sig=..., note-type=... -->` before the heading
2. Add bar patterns as usual
3. Run `python3 generate_musicxml.py`
4. New MXL files appear in `resources/` folder automatically

## Benefits

✅ No hardcoded exercise names  
✅ Easy to add/remove sections  
✅ Markdown structure reflects what gets exported  
✅ Configuration in plain sight
