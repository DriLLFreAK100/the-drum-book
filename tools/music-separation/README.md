# Music Source Separation (Docker)

This project provides a simple Docker-based setup to run Deezer Spleeter for music source separation on macOS (Apple Silicon) without Python/TensorFlow install hassles.

## Prerequisites
- Docker installed and running

## Build Image
- Build the local arm64-friendly image:
```
docker build -t local/spleeter-arm64 -f Dockerfile.spleeter .
```

## Run Separation for a Directory
- 2 stems (vocals, accompaniment):
```
./run_spleeter_docker.sh -d /path/to/dir -s 2
```
- 4 stems (vocals, bass, drums, other):
```
./run_spleeter_docker.sh -d /path/to/dir -s 4
```
- 5 stems (vocals, bass, drums, piano, other):
```
./run_spleeter_docker.sh -d /path/to/dir -s 5
```

## How It Works
- The script scans the directory for audio files (`mp3`, `wav`, `flac`, `m4a`, `ogg`, `wma`).
- Each file is processed via Docker using the selected stems model.
- Output is written alongside each input file in a subfolder named after the input filename.

## Example
```
./run_spleeter_docker.sh -d "$PWD/songs" -s 4
```
This separates all files under `songs/` with the 4-stems model and writes per-file outputs inside each song’s folder.

## Notes
- First run downloads the selected model inside the container; subsequent runs reuse it.
- If `local/spleeter-arm64` is missing, the script prompts to build it.
