#!/bin/zsh
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "İlk kurulum: bağımlılıklar indiriliyor (bir kereye mahsus)…"
  npm install
fi

export OBSIDIAN_VAULT_PATH="/Users/berat/english"
npm run dev
