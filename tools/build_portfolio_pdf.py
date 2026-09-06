from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "MapleParty_Game_Programmer_Portfolio.pdf"
SHOT_DIR = ROOT / "output" / "pdf" / "screenshots"

PAGE_W, PAGE_H = A4
M = 38
CONTENT_W = PAGE_W - M * 2

INK = HexColor("#1B1E25")
TEXT = HexColor("#343A44")
MUTED = HexColor("#687080")
LINE = HexColor("#D9DDE4")
SURFACE = HexColor("#F4F6F8")
SOFT_ORANGE = HexColor("#FFF2ED")
ORANGE = HexColor("#E85A35")
BLUE = HexColor("#2563C7")
SOFT_BLUE = HexColor("#EDF4FF")
GREEN = HexColor("#14805A")
SOFT_GREEN = HexColor("#EAF8F2")
GOLD = HexColor("#A86F12")
SOFT_GOLD = HexColor("#FFF8E8")

LIVE_URL = "https://boss-cut-lab.godnox3.chatgpt.site"
SOURCE_URL = "https://github.com/darkeye3/maple-party"


def register_fonts() -> None:
    fonts = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont("Malgun", str(fonts / "malgun.ttf")))
    pdfmetrics.registerFont(TTFont("MalgunBold", str(fonts / "malgunbd.ttf")))
    pdfmetrics.registerFont(TTFont("Consolas", str(fonts / "consola.ttf")))


register_fonts()

STYLES = {
    "kicker": ParagraphStyle(
        "kicker", fontName="MalgunBold", fontSize=7.8, leading=11,
        textColor=ORANGE, wordWrap="CJK", spaceAfter=0,
    ),
    "h1": ParagraphStyle(
        "h1", fontName="MalgunBold", fontSize=30, leading=38,
        textColor=INK, wordWrap="CJK", spaceAfter=0,
    ),
    "h2": ParagraphStyle(
        "h2", fontName="MalgunBold", fontSize=19, leading=27,
        textColor=INK, wordWrap="CJK", spaceAfter=0,
    ),
    "h3": ParagraphStyle(
        "h3", fontName="MalgunBold", fontSize=11, leading=16,
        textColor=INK, wordWrap="CJK", spaceAfter=0,
    ),
    "body": ParagraphStyle(
        "body", fontName="Malgun", fontSize=9, leading=15,
        textColor=TEXT, wordWrap="CJK", spaceAfter=0,
    ),
    "body_bold": ParagraphStyle(
        "body_bold", fontName="MalgunBold", fontSize=9, leading=15,
        textColor=TEXT, wordWrap="CJK", spaceAfter=0,
    ),
    "small": ParagraphStyle(
        "small", fontName="Malgun", fontSize=7.3, leading=11.5,
        textColor=MUTED, wordWrap="CJK", spaceAfter=0,
    ),
    "small_bold": ParagraphStyle(
        "small_bold", fontName="MalgunBold", fontSize=7.5, leading=11.5,
        textColor=TEXT, wordWrap="CJK", spaceAfter=0,
    ),
    "inverse_small_bold": ParagraphStyle(
        "inverse_small_bold", fontName="MalgunBold", fontSize=7.5, leading=11.5,
        textColor=white, wordWrap="CJK", spaceAfter=0,
    ),
    "inverse_small": ParagraphStyle(
        "inverse_small", fontName="Malgun", fontSize=7.3, leading=11.5,
        textColor=HexColor("#D2D7E0"), wordWrap="CJK", spaceAfter=0,
    ),
    "inverse_h3": ParagraphStyle(
        "inverse_h3", fontName="MalgunBold", fontSize=11, leading=16,
        textColor=white, wordWrap="CJK", spaceAfter=0,
    ),
    "metric": ParagraphStyle(
        "metric", fontName="MalgunBold", fontSize=18, leading=22,
        textColor=INK, wordWrap="CJK", alignment=TA_LEFT, spaceAfter=0,
    ),
    "center_small": ParagraphStyle(
        "center_small", fontName="Malgun", fontSize=7.1, leading=10.5,
        textColor=MUTED, wordWrap="CJK", alignment=TA_CENTER, spaceAfter=0,
    ),
}


def para(c: canvas.Canvas, text: str, x: float, top: float, width: float, style: str = "body") -> float:
    p = Paragraph(text, STYLES[style])
    _, height = p.wrap(width, PAGE_H)
    p.drawOn(c, x, top - height)
    return top - height


def section_title(c: canvas.Canvas, kicker: str, title: str, body: str, top: float) -> float:
    y = para(c, kicker.upper(), M, top, CONTENT_W, "kicker")
    y = para(c, title, M, y - 5, CONTENT_W, "h2")
    y = para(c, body, M, y - 6, CONTENT_W, "body")
    return y


def round_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, stroke=LINE, radius=6) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def footer(c: canvas.Canvas, page_no: int) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(M, 25, PAGE_W - M, 25)
    c.setFont("Malgun", 6.6)
    c.setFillColor(MUTED)
    c.drawString(M, 13, "MapleParty · Game System Programmer Portfolio")
    c.drawRightString(PAGE_W - M, 13, f"{page_no:02d}")


def page_header(c: canvas.Canvas, page_no: int, label: str) -> float:
    c.setFillColor(ORANGE)
    c.rect(0, PAGE_H - 5, PAGE_W, 5, fill=1, stroke=0)
    c.setFont("MalgunBold", 7.2)
    c.setFillColor(MUTED)
    c.drawString(M, PAGE_H - 27, f"MAPLEPARTY  /  {label}")
    footer(c, page_no)
    return PAGE_H - 49


def metric_card(c: canvas.Canvas, x: float, y: float, w: float, h: float, value: str, label: str, detail: str) -> None:
    round_rect(c, x, y, w, h, white)
    para(c, value, x + 11, y + h - 10, w - 22, "metric")
    para(c, label, x + 11, y + h - 36, w - 22, "small_bold")
    para(c, detail, x + 11, y + 19, w - 22, "small")


def bullet(c: canvas.Canvas, text: str, x: float, top: float, width: float, color=ORANGE, style="body") -> float:
    c.setFillColor(color)
    c.circle(x + 3.5, top - 7, 2.2, fill=1, stroke=0)
    return para(c, text, x + 13, top, width - 13, style)


def crop_white(path: Path, pad: int = 10) -> Image.Image:
    image = Image.open(path).convert("RGB")
    bg = Image.new("RGB", image.size, "white")
    bbox = ImageChops.difference(image, bg).getbbox()
    if not bbox:
        return image
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(image.width, bbox[2] + pad)
    bottom = min(image.height, bbox[3] + pad)
    return image.crop((left, top, right, bottom))


def image_reader(image: Image.Image) -> ImageReader:
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    stream.seek(0)
    return ImageReader(stream)


