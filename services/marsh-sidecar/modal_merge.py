"""
One-shot: load Unsloth bnb-4bit base + our LoRA on a Modal GPU, merge,
dequantize to bf16, push merged fp16 weights to HF as a new repo.

Run once:
  modal run modal_merge.py

After that, modal_app.py loads from the merged repo with no bnb at all.
"""

from __future__ import annotations
import modal

BASE_MODEL = "unsloth/gemma-4-E4B-it-unsloth-bnb-4bit"
ADAPTER_REPO = "faith-ogun/gluten-gemma4-marsh-lora"
MERGED_REPO = "faith-ogun/gluten-gemma4-marsh-merged"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch>=2.4.0",
        "transformers>=4.50.0",
        "peft>=0.13.0",
        "accelerate>=1.0.0",
        "bitsandbytes>=0.44.0",
        "pillow>=11.0.0",
        "timm>=1.0.11",
        "huggingface_hub>=0.25.0",
    )
)

app = modal.App("marsh-merge", image=image)
hf_secret = modal.Secret.from_name("huggingface")


@app.function(gpu="L4", secrets=[hf_secret], timeout=1800)
def merge_and_push() -> str:
    import os, torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    from peft import PeftModel
    from huggingface_hub import HfApi, create_repo

    token = os.environ["HF_TOKEN"]

    print("loading base 4-bit...")
    base = AutoModelForImageTextToText.from_pretrained(
        BASE_MODEL, device_map="cuda", token=token
    )
    print("loading LoRA...")
    peft_model = PeftModel.from_pretrained(base, ADAPTER_REPO, token=token)

    print("merge_and_unload (dequantizes 4-bit + folds LoRA)...")
    merged = peft_model.merge_and_unload()
    merged = merged.to(torch.bfloat16)

    out_dir = "/tmp/merged"
    os.makedirs(out_dir, exist_ok=True)
    print("saving processor + model to", out_dir)
    AutoProcessor.from_pretrained(BASE_MODEL, token=token).save_pretrained(out_dir)
    merged.save_pretrained(out_dir, safe_serialization=True)

    print("pushing to", MERGED_REPO)
    api = HfApi(token=token)
    create_repo(MERGED_REPO, repo_type="model", private=True, exist_ok=True, token=token)
    api.upload_folder(
        folder_path=out_dir,
        repo_id=MERGED_REPO,
        repo_type="model",
        commit_message="Merged Gemma 4 E4B + Marsh LoRA (bf16)",
    )
    return f"pushed {MERGED_REPO}"


@app.local_entrypoint()
def main():
    print(merge_and_push.remote())
