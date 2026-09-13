#!/bin/sh
set -eu

DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

wait_for_db() {
  elapsed=0
  while [ "$elapsed" -lt "$DB_WAIT_TIMEOUT" ]; do
    if node -e "const net=require('node:net');const url=new URL(process.env.DATABASE_URL);const s=net.connect({host:url.hostname,port:Number(url.port||5432)});s.setTimeout(2000);s.once('connect',()=>{s.end();process.exit(0)});s.once('error',()=>process.exit(1));s.once('timeout',()=>{s.destroy();process.exit(1)});"; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  return 1
}

if ! wait_for_db; then
  echo "Database not reachable after ${DB_WAIT_TIMEOUT}s" >&2
  exit 1
fi

if [ "$RUN_MIGRATIONS" = "true" ]; then
  ./node_modules/.bin/prisma migrate deploy
fi

exec "$@"
