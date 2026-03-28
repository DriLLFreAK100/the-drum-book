#!/usr/bin/env python3
"""
Generate manifest.json for the Drum Book Practice Hub.

Scans the workspace for:
  - exercises/*/resources/*.musicxml  → listed as exercise categories
  - .ref/**/*.pdf                     → listed as reference books

Run from anywhere (uses the script's own location to find the workspace root):
    python3 tools/hub/generate-manifest.py
"""

import json
import os
import re

# Workspace root is two levels up from this script (tools/hub/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))

# Paths relative to workspace root
EXERCISES_DIR = os.path.join(WORKSPACE_ROOT, 'exercises')
REF_DIR = os.path.join(WORKSPACE_ROOT, '.ref')
MUSICS_DIR = os.path.join(WORKSPACE_ROOT, '.ref', 'musics')

# Path prefix used by the hub (relative to tools/hub/)
HUB_EXERCISES_PREFIX = '../../exercises'
HUB_REF_PREFIX = '../../.ref'
HUB_MUSICS_PREFIX = '../../.ref/musics'

AUDIO_EXTENSIONS = {'.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac'}

STEM_ICONS = {
    'drums': '🥁', 'drum': '🥁',
    'bass': '🎸',
    'piano': '🎹', 'keys': '🎹', 'keyboard': '🎹', 'synth': '🎹',
    'vocals': '🎤', 'vocal': '🎤', 'voice': '🎤', 'vox': '🎤',
    'guitar': '🎸', 'gtr': '🎸',
    'brass': '🎺', 'horns': '🎺',
    'strings': '🎻',
    'other': '🎵', 'misc': '🎵',
}


def folder_to_display_name(folder_name: str) -> str:
    """Convert a kebab-case folder name to a human-readable display name.

    Examples:
        16th-note-accent-exercises  → 16th Note Accent
        8th-note-triplet-accent-exercises → 8th Note Triplet Accent
        accent-grids                → Accent Grids
    """
    name = re.sub(r'-exercises?$', '', folder_name)
    words = name.split('-')
    result = []
    for word in words:
        if not word:
            continue
        # Don't capitalise words that start with a digit (e.g. 16th, 8th)
        result.append(word if word[0].isdigit() else word.capitalize())
    return ' '.join(result)


def natural_sort_key(s: str):
    """Sort key that orders numeric segments numerically (e.g. mixed-accents-2 before mixed-accents-10)."""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', s)]


def scan_exercises() -> list:
    categories = []
    if not os.path.isdir(EXERCISES_DIR):
        return categories

    for folder in sorted(os.listdir(EXERCISES_DIR)):
        folder_path = os.path.join(EXERCISES_DIR, folder)
        if not os.path.isdir(folder_path):
            continue

        resources_path = os.path.join(folder_path, 'resources')
        if not os.path.isdir(resources_path):
            continue

        files = sorted(
            [f for f in os.listdir(resources_path) if f.endswith('.musicxml')],
            key=natural_sort_key,
        )
        if not files:
            continue

        categories.append({
            'name': folder_to_display_name(folder),
            'path': f'{HUB_EXERCISES_PREFIX}/{folder}/resources',
            'files': files,
        })

    return categories


def scan_ref_books() -> list:
    books = []
    if not os.path.isdir(REF_DIR):
        return books

    for root, _dirs, files in os.walk(REF_DIR):
        for file in sorted(files, key=natural_sort_key):
            if not file.lower().endswith('.pdf'):
                continue
            rel = os.path.relpath(os.path.join(root, file), WORKSPACE_ROOT)
            # Use forward slashes for the browser path
            hub_path = f'{HUB_REF_PREFIX}/{os.path.relpath(os.path.join(root, file), REF_DIR)}'.replace(os.sep, '/')
            books.append({
                'name': os.path.splitext(file)[0],
                'path': hub_path,
            })

    return books


def scan_musics() -> list:
    tunes = []
    if not os.path.isdir(MUSICS_DIR):
        return tunes

    for folder in sorted(os.listdir(MUSICS_DIR)):
        if folder.startswith('.'):
            continue
        folder_path = os.path.join(MUSICS_DIR, folder)
        if not os.path.isdir(folder_path):
            continue

        stems = []
        score_mscz = None
        score_musicxml = None

        for file in sorted(os.listdir(folder_path), key=natural_sort_key):
            if file.startswith('.') or file.startswith('_'):
                continue
            ext = os.path.splitext(file)[1].lower()
            stem_name = os.path.splitext(file)[0]

            if ext in AUDIO_EXTENSIONS:
                icon = STEM_ICONS.get(stem_name.lower(), '📀')
                stems.append({
                    'name': stem_name,
                    'label': stem_name.capitalize(),
                    'icon': icon,
                    'path': f'{HUB_MUSICS_PREFIX}/{folder}/{file}',
                })
            elif ext == '.mscz':
                score_mscz = f'{HUB_MUSICS_PREFIX}/{folder}/{file}'
            elif ext == '.musicxml':
                score_musicxml = f'{HUB_MUSICS_PREFIX}/{folder}/{file}'

        # Prefer .mscz (native MuseScore format, richer) over .musicxml
        score = score_mscz or score_musicxml

        if stems or score_mscz or score_musicxml:
            tunes.append({
                'name': folder,
                'stems': stems,
                'score_mscz': score_mscz,
                'score_musicxml': score_musicxml,
            })

    return tunes


def main():
    manifest = {
        'exercises': scan_exercises(),
        'refBooks': scan_ref_books(),
        'musics': scan_musics(),
    }

    # manifest.json — kept for reference / tooling
    json_path = os.path.join(SCRIPT_DIR, 'manifest.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    # manifest.js — loaded as a <script> tag so it works without a HTTP server
    js_path = os.path.join(SCRIPT_DIR, 'manifest.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated by tools/hub/generate-manifest.py — do not edit by hand\n')
        f.write('window.MANIFEST = ')
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write(';\n')

    print(f'manifest.json + manifest.js written to {SCRIPT_DIR}')
    print(f'  {len(manifest["exercises"])} exercise categorie(s)')
    print(f'  {len(manifest["refBooks"])} reference book(s)')
    print(f'  {len(manifest["musics"])} tune(s)')


if __name__ == '__main__':
    main()