def draw_image(c: canvas.Canvas, image: Image.Image, x: float, y: float, w: float, h: float, fill=white) -> None:
    round_rect(c, x, y, w, h, fill, LINE, 5)
    scale = min((w - 8) / image.width, (h - 8) / image.height)
    iw = image.width * scale
    ih = image.height * scale
    ix = x + (w - iw) / 2
    iy = y + (h - ih) / 2
    c.drawImage(image_reader(image), ix, iy, iw, ih, mask="auto", preserveAspectRatio=True)


def caption(c: canvas.Canvas, text: str, x: float, y: float, width: float) -> None:
    para(c, text, x, y, width, "small")


def pill(c: canvas.Canvas, text: str, x: float, y: float, bg=SOFT_ORANGE, fg=ORANGE) -> float:
    width = pdfmetrics.stringWidth(text, "MalgunBold", 7.2) + 18
    c.setFillColor(bg)
    c.setStrokeColor(bg)
    c.roundRect(x, y, width, 20, 5, fill=1, stroke=0)
    c.setFont("MalgunBold", 7.2)
    c.setFillColor(fg)
    c.drawCentredString(x + width / 2, y + 6, text)
    return width


def link_button(c: canvas.Canvas, label: str, url: str, x: float, y: float, w: float, primary=True) -> None:
    bg = INK if primary else white
    fg = white if primary else TEXT
    stroke = INK if primary else LINE
    round_rect(c, x, y, w, 30, bg, stroke, 5)
    c.setFont("MalgunBold", 8)
    c.setFillColor(fg)
    c.drawCentredString(x + w / 2, y + 9.5, label)
    c.linkURL(url, (x, y, x + w, y + 30), relative=0)


def page_cover(c: canvas.Canvas) -> None:
    c.setFillColor(ORANGE)
    c.rect(0, PAGE_H - 8, PAGE_W, 8, fill=1, stroke=0)
    pill(c, "GAME SYSTEM · COMBAT MODEL · PARTY RECRUITMENT", M, PAGE_H - 55)
    y = para(c, "MapleParty", M, PAGE_H - 90, CONTENT_W, "h1")
    y = para(c, "전투 데이터를 파티 모집 행동으로 연결한<br/>게임 시스템 프로그래머 포트폴리오", M, y - 7, CONTENT_W, "h2")
    y = para(
        c,
        "캐릭터 전투 데이터를 보스별 배율로 계산하고, 그 결과를 역할별 가입 조건·모집 상태·보상 약정에 연결했습니다. "
        "계산 결과를 보여주는 데서 멈추지 않고 <b>자신에게 맞는 파티를 바로 찾고 참가하도록 만드는 것</b>이 프로젝트의 목표입니다.",
        M, y - 11, CONTENT_W, "body",
    )

    card_y = y - 92
    gap = 8
    card_w = (CONTENT_W - gap * 3) / 4
    data = [
        ("13×2", "곡선 제어점", "300%·380% 방어율"),
        ("40회", "역산 반복", "피해량 → HEXA"),
        ("31", "보스 정의", "난이도·포스·정원"),
        ("v2", "배율 저장 모델", "구버전 자동 재검증"),
    ]
    for i, item in enumerate(data):
        metric_card(c, M + i * (card_w + gap), card_y, card_w, 76, *item)

    thesis_y = 228
    thesis_h = card_y - thesis_y - 19
    round_rect(c, M, thesis_y, CONTENT_W, thesis_h, INK, INK)
    para(c, "PROJECT THESIS", M + 18, thesis_y + thesis_h - 18, CONTENT_W - 36, "inverse_small_bold")
    thesis = Paragraph(
        "복잡한 전투 수치를 보여주는 데서 끝내지 않고,<br/>"
        "<font color='#FFB39E'>내가 참가할 수 있는 파티</font>를 바로 찾게 만든다.",
        ParagraphStyle(
            "cover_thesis", fontName="MalgunBold", fontSize=15, leading=24,
            textColor=white, wordWrap="CJK", spaceAfter=0,
        ),
    )
    _, th = thesis.wrap(CONTENT_W - 36, thesis_h - 62)
    thesis.drawOn(c, M + 18, thesis_y + thesis_h - 43 - th)
    stages = ["전투 데이터", "보스 배율", "파티 탐색", "가입 검증"]
    sx = M + 18
    for i, stage in enumerate(stages):
        sw = 90
        c.setFillColor(HexColor("#2A303A"))
        c.roundRect(sx, thesis_y + 18, sw, 26, 5, fill=1, stroke=0)
        c.setFont("MalgunBold", 7)
        c.setFillColor(white)
        c.drawCentredString(sx + sw / 2, thesis_y + 27, stage)
        if i < len(stages) - 1:
            c.setStrokeColor(HexColor("#7E8796"))
            c.line(sx + sw + 4, thesis_y + 31, sx + sw + 14, thesis_y + 31)
        sx += sw + 18

    info_y = 145
    info = [
        ("지원 직무", "게임 시스템 / 콘텐츠 프로그래머"),
        ("이 문서의 증명 범위", "계산 모델링 · 서버 무결성 · 라이브 운영"),
        ("함께 제출할 작품", "Abyss · Unity/C# 게임 구현 사례"),
    ]
    info_w = (CONTENT_W - 16) / 3
    for i, (label, value) in enumerate(info):
        x = M + i * (info_w + 8)
        round_rect(c, x, info_y, info_w, 58, white)
        para(c, label, x + 11, info_y + 45, info_w - 22, "small_bold")
        para(c, value, x + 11, info_y + 25, info_w - 22, "small")

    link_button(c, "LIVE APP", LIVE_URL, M, 72, 104, True)
    link_button(c, "SOURCE CODE", SOURCE_URL, M + 112, 72, 120, False)
    c.setFont("Malgun", 7)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - M, 81, "개인 프로젝트 · 2026.08-09")
    footer(c, 1)
    c.showPage()


