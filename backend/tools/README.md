# CareerDisha Tools

## OMR Form Generation

These scripts generate the print-ready OMR assessment forms.

### Prerequisites
```bash
pip install reportlab
```

### Fonts
Place these font files in `backend/fonts/`:
- `NotoSans-Regular.ttf` (or `NotoSans.ttf`)
- `NotoSansDevanagari-Regular.ttf`

Download from https://fonts.google.com/noto

### Generate forms
```bash
cd backend
python tools/generate_omr_form.py          # 2-page A4 assessment form
python tools/generate_class10_slip.py      # Half-A4 Class 10 stream preference slip
```

Output: PDF files in `backend/output/`
