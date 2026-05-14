"""
Marsh classifier on Modal — GPU-backed sidecar (v2, merged fp16).

Why Modal: a 16 GB Mac can't fit Gemma 4 E4B in bf16 (single MPS buffer
caps at 14.56 GB). Modal gives a persistent URL on an L4 GPU, fits
bf16 cleanly, and survives the judging window.

What this version loads: the **merged fp16 checkpoint** produced by the
v2 Kaggle notebook (gluten-gemma4-marsh-qlora-v2). The LoRA is already
folded into the base. No PEFT, no bitsandbytes, no transformers-5.x bnb
regression in the inference path.

Deploy:
  pip install modal
  modal token new                      # one-time auth in browser
  modal secret create huggingface HF_TOKEN=hf_...   # one-time
  cd services/marsh-sidecar
  modal deploy modal_app.py

Then copy the printed URL into web/.env.local:
  MARSH_SIDECAR_URL=https://<workspace>--marsh-sidecar-predict.modal.run
"""

from __future__ import annotations

import io
import time
from typing import Any

import modal

APP_NAME = "marsh-sidecar"

# The merged fp16 checkpoint produced by gluten-gemma4-marsh-qlora-v2.ipynb.
# Unsloth's save_pretrained_merged(save_method='merged_16bit') dequantized
# the 4-bit base and folded the LoRA in, so this is a single fp16 model.
# v2 test metrics: 70% accuracy, Marsh-3b F1 = 0.84 on a 400-patch held-out
# split of IBDColEpi (proxy Marsh labels).
MERGED_REPO = "faith-ogun/gluten-gemma4-marsh-merged"

CLASSES = ["Marsh-0", "Marsh-1", "Marsh-3a", "Marsh-3b"]
PROMPT = (
    "You are a histopathology assistant. Classify the Marsh grade of "
    "this HE-stained intestinal biopsy patch. Respond with exactly one "
    "of: Marsh-0, Marsh-1, Marsh-3a, Marsh-3b."
)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.5.1",
        # No bnb pin needed: the merged model is fp16, no bitsandbytes in
        # the load path. Pin transformers 5.x for Gemma 4 architecture
        # support (4.55 doesn't have Gemma4Processor).
        "transformers>=5.8.0,<6.0.0",
        "accelerate>=1.0.0",
        "pillow>=11.0.0",
        "timm>=1.0.11",
        "huggingface_hub>=0.25.0",
        "fastapi>=0.115.0",
        "pydantic>=2.9.0",
    )
)

app = modal.App(APP_NAME, image=image)
hf_secret = modal.Secret.from_name("huggingface")
volume = modal.Volume.from_name("marsh-cache", create_if_missing=True)


@app.cls(
    gpu="L4",                          # 24 GB, fits fp16 8B cleanly
    secrets=[hf_secret],
    volumes={"/root/.cache/huggingface": volume},
    scaledown_window=600,              # idle 10 min then sleep
    timeout=300,
)
@modal.concurrent(max_inputs=4)
class Marsh:
    @modal.enter()
    def load(self) -> None:
        import os
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        token = os.environ["HF_TOKEN"]
        self.processor = AutoProcessor.from_pretrained(MERGED_REPO, token=token)
        # Single load, no LoRA layering, no bnb runtime path.
        self.model = AutoModelForImageTextToText.from_pretrained(
            MERGED_REPO,
            dtype=torch.bfloat16,
            device_map="cuda",
            token=token,
        )
        self.model.eval()

    def _parse(self, text: str) -> str:
        norm = text.lower().replace(" ", "").replace("_", "-")
        for c in CLASSES:
            if c.lower() in norm:
                return c
        return "unknown"

    @modal.method()
    def predict(self, image_b64: str) -> dict[str, Any]:
        import base64
        import torch
        from PIL import Image

        raw = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB").resize((224, 224))

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": img},
                    {"type": "text", "text": PROMPT},
                ],
            }
        ]
        inputs = self.processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to("cuda")

        t0 = time.perf_counter()
        with torch.inference_mode():
            out = self.model.generate(**inputs, max_new_tokens=8, do_sample=False)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        new_tokens = out[0, inputs["input_ids"].shape[1]:]
        text = self.processor.decode(new_tokens, skip_special_tokens=True).strip()
        return {
            "marsh": self._parse(text),
            "raw": text,
            "classes": CLASSES,
            "device": "cuda-l4",
            "latency_ms": latency_ms,
            "caveat": (
                "Model trained on weak-supervision proxy Marsh labels "
                "(IBDColEpi colon epithelium coverage), not pathologist-"
                "validated. Test accuracy 70%, Marsh-3b F1 0.84."
            ),
        }


# FastAPI shim so the Next.js route can POST plain JSON
@app.function(
    secrets=[hf_secret],
    scaledown_window=600,
)
@modal.fastapi_endpoint(method="POST", label="predict")
def predict_endpoint(payload: dict) -> dict[str, Any]:
    image_b64 = payload.get("image_b64") or payload.get("imageBase64")
    if not image_b64:
        return {"error": "missing image_b64"}
    return Marsh().predict.remote(image_b64)


@app.function()
@modal.fastapi_endpoint(method="GET", label="health")
def health_endpoint() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "merged_repo": MERGED_REPO,
        "classes": CLASSES,
        "version": "v2-merged-fp16",
    }
