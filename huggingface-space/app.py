import os
import urllib.request
import gradio as gr
import numpy as np
from PIL import Image
import torch
from realesrgan import RealESRGANer
from basicsr.archs.rrdbnet_arch import RRDBNet

# Download official Real-ESRGAN x4plus weights
model_path = "RealESRGAN_x4plus.pth"
if not os.path.exists(model_path):
    urllib.request.urlretrieve(
        "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        model_path,
    )

model = RRDBNet(
    num_in_ch=3, num_out_ch=3, num_feat=64,
    num_block=23, num_grow_ch=32, scale=4,
)
upsampler = RealESRGANer(
    scale=4,
    model_path=model_path,
    model=model,
    tile=256,
    tile_pad=10,
    pre_pad=0,
    half=False,
    device="cpu",
)


def enhance(image: Image.Image) -> Image.Image:
    if image is None:
        raise gr.Error("画像を選択してください")

    # Limit input size for CPU performance
    max_dim = 512
    w, h = image.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # PIL (RGB) -> cv2 (BGR)
    img = np.array(image)[:, :, ::-1]

    output, _ = upsampler.enhance(img, outscale=4)

    # cv2 (BGR) -> PIL (RGB)
    return Image.fromarray(output[:, :, ::-1])


demo = gr.Interface(
    fn=enhance,
    inputs=gr.Image(type="pil", label="元の画像"),
    outputs=gr.Image(type="pil", label="高画質化", format="png"),
    title="kirei photo AI",
    description="Real-ESRGANによる画像超解像（4x）",
    allow_flagging="never",
)

demo.launch()