def page_goal(c: canvas.Canvas) -> None:
    top = page_header(c, 2, "PRODUCT GOAL")
    y = section_title(
        c, "01 · Goal",
        "정확한 계산보다 한 단계 더: 파티 모집을 쉽게 만드는 것",
        "보스 도전 여부를 숫자로만 보여주면 사용자는 다시 인원별 기준과 역할 조건을 찾아야 합니다. "
        "MapleParty는 전투 데이터를 모집과 참가의 공통 규칙으로 사용해 이 판단 비용을 줄였습니다.",
        top,
    )

    box_y = y - 142
    col_w = (CONTENT_W - 10) / 2
    round_rect(c, M, box_y, col_w, 124, white)
    round_rect(c, M + col_w + 10, box_y, col_w, 124, SOFT_GREEN, HexColor("#BFE7D7"))
    para(c, "기존 사용자 경험", M + 14, box_y + 106, col_w - 28, "h3")
    yy = box_y + 83
    for t in [
        "환산 결과와 보스별 기준을 따로 비교",
        "몇 인 파티에 지원 가능한지 다시 계산",
        "역할·보상 조건을 채팅으로 반복 확인",
    ]:
        yy = bullet(c, t, M + 14, yy, col_w - 28, HexColor("#A64B33"), "small") - 8
    para(c, "MapleParty가 만든 흐름", M + col_w + 24, box_y + 106, col_w - 28, "h3")
    yy = box_y + 83
    for t in [
        "전투 데이터를 보스 배율과 상태로 변환",
        "가입 가능한 파티를 필터로 즉시 탐색",
        "서버가 역할 최소컷과 약정을 재검증",
    ]:
        yy = bullet(c, t, M + col_w + 24, yy, col_w - 28, GREEN, "small") - 8

    flow_top = box_y - 34
    para(c, "사용자 여정", M, flow_top, CONTENT_W, "h3")
    step_y = flow_top - 92
    step_gap = 7
    step_w = (CONTENT_W - step_gap * 4) / 5
    steps = [
        ("01", "캐릭터 조회", "닉네임·HEXA 입력"),
        ("02", "전투 데이터 계산", "API·프리셋·보정"),
        ("03", "도전 상태 확인", "불가능↔솔플권"),
        ("04", "파티 탐색", "보스·자리·시간 필터"),
        ("05", "가입 검증", "역할 컷·약정 확인"),
    ]
    for i, (num, title, body) in enumerate(steps):
        x = M + i * (step_w + step_gap)
        round_rect(c, x, step_y, step_w, 72, white)
        c.setFillColor(ORANGE if i < 3 else BLUE)
        c.circle(x + 14, step_y + 55, 8, fill=1, stroke=0)
        c.setFont("MalgunBold", 6.2)
        c.setFillColor(white)
        c.drawCentredString(x + 14, step_y + 52.8, num)
        para(c, title, x + 8, step_y + 41, step_w - 16, "small_bold")
        para(c, body, x + 8, step_y + 22, step_w - 16, "center_small")
        if i < 4:
            c.setStrokeColor(LINE)
            c.setLineWidth(1)
            ax = x + step_w + 1
            c.line(ax, step_y + 36, ax + step_gap - 2, step_y + 36)

    principle_y = step_y - 146
    para(c, "설계 원칙", M, principle_y + 128, CONTENT_W, "h3")
    principles = [
        ("하나의 기준", "보스 카드와 파티 가입 검증이 같은 배율 함수를 사용합니다.", SOFT_BLUE, BLUE),
        ("서버 재검증", "클라이언트가 보낸 수치를 신뢰하지 않고 참가 시 다시 계산합니다.", SOFT_ORANGE, ORANGE),
        ("명시적 약정", "보상 분배 규칙에 버전을 두어 변경 전 동의를 재사용하지 않습니다.", SOFT_GOLD, GOLD),
    ]
    p_gap = 8
    p_w = (CONTENT_W - p_gap * 2) / 3
    for i, (title, body, bg, fg) in enumerate(principles):
        x = M + i * (p_w + p_gap)
        round_rect(c, x, principle_y, p_w, 102, bg, bg)
        c.setFillColor(fg)
        c.circle(x + 16, principle_y + 82, 5, fill=1, stroke=0)
        para(c, title, x + 29, principle_y + 90, p_w - 39, "h3")
        para(c, body, x + 12, principle_y + 62, p_w - 24, "small")

    question_y = 73
    round_rect(c, M, question_y, CONTENT_W, 95, INK, INK)
    para(c, "사용자가 바로 답을 얻어야 하는 질문", M + 15, question_y + 76, CONTENT_W - 30, "inverse_small_bold")
    questions = [
        "지금 도전 가능한 보스는?",
        "어떤 역할로 지원 가능한가?",
        "어떤 보상 조건에 동의하는가?",
    ]
    qw = (CONTENT_W - 30) / 3
    for i, question in enumerate(questions):
        x = M + 15 + i * qw
        c.setFillColor(ORANGE if i == 0 else HexColor("#7EAAFF") if i == 1 else HexColor("#67D7AF"))
        c.circle(x + 5, question_y + 42, 4, fill=1, stroke=0)
        p = Paragraph(
            question,
            ParagraphStyle("question", parent=STYLES["small_bold"], textColor=white, fontSize=8.2, leading=13, wordWrap="CJK"),
        )
        _, ph = p.wrap(qw - 22, 35)
        p.drawOn(c, x + 16, question_y + 48 - ph)
    c.showPage()


def page_combat_ui(c: canvas.Canvas, boss: Image.Image) -> None:
    top = page_header(c, 3, "COMBAT DATA")
    y = section_title(
        c, "02 · Actual Screen",
        "캐릭터 데이터를 보스별 도전 상태로 번역",
        "닉네임과 HEXA 환산값을 입력하면 공식 캐릭터 정보, 방어율별 피해량, 보스 배율과 도전 상태를 한 화면에서 비교합니다.",
        top,
    )
    image_h = 286
    image_y = y - image_h - 18
    draw_image(c, boss, M, image_y, CONTENT_W, image_h, white)
    caption(c, "배포 환경 캡처 · 상단 입력/캐릭터 지표와 보스 카드가 동일한 계산 결과를 공유", M, image_y - 7, CONTENT_W)

    cards_y = 226
    cards_h = 142
    gap = 8
    w = (CONTENT_W - gap * 2) / 3
    items = [
        ("1", "입력 부담 최소화", "닉네임과 HEXA 환산 두 값으로 시작하고, 공식 API에서 레벨·포스·방무·프리셋을 보완합니다.", SOFT_BLUE, BLUE),
        ("2", "행동 가능한 상태", "배율을 불가능, 파티 최소컷, 파티격 가능, 솔플권으로 변환해 다음 행동을 바로 판단하게 합니다.", SOFT_ORANGE, ORANGE),
        ("3", "근거가 보이는 결과", "300/380 방어율 피해량과 역산 환산값을 함께 표시해 계산 결과를 검토할 수 있게 했습니다.", SOFT_GREEN, GREEN),
    ]
    for i, (num, title, body, bg, fg) in enumerate(items):
        x = M + i * (w + gap)
        round_rect(c, x, cards_y, w, cards_h, bg, bg)
        c.setFillColor(fg)
        c.circle(x + 17, cards_y + cards_h - 19, 9, fill=1, stroke=0)
        c.setFont("MalgunBold", 7.5)
        c.setFillColor(white)
        c.drawCentredString(x + 17, cards_y + cards_h - 22, num)
        para(c, title, x + 32, cards_y + cards_h - 12, w - 44, "h3")
        para(c, body, x + 12, cards_y + cards_h - 45, w - 24, "small")

    band_y = 76
    round_rect(c, M, band_y, CONTENT_W, 72, INK, INK)
    para(c, "계산 결과의 재사용 지점", M + 15, band_y + 56, 120, "inverse_small_bold")
    reuse = ["보스 카드", "탐색 필터", "역할 최소컷", "서버 가입 검증"]
    x = M + 145
    for i, label in enumerate(reuse):
        bw = 78 if i < 3 else 92
        c.setFillColor(HexColor("#2A303A"))
        c.roundRect(x, band_y + 20, bw, 28, 5, fill=1, stroke=0)
        c.setFont("MalgunBold", 7)
        c.setFillColor(white)
        c.drawCentredString(x + bw / 2, band_y + 29.5, label)
        if i < len(reuse) - 1:
            c.setStrokeColor(HexColor("#7E8796"))
            c.line(x + bw + 3, band_y + 34, x + bw + 11, band_y + 34)
        x += bw + 14
    c.showPage()


