#!/usr/bin/env bash
# Update from git, rebuild the Docker image, and (re)start the app.
# Usage: ./deploy.sh            (on the server, from anywhere)
#        PORT=8080 ./deploy.sh  (override host port; default 80)
set -euo pipefail

NAME="${NAME:-testrail-dashboard}"
PORT="${PORT:-80}"
VOLUME="${VOLUME:-trd-data}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Use sudo for docker unless we're root or already in the docker group.
DOCKER=docker
if [ "$(id -u)" -ne 0 ] && ! docker info >/dev/null 2>&1; then DOCKER="sudo docker"; fi

[ -f .env ] || { echo "Missing $DIR/.env (copy .env.example and fill it in)"; exit 1; }

echo "==> Pulling latest code"
git pull --ff-only
echo "    now at $(git log -1 --format='%h %s')"

echo "==> Building image (app keeps running meanwhile)"
$DOCKER build -t "$NAME" .

echo "==> Restarting container on port $PORT"
$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true
$DOCKER run -d --name "$NAME" --restart unless-stopped \
  -p "$PORT:3000" --env-file .env -v "$VOLUME:/app/data" "$NAME" >/dev/null

echo "==> Waiting for the app to answer"
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/api/connection" >/dev/null 2>&1; then
    echo "    OK: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
    $DOCKER image prune -f >/dev/null # drop the previous, now-untagged image
    exit 0
  fi
  sleep 1
done

echo "App did not respond within 30s. Recent logs:"
$DOCKER logs --tail 40 "$NAME"
exit 1
