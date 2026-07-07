#!/bin/sh
# Boot the backend. When Litestream is configured (LITESTREAM_BUCKET +
# credentials), restore the DB from the replica on a fresh disk and then run the
# app under `litestream replicate` so every write is streamed to S3. Otherwise
# run node directly — keeps local/dev images working with zero backup setup.
set -e

DB="${DATA_DIR:-/data}/studyfinder.db"
APP="node backend/dist/index.js"

if [ -n "$LITESTREAM_BUCKET" ] && [ -n "$LITESTREAM_ACCESS_KEY_ID" ] && [ -n "$LITESTREAM_SECRET_ACCESS_KEY" ]; then
  # Defaults for the optional knobs — Litestream's YAML env-expansion has no
  # shell-style :- fallback, so fill them in here before it reads the config.
  export LITESTREAM_REGION="${LITESTREAM_REGION:-us-east-1}"
  export LITESTREAM_PATH="${LITESTREAM_PATH:-studyfinder}"
  echo "litestream: enabled (bucket=$LITESTREAM_BUCKET, region=$LITESTREAM_REGION)"

  # Fresh volume with no DB yet? Pull the latest snapshot from the replica.
  if [ ! -f "$DB" ]; then
    echo "litestream: no local DB — attempting restore from replica…"
    litestream restore -if-replica-exists -config /etc/litestream.yml "$DB" \
      || echo "litestream: no replica to restore (starting a new database)"
  fi

  # `-exec` supervises the app and forwards signals, so graceful shutdown still
  # works; Litestream flushes the final WAL when the app exits.
  exec litestream replicate -config /etc/litestream.yml -exec "$APP"
else
  echo "litestream: disabled (set LITESTREAM_BUCKET + credentials to enable backups)"
  exec $APP
fi
