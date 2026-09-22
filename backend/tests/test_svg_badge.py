from app.services.svg_badge import render_flat_badge


def test_render_flat_badge_includes_label_value_and_color():
    svg = render_flat_badge("status", "operational", "#3fb950")

    assert svg.startswith("<svg")
    assert 'aria-label="status: operational"' in svg
    assert ">status<" in svg
    assert ">operational<" in svg
    assert 'fill="#3fb950"' in svg


def test_render_flat_badge_widens_for_longer_text():
    short = render_flat_badge("status", "ok", "#3fb950")
    long = render_flat_badge("status", "unavailable", "#9f9f9f")

    def width(svg: str) -> int:
        return int(svg.split('width="', 1)[1].split('"', 1)[0])

    assert width(long) > width(short)
