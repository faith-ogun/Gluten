# marsh-sidecar

FastAPI service that loads Gemma 4 E4B + the Marsh-classifier LoRA adapter
(`notebooks/gemma-marsh-qlora.ipynb`, 72% accuracy / Marsh-3b F1 0.87) and
serves structural-layer predictions to the Next.js app.

## Quickstart (Mac, MPS)

```bash
cd services/marsh-sidecar
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Pull adapter from Kaggle/HF into ./adapter (134 MB)
# e.g. huggingface-cli download <user>/gluten-gemma4-marsh-lora --local-dir ./adapter

uvicorn app:app --host 127.0.0.1 --port 7860
```

Then in `web/.env.local`:

```
MARSH_SIDECAR_URL=http://127.0.0.1:7860/predict
```

## Endpoints

- `GET /health` — `{ ok, device, base_model, adapter_present, error }`
- `POST /predict` — `{ image_b64 }` → `{ marsh, raw, classes, device, latency_ms, caveat }`

## Notes

- First call cold-loads the base model (~5 GB), expect 30-60s on MPS.
- Predictions are weak-supervision proxies. The caveat is included in
  every response and surfaced by the web route.
