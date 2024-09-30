#!/bin/bash
rm -r dist/
mkdir dist
mkdir dist/out
mkdir dist/out/copyTradeSettings
mkdir dist/out/findWalletResults
touch dist/out/errorLogs.txt
tsc
ncc build dist/index.js -o dist/out
cd dist/out
pkg index.js
