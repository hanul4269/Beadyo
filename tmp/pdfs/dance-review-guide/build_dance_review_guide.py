from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader


ROOT = Path("/Users/hanul/Desktop/Claude project/beadyo")
SCREEN_DIR = ROOT / "tmp/pdfs/dance-review-guide/screens"
OUT = ROOT / "output/pdf/dance-review-page-guide.pdf"
FONT_PATHS = [
    Path("/System/Library/Fonts/Supplemental/AppleGothic.ttf"),
    Path("/System/Library/Fonts/Supplemental/NotoSansGothic-Regular.ttf"),
]


def register_font():
    for path in FONT_PATHS:
        if path.exists():
            try:
                pdfmetrics.registerFont(TTFont("GuideKR", str(path)))
                return "GuideKR"
            except Exception:
                pass
    pdfmetrics.registerFont(UnicodeCIDFont("HYGoThic-Medium"))
    return "HYGoThic-Medium"


FONT = register_font()
PAGE_W, PAGE_H = landscape(A4)

TITLE = ParagraphStyle(
    "title",
    fontName=FONT,
    fontSize=30,
    leading=38,
    textColor=colors.HexColor("#1f2a1f"),
    alignment=TA_LEFT,
    wordWrap="CJK",
)
H1 = ParagraphStyle(
    "h1",
    fontName=FONT,
    fontSize=20,
    leading=26,
    textColor=colors.HexColor("#1f2a1f"),
    alignment=TA_LEFT,
    wordWrap="CJK",
)
BODY = ParagraphStyle(
    "body",
    fontName=FONT,
    fontSize=10.5,
    leading=15,
    textColor=colors.HexColor("#2f382f"),
    alignment=TA_LEFT,
    wordWrap="CJK",
)
SMALL = ParagraphStyle(
    "small",
    fontName=FONT,
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#65705f"),
    alignment=TA_LEFT,
    wordWrap="CJK",
)


def p(c, text, style, x, y, w, h):
    para = Paragraph(text, style)
    _, used_h = para.wrap(w, h)
    para.drawOn(c, x, y + h - used_h)


def rounded_box(c, x, y, w, h, fill, stroke=None, radius=8):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, y, w, h, radius, stroke=1 if stroke else 0, fill=1)