def page_party_ui(c: canvas.Canvas, party: Image.Image) -> None:
    top = page_header(c, 5, "PARTY RECRUITMENT")
    y = section_title(
        c, "04 · Product Flow",
        "전투 결과를 파티 탐색과 모집 조건으로 재사용",
        "보스·난이도·자리·출발 시간 필터와 역할별 최소 배율을 같은 화면에 배치했습니다. 사용자는 자신의 계산값을 기억해 옮겨 적지 않아도 됩니다.",
        top,
    )
    image_h = 274
    image_y = y - image_h - 18
    draw_image(c, party, M, image_y, CONTENT_W, image_h, white)
    caption(c, "배포 환경 캡처 · 실제 등록된 파티 카드와 탐색 필터", M, image_y - 7, CONTENT_W)

    y2 = image_y - 32
    para(c, "파티를 찾는 사람이 한 화면에서 확인하는 정보", M, y2, CONTENT_W, "h3")
    y2 -= 25
    left = M
    right = M + CONTENT_W / 2 + 6
    col = CONTENT_W / 2 - 6
    left_items = [
        "<b>가입 가능</b>: 내 배율이 역할별 최소 조건을 충족하는 모집만 확인",
        "<b>자리 있음</b>: 역할 좌석과 전체 정원이 남아 있는 파티만 확인",
        "<b>3시간 이내</b>: 출발이 임박한 모집을 빠르게 찾는 시간 필터",
    ]
    right_items = [
        "<b>준비도</b>: 현재 파티 배율을 목표 배율과 비교한 진행 상태",
        "<b>역할별 좌석</b>: 메인·보조 정원과 최소 배율을 카드에서 확인",
        "<b>보상 요약</b>: 물욕템과 결정석 정산 방식을 가입 전에 확인",
    ]
    yy = y2
    for item in left_items:
        yy = bullet(c, item, left, yy, col, BLUE, "small") - 7
    yy = y2
    for item in right_items:
        yy = bullet(c, item, right, yy, col, ORANGE, "small") - 7

    band_y = 181
    round_rect(c, M, band_y, CONTENT_W, 54, INK, INK)
    para(c, "핵심 UX 결정", M + 14, band_y + 41, 92, "inverse_small_bold")
    p = Paragraph(
        "‘전투 데이터 확인’과 ‘파티 모집’을 별도 도구로 나누지 않고, <font color='#FFB39E'><b>같은 기준값과 상태를 공유하는 연속된 흐름</b></font>으로 설계했습니다.",
        ParagraphStyle("inverse", parent=STYLES["small"], textColor=white, fontSize=8, leading=13, wordWrap="CJK"),
    )
    _, ph = p.wrap(CONTENT_W - 128, 44)
    p.drawOn(c, M + 112, band_y + 27 - ph / 2)

    create_top = 148
    para(c, "모집 생성자가 정의하는 파티 규칙", M, create_top, CONTENT_W, "h3")
    labels = [
        ("목표 배율", "클리어 목표치"),
        ("역할별 정원", "메인·보조 좌석"),
        ("최소 배율", "역할 가입 기준"),
        ("보상 약정", "물욕·결정석 정산"),
    ]
    lw = (CONTENT_W - 8 * 3) / 4
    for i, (title, body) in enumerate(labels):
        x = M + i * (lw + 8)
        round_rect(c, x, 72, lw, 58, white)
        para(c, title, x + 10, 116, lw - 20, "small_bold")
        para(c, body, x + 10, 94, lw - 20, "center_small")
    c.showPage()


def page_validation_ui(c: canvas.Canvas, detail: Image.Image) -> None:
    top = page_header(c, 5, "JOIN VALIDATION")
    y = section_title(
        c, "04 · Actual Screen",
        "참가 버튼을 누르기 전에 역할·배율·보상 조건을 명확히",
        "파티 상세에서 목표 배율, 현재 인원, 역할 최소컷, 참가자 스펙과 보상 약정을 한 번에 확인합니다. 조건 미달이면 이유를 수치로 보여주고 가입을 차단합니다.",
        top,
    )
    top_img_h = 314
    top_img_y = y - top_img_h - 16
    draw_image(c, detail, M, top_img_y, CONTENT_W, top_img_h, white)
    caption(c, "파티 상세 상단 · 공유 링크, 파티 진행 상태, 역할별 최소 조건, 서버 재계산 완료 참가자", M, top_img_y - 7, CONTENT_W)

    para(c, "가입 전 검증 기준", M, top_img_y - 35, CONTENT_W, "h3")
    cards_y = 190
    gap = 8
    w = (CONTENT_W - gap * 2) / 3
    items = [
        ("수치 기반 피드백", "최소 조건보다 39.20% 부족하다는 차이를 즉시 표시", BLUE),
        ("동의의 버전 관리", "약정 변경 시 과거 동의를 무효화해 분쟁 가능성을 줄임", GOLD),
        ("서버 기준 재확인", "화면 상태와 별개로 가입 요청 시 캐릭터·배율을 다시 검증", GREEN),
    ]
    for i, (title, body, color) in enumerate(items):
        x = M + i * (w + gap)
        round_rect(c, x, cards_y, w, 94, white)
        c.setFillColor(color)
        c.rect(x, cards_y, 4, 94, fill=1, stroke=0)
        para(c, title, x + 13, cards_y + 78, w - 25, "small_bold")
        para(c, body, x + 13, cards_y + 52, w - 25, "small")

    feedback_y = 72
    round_rect(c, M, feedback_y, CONTENT_W, 88, INK, INK)
    para(c, "실패 이유를 숨기지 않는 UX", M + 15, feedback_y + 69, 145, "inverse_small_bold")
    feedback = Paragraph(
        "“내 배율이 선택한 역할의 최소 조건보다 <font color='#FFB39E'><b>39.20% 부족합니다.</b></font>”",
        ParagraphStyle(
            "feedback", fontName="MalgunBold", fontSize=12, leading=19,
            textColor=white, wordWrap="CJK", spaceAfter=0,
        ),
    )
    _, fh = feedback.wrap(CONTENT_W - 180, 54)
    feedback.drawOn(c, M + 170, feedback_y + 52 - fh)
    para(c, "조건 미달 시 가입 버튼을 비활성화하고, 서버도 같은 기준으로 요청을 다시 거절합니다.", M + 170, feedback_y + 26, CONTENT_W - 187, "inverse_small")
    c.showPage()


