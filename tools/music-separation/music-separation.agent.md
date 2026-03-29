# Music Separation Agent Skill

This file describes how a Copilot/agent can run music source separation in this repository.

## Prerequisites

- Docker installed and running.

## Setup

1. Build the Docker image (once):
   ```bash
   cd tools/music-separation
   docker build -t local/spleeter-arm64 -f Dockerfile.spleeter .
   ```

## Run on `.ref/musics`

- 4 stems (vocals,bass,drums,other):

  ```bash
  cd tools/music-separation
  ./run_spleeter_docker.sh -d "$(pwd)/../../.ref/musics" -s 4
  ```

- 5 stems (vocals,bass,drums,piano,other):
  ```bash
  cd tools/music-separation
  ./run_spleeter_docker.sh -d "$(pwd)/../../.ref/musics" -s 5
  ```

## Notes

- Output for each file is written into a folder alongside it (e.g. `.ref/musics/song_name/`).
- If no audio files are found, script exits with error.
- Logs are stored in `.ref/musics/spleeter_logs/`.
