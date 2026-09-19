#!/bin/sh
set -eu

dev_vars=".dev.vars"
held_vars=".dev.vars.deploy-held"
restore_vars() {
  if [ -f "$held_vars" ]; then mv "$held_vars" "$dev_vars"; fi
}
trap restore_vars EXIT INT TERM
if [ -f "$dev_vars" ]; then mv "$dev_vars" "$held_vars"; fi
npx vinext-cloudflare deploy --config dist/server/wrangler.json
