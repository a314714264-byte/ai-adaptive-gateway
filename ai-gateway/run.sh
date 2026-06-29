#!/bin/bash
cd "$(dirname "$0")"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 300
