#!/bin/sh
# Copies the engine and the shared files it imports into desktop/engine, so the app bundle carries it.
# Layout inside the bundle: engine/engine/*.ts (+ node_modules) and engine/shared/*.ts, as in the repo.
set -e
cd "$(dirname "$0")"
rm -rf engine && mkdir -p engine/engine engine/shared
(cd ../engine && npm install --silent --omit=dev)
cp ../engine/*.ts ../engine/package.json engine/engine/
cp -R ../engine/node_modules engine/engine/
cp ../shared/capture.ts ../shared/types.ts engine/shared/
