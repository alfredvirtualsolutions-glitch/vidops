PY ?= python
VENV := .venv-gpu

.PHONY: install-gpu gpu-check dev build deploy

install-gpu:
	$(PY) -m venv $(VENV)
	$(VENV)/Scripts/python -m pip install --upgrade pip
	$(VENV)/Scripts/python -m pip install -r requirements-gpu.txt

gpu-check:
	$(VENV)/Scripts/python worker/gpu_check.py

dev:
	npm run dev

build:
	npm run build

deploy: build
	vercel --prod
