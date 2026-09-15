#!/usr/bin/env bash
# Refait la notice PDF de bout en bout : captures d'écran prises dans l'application réelle,
# puis mise en page imprimée. À relancer après toute modification de l'interface, sinon la
# notice montre une application qui n'existe plus.
set -e
cd "$(dirname "$0")/.."

echo "captures d'écran..."
npx playwright test --config=notice/playwright.notice.config.ts

echo "mise en page..."
node notice/rendre-pdf.mjs
