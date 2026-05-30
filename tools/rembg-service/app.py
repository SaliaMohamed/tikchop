import io
import os

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image
from rembg import remove


app = FastAPI(title="Tikchop background cleaner")

MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
API_KEY = os.getenv("REMBG_API_KEY", "").strip()


def check_key(x_api_key: str | None) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def background_color(name: str) -> tuple[int, int, int] | None:
    value = (name or "warm").strip().lower()
    if value == "transparent":
        return None
    if value == "white":
        return (255, 255, 255)
    if value == "gray":
        return (242, 244, 241)
    return (248, 246, 238)


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true"}


@app.post("/remove")
async def remove_background(
    image: UploadFile = File(...),
    background: str = Form("warm"),
    x_api_key: str | None = Header(default=None),
) -> Response:
    check_key(x_api_key)

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Image missing")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")

    try:
        transparent_bytes = remove(content)
        product = Image.open(io.BytesIO(transparent_bytes)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Background removal failed") from exc

    color = background_color(background)
    output = io.BytesIO()

    if color is None:
        product.save(output, format="PNG", optimize=True)
        return Response(content=output.getvalue(), media_type="image/png")

    canvas = Image.new("RGBA", product.size, (*color, 255))
    canvas.alpha_composite(product)
    canvas.convert("RGB").save(output, format="JPEG", quality=92, optimize=True)
    return Response(content=output.getvalue(), media_type="image/jpeg")
