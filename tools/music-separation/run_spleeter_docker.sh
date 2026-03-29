#!/usr/bin/env bash
set -euo pipefail

DIR=""
STEMS="2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RECURSIVE="no"
MOVE_ORIGINAL="yes"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--dir)
      DIR="$2"
      shift 2
      ;;
    -s|--stems)
      STEMS="$2"
      shift 2
      ;;
    --recursive)
      RECURSIVE="$2"
      shift 2
      ;;
    --move-original)
      MOVE_ORIGINAL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$DIR" ]]; then
  echo "Usage: $0 -d <directory> [-s 2|4|5]" >&2
  exit 1
fi

if [[ ! -d "$DIR" ]]; then
  echo "Directory not found: $DIR" >&2
  exit 1
fi

case "$STEMS" in
  2) MODEL="spleeter:2stems" ;;
  4) MODEL="spleeter:4stems" ;;
  5) MODEL="spleeter:5stems" ;;
  *) echo "Invalid stems: $STEMS (allowed: 2,4,5)" >&2; exit 1;;
esac

to_bool() {
  case "$1" in
    yes|true|1) echo "yes" ;;
    no|false|0) echo "no" ;;
    *) echo "$1" ;;
  esac
}

RECURSIVE="$(to_bool "$RECURSIVE")"
MOVE_ORIGINAL="$(to_bool "$MOVE_ORIGINAL")"

if ! docker image inspect local/spleeter-arm64 >/dev/null 2>&1; then
  echo "Building local/spleeter-arm64"
  docker build -t local/spleeter-arm64 -f "$SCRIPT_DIR/Dockerfile.spleeter" "$SCRIPT_DIR"
fi

if [[ "$RECURSIVE" == "yes" ]]; then
  IFS=$'\n' files=( $(find "$DIR" -type f \( -iname '*.mp3' -o -iname '*.wav' -o -iname '*.flac' -o -iname '*.m4a' -o -iname '*.ogg' -o -iname '*.wma' \)) )
else
  IFS=$'\n' files=( $(find "$DIR" -maxdepth 1 -type f \( -iname '*.mp3' -o -iname '*.wav' -o -iname '*.flac' -o -iname '*.m4a' -o -iname '*.ogg' -o -iname '*.wma' \)) )
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No audio files found in $DIR" >&2
  exit 1
fi

LOG_DIR="$DIR/spleeter_logs"
mkdir -p "$LOG_DIR"

for f in "${files[@]}"; do
  rel="${f#$DIR/}"
  base="${rel##*/}"
  out_parent="$(dirname "$rel")"
  name="${base%.*}"
  expected="$DIR/$out_parent/$name"
  mkdir -p "$LOG_DIR/$out_parent"
  log_path="$LOG_DIR/$rel.log"
  echo "Processing=$rel model=$MODEL"
  if docker run --rm -v "$DIR:/input" local/spleeter-arm64 separate -d 10000 -p "$MODEL" -o /input "/input/$rel" 2>&1 | tee "$log_path"; then
    if [[ -d "$expected" ]]; then
      echo "OutputDir=$expected"
      ext="${base##*.}"
      if [[ "$MOVE_ORIGINAL" == "yes" && "$ext" == "mp3" ]]; then
        if mv "${DIR}/${rel}" "${expected}/" 2>/dev/null; then
          echo "MovedOriginal=${DIR}/${rel} -> ${expected}/"
        else
          echo "MoveFailed=${DIR}/${rel} Log=$log_path" >&2
        fi
      fi
    else
      echo "NoOutput=$rel Log=$log_path" >&2
    fi
  else
    echo "Failed=$rel Log=$log_path" >&2
  fi
done
