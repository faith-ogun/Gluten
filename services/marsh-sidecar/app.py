"""
Marsh classifier sidecar.

Loads the Gemma 4 E4B base model + the LoRA adapter trained on Kaggle
(notebooks/gemma-marsh-qlora.ipynb, 72% / Marsh-3b F1 0.87) and serves
structural-layer predictions to the Next.js app.

Run locally on Mac (MPS) or Linux (CUDA). Default port 7860.

Env:
  MARSH_BASE_MODEL   default: google/gemma-4-E4B-it       (Gemma 4 E4B multimodal)
  MARSH_ADAPTER_DIR  default: ./adapter                   (downloaded LoRA dir)
  MARSH_DEVICE       default: auto (mps > cuda > cpu)
  MARSH_PORT         default: 7860

Routes:
  GET  /health     liveness + which device + adapter status
  POST /predict    { image_b64: str } -> { marsh, confidence, top_logits, latency_ms }
"""

from __future__ import annotations

import base64
import io
import os
import time
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel
from transformers import AutoModelForImageTextToText, AutoProcessor

BASE_MODEL = os.environ.get("MARSH_BASE_MODEL", "google/gemma-4-E4B-it")
ADAPTER_DIR = os.environ.get("MARSH_ADAPTER_DIR", "./adapter")
PORT = int(os.environ.get("MARSH_PORT", "7860"))

CLASSES = ["Marsh-0", "Marsh-1", "Marsh-3a", "Marsh-3b"]
PROMPT = (
    "You are a histopathology assistant. Classify this duodenal mucosa "
    "patch into one of: Marsh-0, Marsh-1, Marsh-3a, Marsh-3b. Respond "
    "with the class label only."
)


def pick_device() -> str:
    forced = os.environ.get("MARSH_DEVICE")
    if forced:
        return forced
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


DEVICE = pick_device()
# fp32 of an 8B multimodal model overshoots Mac unified memory (~29 GB).
# bf16 halves it and is supported on MPS in torch>=2.4. CPU stays fp32.
DTYPE = torch.bfloat16 if DEVICE in {"mps", "cuda"} else torch.float32

state: dict[str, Any] = {"model": None, "processor": None, "loaded": False, "error": None}


def load_model() -> None:
    try:
        processor = AutoProcessor.from_pretrained(BASE_MODEL)
        model = AutoModelForImageTextToText.from_pretrained(
            BASE_MODEL,
            torch_dtype=DTYPE,
            device_map=DEVICE,
        )
        if os.path.isdir(ADAPTER_DIR):
            from peft import PeftModel

            model = PeftModel.from_pretrained(model, ADAPTER_DIR)
        else:
            state["error"] = f"adapter dir missing: {ADAPTER_DIR} (running base model)"
        model.eval()
        state["processor"] = processor
        state["model"] = model
        state["loaded"] = True
    except Exception as e:
        state["error"] = f"{type(e).__name__}: {e}"
        state["loaded"] = False


app = FastAPI(title="marsh-sidecar")


@app.on_event("startup")
def _startup() -> None:
    load_model()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": state["loaded"],
        "device": DEVICE,
        "dtype": str(DTYPE),
        "base_model": BASE_MODEL,
        "adapter_dir": ADAPTER_DIR,
        "adapter_present": os.path.isdir(ADAPTER_DIR),
        "error": state["error"],
    }


class PredictReq(BaseModel):
    image_b64: str


def parse_label(text: str) -> str:
    norm = text.lower().replace(" ", "").replace("_", "-")
    for c in CLASSES:
        if c.lower() in norm:
            return c
    return "unknown"


@app.post("/predict")
def predict(req: PredictReq) -> dict[str, Any]:
    if not state["loaded"]:
        raise HTTPException(503, f"model not loaded: {state['error']}")

    try:
        raw = base64.b64decode(req.image_b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"bad image_b64: {e}")

    processor = state["processor"]
    model = state["model"]
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": img},
                {"type": "text", "text": PROMPT},
            ],
        }
    ]
    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    ).to(DEVICE)

    t0 = time.perf_counter()
    with torch.inference_mode():
        out = model.generate(**inputs, max_new_tokens=12, do_sample=False)
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    new_tokens = out[0, inputs["input_ids"].shape[1]:]
    text = processor.decode(new_tokens, skip_special_tokens=True).strip()
    label = parse_label(text)

    return {
        "marsh": label,
        "raw": text,
        "classes": CLASSES,
        "device": DEVICE,
        "latency_ms": latency_ms,
        "caveat": (
            "LoRA trained on weak-supervision proxy Marsh labels (IBDColEpi "
            "colon epithelium coverage), not pathologist-validated."
        ),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=PORT)
