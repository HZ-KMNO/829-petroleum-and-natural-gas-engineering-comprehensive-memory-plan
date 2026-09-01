import json
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


APP_ROOT = Path(__file__).resolve().parents[1]
ROOT = APP_ROOT.parent
REPOSITORY_SOURCE = APP_ROOT / "source" / "石油与天然气综合_完整版题库.docx"
SOURCE = REPOSITORY_SOURCE if REPOSITORY_SOURCE.exists() else ROOT / "outputs" / "石油与天然气综合_完整版题库.docx"
DATA_DIR = APP_ROOT / "public" / "data"
MEDIA_DIR = APP_ROOT / "public" / "media"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def qn(prefix, local):
    return f"{{{NS[prefix]}}}{local}"


def paragraph_text(paragraph):
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS))


def paragraph_style(paragraph):
    props = paragraph.find("w:pPr", NS)
    style = props.find("w:pStyle", NS) if props is not None else None
    return style.attrib.get(qn("w", "val")) if style is not None else None


def relationship_targets(archive):
    root = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
    return {
        rel.attrib["Id"]: "word/" + rel.attrib["Target"].lstrip("/")
        for rel in root.findall("pr:Relationship", NS)
    }


def run_segment(run):
    text = "".join(node.text or "" for node in run.findall(".//w:t", NS))
    if not text:
        return None

    props = run.find("w:rPr", NS)
    kind = "text"
    markji = False
    if props is not None:
        color = props.find("w:color", NS)
        underline = props.find("w:u", NS)
        shading = props.find("w:shd", NS)
        fonts = props.find("w:rFonts", NS)

        color_value = color.attrib.get(qn("w", "val"), "").upper() if color is not None else ""
        underline_value = underline.attrib.get(qn("w", "val"), "") if underline is not None else ""
        shade_value = shading.attrib.get(qn("w", "fill"), "").upper() if shading is not None else ""
        font_values = set(fonts.attrib.values()) if fonts is not None else set()

        if color_value == "36B59D" and underline_value not in ("", "none"):
            kind = "fill"
        elif shade_value == "C5F1C0":
            kind = "topic"
        markji = "SansMKJ" in font_values

    return {"text": text, "kind": kind, "markji": markji}


def extract():
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(SOURCE) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        targets = relationship_targets(archive)

        questions = []
        current = None
        used_media = set()

        for paragraph in document.findall(".//w:body/w:p", NS):
            text = paragraph_text(paragraph)
            style = paragraph_style(paragraph)

            # Word may rewrite a built-in heading's style id (for example to "2")
            # when the document is opened and saved. The exact heading text is the
            # stable card boundary in this source document.
            if re.fullmatch(r"第 \d+ 题", text):
                current = {"id": len(questions) + 1, "blocks": []}
                questions.append(current)
                continue

            if current is None:
                continue

            props = paragraph.find("w:pPr", NS)
            if props is not None and props.find("w:pBdr", NS) is not None:
                current["blocks"].append({"type": "separator"})
                continue

            segments = []
            for run in paragraph.findall("w:r", NS):
                segment = run_segment(run)
                if segment:
                    segments.append(segment)

            if segments:
                current["blocks"].append({"type": "paragraph", "segments": segments})
            elif not paragraph.findall(".//w:drawing", NS):
                current["blocks"].append({"type": "spacer"})

            for drawing in paragraph.findall(".//w:drawing", NS):
                blip = drawing.find(".//a:blip", NS)
                if blip is None:
                    continue
                rel_id = blip.attrib.get(qn("r", "embed"))
                source_path = targets.get(rel_id)
                if not source_path:
                    continue
                source_name = Path(source_path).name
                output_name = source_name
                if source_name not in used_media:
                    (MEDIA_DIR / output_name).write_bytes(archive.read(source_path))
                    used_media.add(source_name)
                current["blocks"].append({"type": "image", "src": f"/media/{output_name}"})

    for question in questions:
        first_text = ""
        fill_count = 0
        for block in question["blocks"]:
            if block["type"] == "paragraph":
                block_text = "".join(segment["text"] for segment in block["segments"]).strip()
                if block_text and not first_text:
                    first_text = block_text
                fill_count += sum(1 for segment in block["segments"] if segment["kind"] == "fill")
        question["title"] = first_text or f"第 {question['id']} 题"
        question["fillCount"] = fill_count

    payload = {
        "version": 1,
        "source": SOURCE.name,
        "total": len(questions),
        "questions": questions,
    }
    output = DATA_DIR / "questions.json"
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    font_source = ROOT / "work" / "markji.otf"
    if font_source.exists():
        shutil.copy2(font_source, APP_ROOT / "public" / "markji.otf")
    print(json.dumps({"questions": len(questions), "media": len(used_media), "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    extract()
