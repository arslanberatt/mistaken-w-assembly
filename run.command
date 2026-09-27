#!/bin/zsh
set -e
cd "$(dirname "$0")"

echo "AssemblyAI anahtarın yalnızca bu açık Terminal oturumunda kullanılır; dosyaya kaydedilmez."
read -rs "ASSEMBLYAI_API_KEY?AssemblyAI API anahtarını yapıştır: "
echo ""
export ASSEMBLYAI_API_KEY
export OBSIDIAN_VAULT_PATH="/Users/berat/english"
node server.mjs
