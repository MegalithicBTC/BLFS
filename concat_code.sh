#!/bin/bash
set -euo pipefail

out="./tmp/concat_sources.txt"
mkdir -p ./tmp
rm -f "$out"

# Define code file extensions to include
code_extensions=(
  "ts" "js" "css" "ejs" "json" "yml" "yaml" "sh" "toml"
  "cjs" "mjs" "tsx" "jsx" "html"
)

# Root-level files to always include (if not ignored by .gitignore)
roots=(
  "Caddyfile"
  "Dockerfile"
  "docker-compose.yml"
  "docker-start.sh"
  "glances.sh"
  "litestream.yml"
  "readme.md"
  "package.json"
  "tsconfig.json"
  "shopify.app.toml"
)

# Function to check if a file has a code-related extension
is_code_file() {
  local file="$1"
  local ext="${file##*.}"
  for code_ext in "${code_extensions[@]}"; do
    if [ "$ext" = "$code_ext" ]; then
      echo "$file" | grep -q "package-lock.json$" && return 1
      return 0
    fi
  done
  for root_file in "${roots[@]}"; do
    if [ "$(basename "$file")" = "$root_file" ]; then
      return 0
    fi
  done
  return 1
}

# Get all tracked files from Git (respects .gitignore)
while IFS= read -r file; do
  if is_code_file "$file"; then
    echo "===== FILE: $file =====" >> "$out"
    cat "$file" >> "$out"
    echo -e "\n\n" >> "$out"
  fi
done < <(git ls-files)
