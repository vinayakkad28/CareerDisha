"""PDF Report Generator.

Takes JSON report content and generates branded 8-10 page PDF reports
using Jinja2 HTML templates and WeasyPrint.
"""

import base64
import io
from pathlib import Path
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

from config import BRAND_COLORS, RIASEC_TYPE_NAMES, RIASEC_ARCHETYPES, RIASEC_COLORS, TEMPLATES_DIR, FONTS_DIR, OUTPUT_DIR
from models import Student


def generate_radar_chart(riasec_scores: dict) -> str:
    """Generate RIASEC radar/spider chart as base64 PNG."""
    categories = ["R", "I", "A", "S", "E", "C"]
    labels = [f"{t}\n{RIASEC_TYPE_NAMES[t]}" for t in categories]
    values = [riasec_scores.get(t, 0) for t in categories]
    values.append(values[0])  # Close the polygon

    angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
    angles.append(angles[0])

    fig, ax = plt.subplots(figsize=(5, 5), subplot_kw=dict(polar=True))
    ax.fill(angles, values, color=BRAND_COLORS["primary"], alpha=0.2)
    ax.plot(angles, values, color=BRAND_COLORS["primary"], linewidth=2)

    # Add dots at each point
    for angle, value in zip(angles[:-1], values[:-1]):
        ax.plot(angle, value, "o", color=BRAND_COLORS["primary"], markersize=8)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylim(0, 100)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(["20", "40", "60", "80", "100"], fontsize=7, color="gray")
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


def generate_qr_code(url: str) -> str:
    """Generate QR code as base64 PNG."""
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=4, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1a5276", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()
    except Exception:
        return ""


def generate_bar_chart(riasec_scores: dict) -> str:
    """Generate RIASEC bar chart as base64 PNG, colour-coded per type."""
    categories = ["R", "I", "A", "S", "E", "C"]
    values = [riasec_scores.get(t, 0) for t in categories]
    colors = [RIASEC_COLORS[t] for t in categories]

    fig, ax = plt.subplots(figsize=(6, 2.5))
    bars = ax.barh(
        [RIASEC_TYPE_NAMES[t] for t in categories],
        values,
        color=colors,
        height=0.6,
    )

    # Add value labels
    for bar, val in zip(bars, values):
        ax.text(
            bar.get_width() + 1,
            bar.get_y() + bar.get_height() / 2,
            f"{val:.0f}%",
            va="center",
            fontsize=9,
            fontweight="bold",
        )

    ax.set_xlim(0, 110)
    ax.set_xlabel("Score (%)", fontsize=9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.tick_params(axis="y", labelsize=9)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


def render_report_html(
    student: Student,
    counsellor_name: str = "",
    counsellor_certification: str = "",
    counsellor_phone: str = "",
    web_report_url: str = "",
) -> str:
    """Render the full HTML report from student data."""
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("report_template.html")

    scores = student.riasec_scores or {}
    report = student.report_content or {}
    holland_code = student.holland_code or ""

    # Generate charts
    radar_chart_b64 = generate_radar_chart(scores)
    bar_chart_b64 = generate_bar_chart(scores)

    # QR code linking to web report (if URL provided)
    qr_code_b64 = generate_qr_code(web_report_url) if web_report_url else ""

    # Font path for CSS
    font_path = FONTS_DIR / "NotoSansDevanagari-Regular.ttf"
    font_url = font_path.as_uri() if font_path.exists() else ""

    # Primary type archetype for personalised display
    primary_type = holland_code[0] if holland_code else ""

    context = {
        "student": {
            "name": student.name,
            "class_level": student.class_level,
            "section": student.section,
            "holland_code": holland_code,
            "parent_name": student.parent_name,
        },
        "scores": scores,
        "report": report,
        "radar_chart": radar_chart_b64,
        "bar_chart": bar_chart_b64,
        "qr_code": qr_code_b64,
        "brand": BRAND_COLORS,
        "riasec_names": RIASEC_TYPE_NAMES,
        "riasec_archetypes": RIASEC_ARCHETYPES,
        "riasec_colors": RIASEC_COLORS,
        "primary_type": primary_type,
        "primary_archetype": RIASEC_ARCHETYPES.get(primary_type, ""),
        "primary_color": RIASEC_COLORS.get(primary_type, BRAND_COLORS["primary"]),
        "today": date.today().strftime("%d %B %Y"),
        "font_url": font_url,
        "counsellor_name": counsellor_name,
        "counsellor_certification": counsellor_certification,
        "counsellor_phone": counsellor_phone,
        "web_report_url": web_report_url,
    }

    return template.render(**context)


def generate_student_pdf(
    student: Student,
    output_dir: Path = None,
    counsellor_name: str = "",
    counsellor_certification: str = "",
    counsellor_phone: str = "",
    web_report_url: str = "",
) -> Path:
    """Generate PDF for a single student. Returns the output file path."""
    if output_dir is None:
        output_dir = OUTPUT_DIR

    output_dir.mkdir(parents=True, exist_ok=True)

    html_content = render_report_html(
        student, counsellor_name, counsellor_certification,
        counsellor_phone=counsellor_phone, web_report_url=web_report_url,
    )

    # Build filename
    safe_name = student.name.replace(" ", "_").replace("/", "_")
    filename = f"{student.student_id_external}_{safe_name}_report.pdf"
    output_path = output_dir / filename

    font_config = FontConfiguration()
    HTML(string=html_content, base_url=str(TEMPLATES_DIR)).write_pdf(
        str(output_path),
        font_config=font_config,
    )

    return output_path