def draw_img(c, image_name, x, y, w, h):
    img_path = SCREEN_DIR / image_name
    img = ImageReader(str(img_path))
    iw, ih = img.getSize()
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx = x + (w - dw) / 2
    dy = y + (h - dh) / 2
    rounded_box(c, x - 4, y - 4, w + 8, h + 8, colors.white, colors.HexColor("#dbe5d6"), 10)
    c.drawImage(img, dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")


def footer(c, page_no):
    c.setFont(FONT, 8)
    c.setFillColor(colors.HexColor("#7b8477"))
    c.drawString(24 * mm, 13 * mm, "구슬요 춤영상 검토페이지 사용법 - 내부 운영 가이드")
    c.drawRightString(PAGE_W - 24 * mm, 13 * mm, str(page_no))


def header(c, title, subtitle, page_no):
    c.setFillColor(colors.HexColor("#f4f8ef"))
    c.rect(0, PAGE_H - 78, PAGE_W, 78, stroke=0, fill=1)
    p(c, title, H1, 24 * mm, PAGE_H - 53, PAGE_W - 48 * mm, 30)
    p(c, subtitle, SMALL, 24 * mm, PAGE_H - 72, PAGE_W - 48 * mm, 18)
    footer(c, page_no)


def bullet_box(c, title, bullets, x, y, w, h):
    rounded_box(c, x, y, w, h, colors.HexColor("#f7faf4"), colors.HexColor("#d7e4cf"), 8)
    p(c, f"<b>{title}</b>", BODY, x + 12, y + h - 28, w - 24, 18)
    text = "<br/>".join(f"- {item}" for item in bullets)
    p(c, text, BODY, x + 12, y + 10, w - 24, h - 42)


def cover(c):
    rounded_box(c, 0, 0, PAGE_W, PAGE_H, colors.HexColor("#f8fbf5"))
    p(c, "구슬요 춤영상<br/>검토페이지 사용법", TITLE, 24 * mm, PAGE_H - 150, 360, 100)
    p(
        c,
        "SOOP 클립, 캐치, YouTube Shorts 후보를 확인하고 채택/검토/숨김 상태로 정리하는 운영 가이드입니다.",
        BODY,
        24 * mm,
        PAGE_H - 188,
        360,
        48,
    )
    bullet_box(
        c,
        "빠른 흐름",
        [
            "데이터 가져오기 또는 상태 파일 가져오기로 검토 목록을 준비합니다.",
            "검색, 출처 탭, 상태 필터로 확인할 후보를 좁힙니다.",
            "카드 또는 상세 패널에서 채택, 검토, 숨김 상태를 정리합니다.",
            "상태 내보내기로 백업하거나 공개 반영 작업에 전달합니다.",
        ],
        24 * mm,
        54 * mm,
        360,
        118,
    )
    draw_img(c, "01-overview.png", 420, 72, 380, 360)
    footer(c, 1)
    c.showPage()


PAGES = [
    {
        "title": "1. 첫 화면에서 현황 확인",
        "subtitle": "상단 요약 카드에서 전체 후보, 검토 필요, 채택 수, 출처 수를 먼저 확인합니다.",
        "image": "01-overview.png",
        "box_title": "주요 영역",
        "bullets": [
            "데이터 가져오기: 새 후보 목록을 불러옵니다.",
            "상태 내보내기/가져오기: 검토 상태를 JSON으로 백업하거나 이어서 작업합니다.",
            "채택 영상 페이지: 공개 페이지 쪽 결과를 확인할 때 사용합니다.",
        ],
    },
    {
        "title": "2. 검색과 필터로 후보 좁히기",
        "subtitle": "제목, 곡명, 태그 검색과 출처/상태 필터를 함께 사용하면 검토할 영상만 빠르게 모을 수 있습니다.",
        "image": "03-filter-search.png",
        "box_title": "필터 사용법",
        "bullets": [
            "검색창에는 곡명, 키워드, 제목 일부를 입력합니다.",
            "출처 탭은 전체, SOOP 클립, VOD 클립, 캐치, Shorts로 나눕니다.",
            "상태 드롭다운은 모든 상태, 검토 필요, 채택, 숨김을 전환합니다.",
        ],
    },
    {
        "title": "3. 상세 패널에서 상태 정리",
        "subtitle": "카드 본문을 선택하면 오른쪽 상세 패널에 원본 링크, 메타 정보, 상태 버튼이 표시됩니다.",
        "image": "02-detail-actions.png",
        "box_title": "상세 작업",
        "bullets": [
            "원본 열기: 원본 영상 페이지를 새 탭에서 확인합니다.",
            "링크 복사: 공유나 기록용 URL을 클립보드에 복사합니다.",
            "채택, 검토, 숨김: 공개 후보로 둘지, 재검토할지, 목록에서 숨길지 결정합니다.",
        ],
    },
    {
        "title": "4. 여러 후보를 한 번에 처리",
        "subtitle": "필터로 좁힌 현재 목록을 선택한 뒤 일괄 채택, 검토, 숨김을 적용할 수 있습니다.",
        "image": "04-bulk-selection.png",
        "box_title": "일괄 처리",
        "bullets": [
            "현재 목록 선택: 지금 화면에 표시된 후보를 모두 체크합니다.",
            "개별 체크박스: 특정 카드만 추가하거나 제외합니다.",
            "선택 채택/검토/숨김: 선택된 항목의 상태를 한 번에 변경합니다.",
        ],
    },
    {
        "title": "5. 영상 미리보기와 마무리",
        "subtitle": "카드 썸네일의 재생 영역을 누르면 미리보기 모달이 열립니다. 확인 후 원본 또는 상태 버튼으로 작업을 마무리합니다.",
        "image": "05-preview-modal.png",
        "box_title": "작업 마감 체크",
        "bullets": [
            "미리보기에서 영상 내용이 춤영상인지 빠르게 확인합니다.",
            "닫기 버튼으로 돌아온 뒤 상세 패널이나 일괄 처리로 상태를 정합니다.",
            "작업 후 상태 내보내기로 백업합니다. 정적 사이트 공개 반영은 내보낸 상태/데이터를 기준으로 별도 반영합니다.",
        ],
    },
]


def section(c, info, page_no):
    header(c, info["title"], info["subtitle"], page_no)
    draw_img(c, info["image"], 28, 154, PAGE_W - 56, 318)
    bullet_box(c, info["box_title"], info["bullets"], 28, 43, PAGE_W - 56, 92)
    c.showPage()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=landscape(A4))
    c.setTitle("구슬요 춤영상 검토페이지 사용법")
    c.setAuthor("BEADYO")
    cover(c)
    for idx, page in enumerate(PAGES, start=2):
        section(c, page, idx)
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