def page_engine(c: canvas.Canvas) -> None:
    top = page_header(c, 2, "COMBAT MODEL")
    y = section_title(
        c, "01 · Core Implementation",
        "전투력 환산 엑셀에서 서비스에 필요한 규칙만 분리",
        "메이플스토리 유저들이 캐릭터 전투력을 계산하던 엑셀 파일에는 직업·장비·보스 규칙이 33개 시트에 섞여 있었습니다. "
        "전체 파일을 옮기지 않고 파티 모집에 필요한 ‘HEXA → 방어율별 피해량 → 보스 배율’ 경로를 추적해 TypeScript 순수 함수로 구현했습니다.",
        top,
    )

    flow_y = y - 103
    step_gap = 6
    step_w = (CONTENT_W - step_gap * 4) / 5
    flow = [
        ("HEXA", "사용자 입력"),
        ("300 / 380", "방어율 곡선"),
        ("LEVEL", "레벨 보정"),
        ("FORCE", "포스 보정"),
        ("RATE", "보스 배율"),
    ]
    for i, (main, sub) in enumerate(flow):
        x = M + i * (step_w + step_gap)
        round_rect(c, x, flow_y, step_w, 70, SOFT_BLUE if i in (1, 4) else white)
        para(c, main, x + 7, flow_y + 52, step_w - 14, "h3")
        para(c, sub, x + 7, flow_y + 26, step_w - 14, "center_small")
        if i < 4:
            c.setStrokeColor(BLUE)
            c.setLineWidth(1.2)
            ax = x + step_w + 1
            c.line(ax, flow_y + 35, ax + step_gap - 2, flow_y + 35)

    mid_top = flow_y - 27
    left_w = 304
    right_x = M + left_w + 10
    right_w = CONTENT_W - left_w - 10
    round_rect(c, M, mid_top - 224, left_w, 224, INK, INK)
    para(c, "핵심 계산 흐름", M + 14, mid_top - 13, left_w - 28, "inverse_h3")
    code_lines = [
        "damage = curveValue(guard, hexaStat)",
        "adjusted = damage * level * force",
        "rate = adjusted / cutoff * reference",
        "cardStat = inverseCurve(adjusted)",
    ]
    c.setFont("Consolas", 8.2)
    c.setFillColor(HexColor("#DCE7FF"))
    for i, line in enumerate(code_lines):
        c.drawString(M + 15, mid_top - 49 - i * 21, line)
    para(
        c,
        "정방향과 역방향에서 같은 곡선을 사용해 보스 카드의 표시 환산값과 내부 판정 기준이 어긋나지 않게 했습니다.",
        M + 14, mid_top - 151, left_w - 28,
        "inverse_small",
    )

    para(c, "알고리즘 선택", right_x, mid_top, right_w, "h3")
    yy = mid_top - 29
    algo = [
        ("Cubic Hermite spline", "300%·380% 방어율 표본을 각각 13개 제어점으로 보간"),
        ("Binary search × 40", "피해량에서 표시 HEXA 환산값을 안정적으로 역산"),
        ("Bounded extrapolation", "입력을 0~250,000으로 제한하고 끝점 기울기로 외삽"),
        ("Preset search", "장비·어빌리티·하이퍼·링크·유니온 최대 810조합 비교"),
    ]
    for title, body in algo:
        yy = bullet(c, f"<b>{title}</b><br/>{body}", right_x, yy, right_w, ORANGE, "small") - 9

    lower_top = mid_top - 252
    para(c, "추출한 규칙과 의도적인 제외", M, lower_top, CONTENT_W, "h3")
    round_rect(c, M, lower_top - 116, CONTENT_W, 96, SOFT_ORANGE, HexColor("#FFD7C9"))
    para(
        c,
        "추출: 방어율별 곡선, 레벨·포스 보정, 보스 기준점, 상태 판정. 제외: 엑셀 UI와 파티 모집에 쓰이지 않는 중간 계산. "
        "프리셋 탐색은 <b>최고 조건 선택과 설명</b>을 담당하고, 이미 프리셋 효과가 포함된 HEXA 피해량에는 상승분을 다시 곱하지 않도록 계산 경계를 나눴습니다.",
        M + 14, lower_top - 34, CONTENT_W - 28, "body",
    )
    c.showPage()


