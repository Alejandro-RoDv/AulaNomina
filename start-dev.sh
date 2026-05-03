#!/usr/bin/env bash

PROJECT_DIR="$HOME/Documentos/AulaNomina"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

konsole --new-tab \
  --workdir "$BACKEND_DIR" \
  -p tabtitle="AulaNomina Backend" \
  -e bash -c "source venv/bin/activate && uvicorn app.main:app --reload; exec bash" &

sleep 1

konsole --new-tab \
  --workdir "$FRONTEND_DIR" \
  -p tabtitle="AulaNomina Frontend" \
  -e bash -c "npm run dev; exec bash" &