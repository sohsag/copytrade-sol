#!/bin/bash
rm -r dist/
mkdir dist
mkdir dist/out
mkdir dist/out/copyTradeSettings
touch dist/out/errorLogs.txt
nvm use 20.15.1
tsc
ncc build dist/index.js -o dist/out
cd dist/out
pkg index.js