def page_bug_cases(c: canvas.Canvas) -> None:
    top = page_header(c, 3, "BUGS & SAFEGUARDS")
    y = section_title(
        c, "02 · Production Debugging",
        "틀린 숫자를 계산식과 저장 데이터의 수명주기로 나눠 추적",
        "전투 데이터 서비스에서 수치 오류는 계산 함수뿐 아니라 이미 저장된 파생값이 새 모델과 섞일 때도 발생합니다. "
        "실제 운영 중 발견한 두 사례를 원인·수정·재발 방지 단위로 정리했습니다.",
        top,
    )

    case1_top = y - 18
    round_rect(c, M, case1_top - 213, CONTENT_W, 200, white)
    pill(c, "CASE 01 · STALE DERIVED DATA", M + 14, case1_top - 39, SOFT_ORANGE, ORANGE)
    para(c, "하드 유피테르 파티 배율 2,290.0% 표시 오류", M + 14, case1_top - 51, CONTENT_W - 28, "h3")
    cols = [
        ("현상", "현재 입력으로는 154.8%여야 하지만, 과거 계산 모델이 저장한 2,290.0%가 파티 합산에 재사용됐습니다."),
        ("원인", "파생값 <font name='Consolas'>verified_rate</font>에는 어떤 계산 모델로 만든 값인지 식별하는 버전이 없었습니다."),
        ("수정", "<font name='Consolas'>verified_rate_version</font>을 추가하고, 구버전 값은 합산에서 제외한 뒤 활성 참가자를 다시 계산합니다."),
    ]
    col_w = (CONTENT_W - 42) / 3
    for i, (title, body) in enumerate(cols):
        x = M + 14 + i * (col_w + 7)
        c.setFillColor([ORANGE, GOLD, GREEN][i])
        c.rect(x, case1_top - 83, col_w, 3, fill=1, stroke=0)
        para(c, title, x, case1_top - 91, col_w, "small_bold")
        para(c, body, x, case1_top - 113, col_w, "small")
    c.setFillColor(GREEN)
    c.circle(M + 20, case1_top - 190, 4, fill=1, stroke=0)
    para(c, "운영 데이터 재검증 후 하드 유피테르 154.8%, 준비도 103%로 정상화", M + 32, case1_top - 181, CONTENT_W - 48, "small_bold")

    case2_top = case1_top - 236
    round_rect(c, M, case2_top - 151, CONTENT_W, 138, SOFT_BLUE, HexColor("#C9DAFA"))
    pill(c, "CASE 02 · DOUBLE COUNT", M + 14, case2_top - 39, white, BLUE)
    para(c, "프리셋 효과를 HEXA 피해량에 두 번 적용", M + 14, case2_top - 51, CONTENT_W - 28, "h3")
    para(
        c,
        "입력 HEXA 환산값에는 선택한 장비·어빌리티·유니온 프리셋의 효과가 이미 포함되어 있었습니다. 초기 모델은 탐색한 프리셋 상승량을 최종 피해량에 다시 곱해 결과를 부풀렸습니다. "
        "프리셋 모듈의 책임을 <b>조건 탐색과 설명</b>으로 한정하고, 최종 피해량은 전투 곡선의 값만 사용하도록 수정했습니다.",
        M + 14, case2_top - 83, CONTENT_W - 28, "body",
    )

    guard_top = case2_top - 179
    para(c, "재발 방지로 남긴 설계", M, guard_top, CONTENT_W, "h3")
    cards = [
        ("파생값 버전", "계산 결과와 모델 버전을 함께 저장", SOFT_ORANGE, ORANGE),
        ("구버전 격리", "현재 버전이 아니면 파티 합산에서 제외", SOFT_GOLD, GOLD),
        ("서버 재계산", "가입·동기화 시 동일 함수로 다시 산출", SOFT_GREEN, GREEN),
    ]
    gap = 8
    w = (CONTENT_W - gap * 2) / 3
    for i, (title, body, bg, fg) in enumerate(cards):
        x = M + i * (w + gap)
        round_rect(c, x, 70, w, 91, bg, bg)
        c.setFillColor(fg)
        c.circle(x + 16, 140, 4, fill=1, stroke=0)
        para(c, title, x + 28, 149, w - 39, "small_bold")
        para(c, body, x + 12, 118, w - 24, "small")
    c.showPage()


def page_validation_scope(c: canvas.Canvas) -> None:
    top = page_header(c, 4, "VALIDATION & TRUST")
    y = section_title(
        c, "03 · Evidence Boundary",
        "재현한 값과 아직 증명하지 않은 범위를 분리",
        "저장된 기준 결과와 구현 결과의 일치는 확인했지만, 그것만으로 모든 HEXA 구간과 직업의 정확도를 주장하지 않습니다. "
        "내부 일관성, 기준값 재현, 외부 정확도를 서로 다른 검증으로 취급했습니다.",
        top,
    )

    table_top = y - 22
    para(c, "기준 결과 재현 · 비숍 ‘팸귄’, HEXA 83,583", M, table_top, CONTENT_W, "h3")
    table_y = table_top - 128
    row_h = 26
    col_x = [M, M + 105, M + 238, M + 371, PAGE_W - M]
    headers = ["항목", "저장된 기준값", "현재 엔진", "상대 차이"]
    c.setFillColor(INK)
    c.rect(M, table_y + row_h * 3, CONTENT_W, row_h, fill=1, stroke=0)
    for i, label in enumerate(headers):
        c.setFont("MalgunBold", 7.2)
        c.setFillColor(white)
        c.drawString(col_x[i] + 8, table_y + row_h * 3 + 8.5, label)
    rows = [
        ("방어율 300%", "34.909824억", "34.909824억", "< 0.000001%"),
        ("방어율 380%", "35.289770억", "35.289770억", "< 0.000001%"),
        ("카링 조건", "34.370663억", "34.370663억", "< 0.000001%"),
    ]
    for r, row in enumerate(rows):
        yy = table_y + row_h * (2 - r)
        c.setFillColor(white if r % 2 == 0 else SURFACE)
        c.rect(M, yy, CONTENT_W, row_h, fill=1, stroke=0)
        for i, value in enumerate(row):
            c.setFont("MalgunBold" if i == 0 else "Malgun", 7.2)
            c.setFillColor(TEXT if i < 3 else GREEN)
            c.drawString(col_x[i] + 8, yy + 8.5, value)
    c.setStrokeColor(LINE)
    c.rect(M, table_y, CONTENT_W, row_h * 4, fill=0, stroke=1)
    for xx in col_x[1:-1]:
        c.line(xx, table_y, xx, table_y + row_h * 4)
    para(c, "이 표는 저장된 한 기준 스냅샷의 재현성 근거이며, 독립된 외부 정답셋에 대한 정확도 표가 아닙니다.", M, table_y - 7, CONTENT_W, "small")

    check_top = table_y - 38
    gap = 10
    box_w = (CONTENT_W - gap) / 2
    round_rect(c, M, check_top - 112, box_w, 100, SOFT_GREEN, HexColor("#BFE7D7"))
    round_rect(c, M + box_w + gap, check_top - 112, box_w, 100, SOFT_ORANGE, HexColor("#FFD7C9"))
    para(c, "내부 일관성 확인", M + 13, check_top - 26, box_w - 26, "h3")
    para(c, "제어점 사이 6개 입력(30k~150k)에서 정방향 계산 후 역산한 HEXA의 최대 오차 <b>0</b>.", M + 13, check_top - 55, box_w - 26, "small")
    para(c, "아직 측정하지 않은 것", M + box_w + gap + 13, check_top - 26, box_w - 26, "h3")
    para(c, "독립 원본값을 사용한 다중 HEXA 구간 오차, 타 직업 정확도, 패치 이후 기준점 변화.", M + box_w + gap + 13, check_top - 55, box_w - 26, "small")

    trust_top = check_top - 142
    para(c, "HEXA 입력의 신뢰 경계", M, trust_top, CONTENT_W, "h3")
    steps = [
        ("공식 조회", "NEXON API", "직업·레벨·포스·공개 스탯", BLUE),
        ("사용자 입력", "HEXA", "숫자 형식·0~250,000 범위만 검사", ORANGE),
        ("서버 산출", "배율", "공식 조회값+입력 HEXA로 재계산", GREEN),
    ]
    step_y = trust_top - 101
    sw = (CONTENT_W - 16) / 3
    for i, (label, main, body, fg) in enumerate(steps):
        x = M + i * (sw + 8)
        round_rect(c, x, step_y, sw, 76, white)
        c.setFillColor(fg)
        c.rect(x, step_y, 4, 76, fill=1, stroke=0)
        para(c, label, x + 13, step_y + 61, sw - 25, "small_bold")
        para(c, main, x + 13, step_y + 43, sw - 25, "h3")
        para(c, body, x + 13, step_y + 24, sw - 25, "small")

    note_y = 69
    round_rect(c, M, note_y, CONTENT_W, 69, INK, INK)
    para(c, "문서 표현 원칙", M + 14, note_y + 52, 92, "inverse_small_bold")
    para(
        c,
        "참가자 표기는 <b><font color='#FFB39E'>서버 재계산 완료</font></b>라는 범위로 한정합니다. "
        "현재 구조는 입력 HEXA가 실제 캐릭터 값인지, 입력자가 캐릭터 소유자인지까지 증명하지 않습니다.",
        M + 113, note_y + 51, CONTENT_W - 127, "inverse_small",
    )
    c.showPage()


