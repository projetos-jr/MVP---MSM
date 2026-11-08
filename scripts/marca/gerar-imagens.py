#!/usr/bin/env python3
"""
Gera as imagens de marca do chatbot a partir do logo e de uma foto.

Uso (na raiz do projeto):
    python3 scripts/marca/gerar-imagens.py --logo caminho/logo.png --foto caminho/foto.jpg

Gera (sobrescrevendo):
    public/logo.png               logo completo, recortado, 800 px de largura
    public/logo-mark.png          só a parte de cima do logo (ex.: as letras "MSM"),
                                  usada no avatar do assistente e nos ícones
    public/login-bg.jpg           foto de fundo da tela de entrada (otimizada)
    app/icon.png                  ícone da aba do navegador
    app/apple-icon.png            ícone do iPhone (tela inicial)
    public/icons/icon-192.png     ícones do Android / app instalado
    public/icons/icon-512.png
    public/icons/icon-maskable-512.png

Depois, atualize width/height de `logo` e `logoMark` em config/brand.ts com os
tamanhos que este script imprime.

O logo deve ter fundo transparente (PNG). Fundo branco também funciona: o
recorte ignora pixels quase brancos. Se o logo não tiver uma "faixa vazia"
separando o símbolo do texto de baixo, o logo inteiro vira a marca do avatar.
Requer Pillow (pip install pillow).
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]


def is_background(pixel) -> bool:
    r, g, b, a = pixel
    return a <= 8 or (r > 245 and g > 245 and b > 245)


def content_mask(img: Image.Image) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    src = img.load()
    dst = mask.load()
    for y in range(img.height):
        for x in range(img.width):
            if not is_background(src[x, y]):
                dst[x, y] = 255
    return mask


def trim(img: Image.Image) -> Image.Image:
    box = content_mask(img).getbbox()
    return img.crop(box) if box else img


def split_mark(logo: Image.Image) -> Image.Image:
    """Parte de cima do logo, acima da maior faixa horizontal vazia."""
    mask = content_mask(logo)
    rows = [mask.crop((0, y, logo.width, y + 1)).getbbox() is None for y in range(logo.height)]
    best_start, best_len, start = None, 0, None
    for y, empty in enumerate(rows + [False]):
        if empty and start is None:
            start = y
        elif not empty and start is not None:
            if y - start > best_len and start > logo.height * 0.4:
                best_start, best_len = start, y - start
            start = None
    if best_start is None or best_len < 3:
        return logo
    return trim(logo.crop((0, 0, logo.width, best_start)))


def resize_width(img: Image.Image, width: int) -> Image.Image:
    height = round(img.height * width / img.width)
    return img.resize((width, height), Image.LANCZOS)


def icon(mark: Image.Image, size: int, pad: float, rounded: bool, path: Path) -> None:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if rounded:
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.18), fill="white")
    else:
        draw.rectangle((0, 0, size, size), fill="white")
    inner = int(size * (1 - 2 * pad))
    scaled = mark.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {canvas.size}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--logo", required=True, help="PNG do logo (de preferência com fundo transparente)")
    parser.add_argument("--foto", help="foto de fundo da tela de entrada (JPG/PNG/WebP)")
    args = parser.parse_args()

    logo = trim(Image.open(args.logo).convert("RGBA"))
    full = resize_width(logo, 800)
    full.save(ROOT / "public/logo.png", optimize=True)
    print(f"public/logo.png  {full.size}  -> brand.logo width/height")

    mark = split_mark(logo)
    mark_out = resize_width(mark, 400)
    mark_out.save(ROOT / "public/logo-mark.png", optimize=True)
    print(f"public/logo-mark.png  {mark_out.size}  -> brand.logoMark width/height")

    icon(mark, 512, 0.12, True, ROOT / "app/icon.png")
    icon(mark, 180, 0.12, False, ROOT / "app/apple-icon.png")
    icon(mark, 192, 0.12, False, ROOT / "public/icons/icon-192.png")
    icon(mark, 512, 0.12, False, ROOT / "public/icons/icon-512.png")
    icon(mark, 512, 0.20, False, ROOT / "public/icons/icon-maskable-512.png")

    if args.foto:
        photo = Image.open(args.foto).convert("RGB")
        photo.thumbnail((1600, 1600), Image.LANCZOS)
        photo.save(ROOT / "public/login-bg.jpg", quality=78, optimize=True, progressive=True)
        print(f"public/login-bg.jpg  {photo.size}")


if __name__ == "__main__":
    main()
