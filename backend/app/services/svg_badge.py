"""Minimal flat-style SVG badge renderer, in the shape popularized by shields.io.

Label and value are expected to be short, code-controlled vocabulary (never
arbitrary user input), so no XML escaping is performed.
"""

_CHAR_WIDTH = 6.5
_TEXT_PADDING = 10
_HEIGHT = 20


def _text_width(text: str) -> float:
    return len(text) * _CHAR_WIDTH + _TEXT_PADDING


def render_flat_badge(label: str, value: str, color: str) -> str:
    label_width = round(_text_width(label))
    value_width = round(_text_width(value))
    total_width = label_width + value_width
    label_center = label_width / 2
    value_center = label_width + value_width / 2
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="{_HEIGHT}" role="img" aria-label="{label}: {value}">
<linearGradient id="s" x2="0" y2="100%">
<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
<stop offset="1" stop-opacity=".1"/>
</linearGradient>
<clipPath id="r"><rect width="{total_width}" height="{_HEIGHT}" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="{label_width}" height="{_HEIGHT}" fill="#555"/>
<rect x="{label_width}" width="{value_width}" height="{_HEIGHT}" fill="{color}"/>
<rect width="{total_width}" height="{_HEIGHT}" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="{label_center:.1f}" y="14">{label}</text>
<text x="{value_center:.1f}" y="14">{value}</text>
</g>
</svg>'''
