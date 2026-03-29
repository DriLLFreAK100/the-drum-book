---
name: music-separation
description: "Use when separating audio, splitting music into stems, running Spleeter, isolating vocals/bass/drums/piano. Runs Deezer Spleeter via Docker to separate audio files into 2, 4, or 5 stems (vocals, bass, drums, piano, other)."
argument-hint: 'Optional: path to audio directory and stem count (e.g. ".ref/musics 5")'
---

# Music Source Separation with Spleeter

This skill guides you through running music source separation using Deezer Spleeter on audio files in your repository.

## What is Spleeter?

Spleeter is an AI-powered music source separation tool that breaks down mixed audio into individual instruments/stems:

- **2 stems**: Vocals + Accompaniment
- **4 stems**: Vocals + Bass + Drums + Other
- **5 stems**: Vocals + Bass + Drums + Piano + Other

## Prerequisites

- Docker installed and running
- Audio files in supported formats: `.mp3`, `.wav`, `.flac`, `.m4a`, `.ogg`, `.wma`
- The Docker image `local/spleeter-arm64` built (one-time setup)

## Setup (One-Time)

Build the Docker image:

```bash
cd tools/music-separation
docker build -t local/spleeter-arm64 -f Dockerfile.spleeter .
```

## Usage

### Run on a Directory

From the workspace root, run Spleeter on any directory.
**Always use `$PWD/...` (absolute path) — Docker rejects relative paths for volume mounts.**

```bash
# 5 stems (vocals, bass, drums, piano, other)
tools/music-separation/run_spleeter_docker.sh -d "$PWD/.ref/musics" -s 5

# 4 stems (vocals, bass, drums, other)
tools/music-separation/run_spleeter_docker.sh -d "$PWD/.ref/musics" -s 4

# 2 stems (vocals, accompaniment)
tools/music-separation/run_spleeter_docker.sh -d "$PWD/.ref/musics" -s 2
```

### Command Options

- `-d, --dir <path>`: Directory containing audio files (required)
- `-s, --stems <2|4|5>`: Number of stems to separate into (default: 2)
- `--recursive <yes|no>`: Search subdirectories for audio files (default: no)
- `--move-original <yes|no>`: Move original file into output folder for MP3s (default: yes)

## Output Structure

For each audio file, Spleeter creates a folder with stem files:

```
.ref/musics/
├── song1.mp3
├── song1/
│   ├── vocals.wav
│   ├── bass.wav
│   ├── drums.wav
│   ├── piano.wav
│   └── other.wav
└── spleeter_logs/
    └── song1.mp3.log
```

## Examples

### Separate all songs in .ref/musics with 5 stems

```bash
tools/music-separation/run_spleeter_docker.sh -d "$PWD/.ref/musics" -s 5
```

### Separate a specific file's directory with 4 stems

```bash
tools/music-separation/run_spleeter_docker.sh -d "$PWD/.ref/musics/my-song" -s 4
```

### Recursive search in subdirectories with 5 stems

```bash
tools/music-separation/run_spleeter_docker.sh -d "$PWD/.ref/musics" -s 5 --recursive yes
```

## Notes

- **First run**: Downloads the selected model (2GB+) inside the container; subsequent runs reuse it
- **Logs**: Stored in `<directory>/spleeter_logs/` for troubleshooting
- **Processing time**: Depends on audio length and number of stems; typically 10-60 seconds per file
- **MP3 handling**: Original MP3 files are moved into the output folder by default

## Troubleshooting

### "No audio files found"

- Verify the directory path contains audio files in supported formats
- Check file extensions are lowercase (or use recursive mode if nested)

### Docker volume mount error (invalid characters)

- Docker requires absolute paths for `-v` mounts. Always pass `"$PWD/path"` instead of `./path`

### Docker image not found

- Build the image: `docker build -t local/spleeter-arm64 -f Dockerfile.spleeter tools/music-separation`

### Permission denied

- Make the script executable: `chmod +x tools/music-separation/run_spleeter_docker.sh`

### Out of disk space

- Stem files are large (especially with 5 stems). Ensure sufficient disk space before running
