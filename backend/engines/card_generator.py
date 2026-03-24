"""Share Card Generator — creates 1080x1920 PNG cards for WhatsApp/Instagram sharing."""

import io
import logging
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import qrcode

from config import BRAND_COLORS, RIASEC_TYPE_NAMES, FONTS_DIR, OUTPUT_DIR

logger = logging.getLogger(__name__)

# Card dimensions (Instagram story / WhatsApp status)
CARD_W, CARD_H = 1080, 1920

# Colors
PRIMARY = BRAND_COLORS["primary"]
SECONDARY = BRAND_COLORS["secondary"]
ACCENT = BRAND_COLORS["accent"]
WHITE = "#FFFFFF"
LIGHT_BG = "#F0F4F8"
DARK_TEXT = "#1C2833"
GRAY_TEXT = "#666666"


def _hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Load Noto Sans font, fallback to default."""
    font_name = "NotoSansDevanagari-Regular.ttf"
    font_path = FONTS_DIR / font_name
    if font_path.exists():
        return ImageFont.truetype(str(font_path), size)
    try:
        return ImageFont.truetype("Arial", size)
    except OSError:
        return ImageFont.load_default()


def generate_share_card(student) -> bytes:
    """Generate a shareable 1080x1920 PNG card for a student.

    Args:
        student: Student model object with riasec_scores, holland_code, matched_careers, name, class_level

    Returns:
        PNG image bytes
    """
    img = Image.new("RGB", (CARD_W, CARD_H), _hex_to_rgb(WHITE))
    draw = ImageDraw.Draw(img)

    # Fonts
    font_title = _load_font(48)
    font_large = _load_font(64)
    font_medium = _load_font(36)
    font_small = _load_font(28)
    font_tiny = _load_font(22)

    y = 0

    # Header bar
    draw.rectangle([0, 0, CARD_W, 180], fill=_hex_to_rgb(PRIMARY))
    draw.text((60, 40), "Career", fill=_hex_to_rgb(WHITE), font=font_title)
    draw.text((60 + draw.textlength("Career", font=font_title), 40), "Disha", fill=_hex_to_rgb(SECONDARY), font=font_title)
    draw.text((60, 100), "AI-Powered Career Assessment", fill=(*_hex_to_rgb(WHITE)[:3],), font=font_small)

    # Gold accent line
    draw.rectangle([0, 180, CARD_W, 186], fill=_hex_to_rgb(SECONDARY))

    y = 240

    # "My Career Profile" title
    title = "My Career Profile"
    tw = draw.textlength(title, font=font_title)
    draw.text(((CARD_W - tw) / 2, y), title, fill=_hex_to_rgb(PRIMARY), font=font_title)
    y += 80

    # Student name
    name = student.name or "Student"
    nw = draw.textlength(name, font=font_large)
    draw.text(((CARD_W - nw) / 2, y), name, fill=_hex_to_rgb(DARK_TEXT), font=font_large)
    y += 90

    # Class
    cls_text = f"Class {student.class_level}" + (f"-{student.section}" if student.section else "")
    cw = draw.textlength(cls_text, font=font_medium)
    draw.text(((CARD_W - cw) / 2, y), cls_text, fill=_hex_to_rgb(GRAY_TEXT), font=font_medium)
    y += 80

    # Holland Code box
    code = student.holland_code or "---"
    draw.rounded_rectangle([140, y, CARD_W - 140, y + 140], radius=20, fill=_hex_to_rgb(LIGHT_BG))
    label = "Holland Code"
    lw = draw.textlength(label, font=font_small)
    draw.text(((CARD_W - lw) / 2, y + 15), label, fill=_hex_to_rgb(GRAY_TEXT), font=font_small)
    code_font = _load_font(72)
    codew = draw.textlength(code, font=code_font)
    draw.text(((CARD_W - codew) / 2, y + 55), code, fill=_hex_to_rgb(PRIMARY), font=code_font)
    y += 180

    # RIASEC mini bars
    scores = student.riasec_scores or {}
    bar_x = 100
    bar_w = CARD_W - 200
    for dim in "RIASEC":
        val = scores.get(dim, 0)
        label = f"{dim} ({RIASEC_TYPE_NAMES.get(dim, dim)})"
        draw.text((bar_x, y), label, fill=_hex_to_rgb(DARK_TEXT), font=font_tiny)
        draw.text((bar_x + bar_w - 60, y), f"{val:.0f}%", fill=_hex_to_rgb(PRIMARY), font=font_tiny)
        y += 30
        # Background bar
        draw.rounded_rectangle([bar_x, y, bar_x + bar_w, y + 16], radius=8, fill=_hex_to_rgb(LIGHT_BG))
        # Fill bar
        fill_w = max(10, int(bar_w * val / 100))
        draw.rounded_rectangle([bar_x, y, bar_x + fill_w, y + 16], radius=8, fill=_hex_to_rgb(PRIMARY))
        y += 30

    y += 20

    # Top 3 career matches
    matches = student.matched_careers or []
    if matches:
        draw.text((100, y), "Top Career Matches", fill=_hex_to_rgb(PRIMARY), font=font_medium)
        y += 60
        for i, m in enumerate(matches[:3]):
            career_name = m.get("career_name", m.get("career_id", ""))
            match_pct = m.get("match_score", 0)
            # Rank circle
            cx, cy = 130, y + 20
            draw.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=_hex_to_rgb(PRIMARY))
            rk = str(i + 1)
            rkw = draw.textlength(rk, font=font_small)
            draw.text((cx - rkw / 2, cy - 14), rk, fill=_hex_to_rgb(WHITE), font=font_small)
            # Career text
            draw.text((180, y + 5), career_name, fill=_hex_to_rgb(DARK_TEXT), font=font_small)
            draw.text((180, y + 40), f"{match_pct}% match", fill=_hex_to_rgb(ACCENT), font=font_tiny)
            y += 80

    # Divider
    y += 20
    draw.rectangle([100, y, CARD_W - 100, y + 2], fill=_hex_to_rgb(SECONDARY))
    y += 30

    # Footer
    footer = "Discover your career path at"
    fw = draw.textlength(footer, font=font_tiny)
    draw.text(((CARD_W - fw) / 2, y), footer, fill=_hex_to_rgb(GRAY_TEXT), font=font_tiny)
    y += 35
    url = "www.careerdisha.com"
    uw = draw.textlength(url, font=font_small)
    draw.text(((CARD_W - uw) / 2, y), url, fill=_hex_to_rgb(PRIMARY), font=font_small)

    # Convert to bytes
    buf = io.BytesIO()
    img.save(buf, format="PNG", quality=95)
    buf.seek(0)
    return buf.getvalue()


def generate_and_save_card(student, output_dir: Path = None) -> Path:
    """Generate card and save to disk. Returns file path."""
    if output_dir is None:
        output_dir = OUTPUT_DIR / "cards"
    output_dir.mkdir(parents=True, exist_ok=True)

    png_bytes = generate_share_card(student)
    safe_name = student.name.replace(" ", "_").replace("/", "_")
    filename = f"{student.student_id_external}_{safe_name}_card.png"
    path = output_dir / filename
    path.write_bytes(png_bytes)
    return path