def page_server(c: canvas.Canvas) -> None:
    top = page_header(c, 6, "SERVER & DATA")
    y = section_title(
        c, "05 · Domain Integrity",
        "사용자 입력의 한계를 인정하고 서버 판정은 일관되게",
        "HEXA는 자기신고 값이지만, 클라이언트가 보낸 최종 배율은 신뢰하지 않습니다. "
        "가입 시 공식 프로필과 입력 HEXA로 배율을 다시 계산하고, 역할·정원·약정 조건을 서버와 D1 제약에서 확인합니다.",
        top,
    )

    seq_top = y - 22
    para(c, "가입 요청 처리 순서", M, seq_top, CONTENT_W, "h3")
    seq_y = seq_top - 97
    items = [
        ("01", "세션·모집 상태"),
        ("02", "공식 프로필 조회"),
        ("03", "HEXA 범위 검사"),
        ("04", "배율 서버 계산"),
        ("05", "역할·정원·약정"),
        ("06", "버전과 함께 저장"),
    ]
    gap = 6
    w = (CONTENT_W - gap * 5) / 6
    for i, (num, title) in enumerate(items):
        x = M + i * (w + gap)
        round_rect(c, x, seq_y, w, 68, white)
        c.setFont("MalgunBold", 7)
        c.setFillColor(ORANGE if i < 5 else GREEN)
        c.drawString(x + 9, seq_y + 50, num)
        para(c, title, x + 8, seq_y + 38, w - 16, "center_small")
        if i < 5:
            c.setStrokeColor(LINE)
            c.line(x + w + 1, seq_y + 34, x + w + gap - 2, seq_y + 34)

    grid_top = seq_y - 28
    col_w = (CONTENT_W - 10) / 2
    round_rect(c, M, grid_top - 226, col_w, 226, white)
    round_rect(c, M + col_w + 10, grid_top - 226, col_w, 226, SOFT_GREEN, HexColor("#BFE7D7"))
    para(c, "서버에서 거절하는 요청", M + 14, grid_top - 14, col_w - 28, "h3")
    yy = grid_top - 44
    rejects = [
        "보스 최대 정원 또는 역할별 좌석 초과",
        "선택한 역할의 최소 배율 미달",
        "동일 사용자·캐릭터의 중복 참가",
        "출발 시간이 지났거나 모집 상태가 닫힘",
        "HEXA 범위 오류 또는 현재 약정 미동의",
    ]
    for item in rejects:
        yy = bullet(c, item, M + 14, yy, col_w - 28, ORANGE, "small") - 8

    rx = M + col_w + 24
    para(c, "D1 / SQLite 무결성", rx, grid_top - 14, col_w - 28, "h3")
    yy = grid_top - 44
    db_items = [
        "parties: 보스·정원·조건·출발·약정 버전",
        "party_members: 역할·서버 계산 배율·계산 버전·동의 시점",
        "users / sessions: 계정과 만료 상태 분리",
        "user_characters: 등록 캐릭터와 최근 스펙",
        "CHECK·UNIQUE·FOREIGN KEY·조회 인덱스",
    ]
    for item in db_items:
        yy = bullet(c, item, rx, yy, col_w - 28, GREEN, "small") - 8

    evidence_top = grid_top - 255
    para(c, "구현 근거", M, evidence_top, CONTENT_W, "h3")
    files = [
        ("lib/model.ts", "보간·역산·방어율·레벨·포스·상태 판정"),
        ("lib/server/party-service.ts", "파티 생성·가입·탈퇴와 서버 검증"),
        ("db/schema.ts", "파티·계정 테이블, 제약 조건과 인덱스"),
        ("lib/server/party-repository.ts", "버전별 저장·조회와 구버전 합산 제외"),
    ]
    yy = evidence_top - 27
    for path, desc in files:
        c.setFont("Consolas", 7.4)
        c.setFillColor(BLUE)
        c.drawString(M + 7, yy, path)
        c.setFont("Malgun", 7.2)
        c.setFillColor(MUTED)
        c.drawString(M + 183, yy, desc)
        yy -= 20

    state_y = 67
    round_rect(c, M, state_y, CONTENT_W, 99, INK, INK)
    para(c, "계산 모델 변경 시", M + 15, state_y + 81, 120, "inverse_small_bold")
    states = [
        ("v2", "현재 값"),
        ("STALE", "버전 불일치"),
        ("EXCLUDE", "합산 제외"),
        ("RECHECK", "서버 재계산"),
    ]
    sx = M + 142
    sw = 72
    for i, (name, desc) in enumerate(states):
        c.setFillColor(HexColor("#2A303A"))
        c.roundRect(sx, state_y + 33, sw, 42, 5, fill=1, stroke=0)
        c.setFont("Consolas", 7.4)
        c.setFillColor(HexColor("#7EAAFF") if name in ("v2", "RECHECK") else HexColor("#FFB39E"))
        c.drawCentredString(sx + sw / 2, state_y + 58, name)
        c.setFont("Malgun", 6.4)
        c.setFillColor(HexColor("#D2D7E0"))
        c.drawCentredString(sx + sw / 2, state_y + 43, desc)
        if i < len(states) - 1:
            c.setStrokeColor(HexColor("#778090"))
            c.line(sx + sw + 3, state_y + 54, sx + sw + 12, state_y + 54)
        sx += sw + 15
    para(c, "현재 계산 버전과 다른 저장 배율은 파티 합계에 사용하지 않고, 활성 참가자를 다시 계산해 교체합니다.", M + 142, state_y + 23, CONTENT_W - 157, "inverse_small")
    c.showPage()


def page_evidence(c: canvas.Canvas, boss: Image.Image, detail: Image.Image) -> None:
    top = page_header(c, 7, "PRODUCT EVIDENCE")
    y = section_title(
        c, "06 · Deployed Flow",
        "계산 결과를 파티 선택과 가입 판정에 연결",
        "아래 이미지는 현재 배포 환경의 화면입니다. 전투 계산 페이지와 파티 상세가 같은 보스 배율을 사용하며, "
        "하드 유피테르의 수정된 파티 배율 154.8%와 준비도 103%가 일관되게 표시됩니다.",
        top,
    )

    para(c, "1. 전투 데이터 → 보스별 배율과 도전 상태", M, y - 18, CONTENT_W, "h3")
    boss_y = y - 249
    draw_image(c, boss, M, boss_y, CONTENT_W, 214, white)
    caption(c, "배포 환경 · 닉네임/HEXA 입력, 방어율별 피해량, 보스 카드", M, boss_y - 7, CONTENT_W)

    second_top = boss_y - 31
    para(c, "2. 파티 상세 → 목표·역할 최소컷·현재 준비도", M, second_top, CONTENT_W, "h3")
    detail_y = second_top - 237
    draw_image(c, detail, M, detail_y, CONTENT_W, 216, white)
    caption(c, "배포 환경 · 하드 유피테르 154.8%, 준비도 103%, 역할별 가입 조건", M, detail_y - 7, CONTENT_W)

    band_y = 68
    round_rect(c, M, band_y, CONTENT_W, 78, INK, INK)
    para(c, "같은 값의 세 사용처", M + 15, band_y + 60, 120, "inverse_small_bold")
    items = ["보스 카드", "파티 준비도", "역할 최소컷 판정"]
    x = M + 148
    for i, label in enumerate(items):
        bw = 82 if i < 2 else 112
        c.setFillColor(HexColor("#2A303A"))
        c.roundRect(x, band_y + 25, bw, 30, 5, fill=1, stroke=0)
        c.setFont("MalgunBold", 7)
        c.setFillColor(white)
        c.drawCentredString(x + bw / 2, band_y + 35.5, label)
        if i < len(items) - 1:
            c.setStrokeColor(HexColor("#778090"))
            c.line(x + bw + 3, band_y + 40, x + bw + 13, band_y + 40)
        x += bw + 17
    c.showPage()


def page_close(c: canvas.Canvas) -> None:
    top = page_header(c, 8, "VALIDATION & NEXT")
    y = section_title(
        c, "07 · Positioning",
        "게임 규칙을 계산 가능하고 운영 가능한 시스템으로",
        "MapleParty는 전투 수치를 파티 모집 행동으로 연결한 TypeScript 기반 시스템 프로젝트입니다. "
        "Unity/C# 게임플레이 구현 사례인 Abyss와 함께 제출해 계산 모델링, 도메인 설계, 라이브 운영 역량을 보완합니다.",
        top,
    )

    cards_y = y - 116
    gap = 8
    w = (CONTENT_W - gap * 2) / 3
    outcomes = [
        ("규칙 추출", "전투력 환산 엑셀에서 방어율 곡선·보정·보스 기준점만 분리해 순수 함수로 구현", SOFT_BLUE, BLUE),
        ("오류 해결", "중복 프리셋 적용과 구버전 저장 배율 문제를 원인·데이터 수명주기 단위로 수정", SOFT_ORANGE, ORANGE),
        ("행동 연결", "보스 배율을 탐색 필터·역할 최소컷·준비도·서버 가입 판정에 공통 사용", SOFT_GREEN, GREEN),
    ]
    for i, (title, body, bg, fg) in enumerate(outcomes):
        x = M + i * (w + gap)
        round_rect(c, x, cards_y, w, 94, bg, bg)
        c.setFillColor(fg)
        c.circle(x + 16, cards_y + 75, 4, fill=1, stroke=0)
        para(c, title, x + 28, cards_y + 84, w - 39, "h3")
        para(c, body, x + 12, cards_y + 54, w - 24, "small")

    mid_top = cards_y - 28
    col_w = (CONTENT_W - 10) / 2
    para(c, "이 프로젝트가 직접 증명하는 것", M, mid_top, col_w, "h3")
    para(c, "이 프로젝트만으로는 증명하지 않는 것", M + col_w + 10, mid_top, col_w, "h3")
    yy = mid_top - 28
    validated = [
        "전투 곡선의 정방향 계산과 이진 탐색 역산 구현",
        "파생 배율의 버전 관리와 구버전 값 자동 재검증",
        "역할·정원·약정 조건을 서버와 DB 제약으로 보호",
        "실제 배포와 운영 데이터 오류의 추적·수정 경험",
    ]
    for item in validated:
        yy = bullet(c, item, M, yy, col_w, BLUE, "small") - 8
    yy = mid_top - 28
    limits = [
        "C#/Unity 게임 엔진 구현 역량 — Abyss에서 별도 제시",
        "독립 정답셋 기준의 다중 HEXA 구간·전 직업 정확도",
        "사용자 입력 HEXA의 실제값과 캐릭터 소유권 확인",
        "향후 패치 후에도 보스 기준점이 자동으로 맞는다는 보장",
    ]
    for item in limits:
        yy = bullet(c, item, M + col_w + 10, yy, col_w, ORANGE, "small") - 8

    story_top = mid_top - 166
    round_rect(c, M, story_top - 126, CONTENT_W, 126, INK, INK)
    p = Paragraph(
        "“MapleParty는 전투 데이터를 보여주는 계산기에서 끝내지 않고, "
        "유저가 자신의 조건에 맞는 파티를 찾고 같은 기준으로 참가 판정을 받도록 만든 시스템입니다.”",
        ParagraphStyle(
            "quote", fontName="MalgunBold", fontSize=13, leading=22,
            textColor=white, alignment=TA_LEFT, wordWrap="CJK",
        ),
    )
    _, ph = p.wrap(CONTENT_W - 36, 90)
    p.drawOn(c, M + 18, story_top - 30 - ph)
    c.setFont("Malgun", 7.2)
    c.setFillColor(HexColor("#BFC6D2"))
    c.drawString(M + 18, story_top - 105, "전투 데이터 → 플레이 판단 → 파티 행동 → 서버 검증")

    links_y = 87
    para(c, "확인하기", M, links_y + 49, CONTENT_W, "h3")
    link_button(c, "라이브 앱 열기", LIVE_URL, M, links_y, 126, True)
    link_button(c, "소스 코드 열기", SOURCE_URL, M + 134, links_y, 134, False)
    c.setFont("Malgun", 6.8)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - M, links_y + 10, "문서 내 버튼과 URL은 클릭할 수 있습니다.")
    c.showPage()


def build() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    party = crop_white(SHOT_DIR / "party-board.png")
    boss = Image.open(SHOT_DIR / "boss-rates.png").convert("RGB")
    detail = Image.open(SHOT_DIR / "party-validation.png").convert("RGB")
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("MapleParty Game System Programmer Portfolio")
    c.setSubject("Combat data driven party recruitment and user experience")
    c.setAuthor("MapleParty")
    c.setCreator("ReportLab")

    page_cover(c)
    page_engine(c)
    page_bug_cases(c)
    page_validation_scope(c)
    page_party_ui(c, party)
    page_server(c)
    page_evidence(c, boss, detail)
    page_close(c)
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
