import argparse
import html
import json
import sqlite3
import zipfile
from pathlib import Path

import genanki


APP_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = APP_ROOT / "public" / "data" / "questions.json"
MEDIA_DIR = APP_ROOT / "public" / "media"
FONT_PATH = APP_ROOT / "public" / "_markji.otf"
DEFAULT_OUTPUT = APP_ROOT.parent / "outputs" / "829石油与天然气工程综合_完整版题库_372题.apkg"

DECK_ID = 2059400110
MODEL_ID = 2059400111
FONT_MEDIA_NAME = FONT_PATH.name


CARD_CSS = r"""
@font-face {
  font-family: "MarkjiGlyph";
  src: url("_markji.otf");
}

.card {
  margin: 0;
  padding: 24px 18px 36px;
  background: #f4f6f4;
  color: #18221f;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
  font-size: 18px;
  line-height: 1.85;
  text-align: left;
  letter-spacing: 0;
}

.card-inner {
  width: min(760px, 100%);
  margin: 0 auto;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  color: #68746f;
  font-size: 13px;
  font-weight: 700;
}

.question-content {
  padding: 24px;
  border: 1px solid #dfe4e1;
  border-radius: 8px;
  background: #ffffff;
}

.question-content p {
  margin: 0 0 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.question-content p:last-child {
  margin-bottom: 0;
}

.markji {
  font-family: "MarkjiGlyph", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
}

.answer-blank {
  display: inline-block;
  min-width: 3em;
  max-width: 100%;
  height: 1.15em;
  vertical-align: -0.05em;
  border-bottom: 2px solid #147d69;
  background: repeating-linear-gradient(90deg, transparent 0, transparent 7px, rgba(20, 125, 105, 0.06) 7px, rgba(20, 125, 105, 0.06) 8px);
}

.answer-fill {
  color: #0e6555;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 4px;
}

.topic-mark {
  padding: 1px 3px;
  background: #d9f1d5;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.content-separator {
  height: 1px;
  margin: 12px 0 18px;
  background: #dfe4e1;
}

.content-spacer {
  height: 10px;
}

.question-image {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 560px;
  margin: 20px auto;
  object-fit: contain;
}

#answer {
  width: min(760px, 100%);
  margin: 22px auto;
  border: 0;
  border-top: 2px solid #cbd3cf;
}

.answer-label {
  margin: 0 0 8px;
  color: #147d69;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 520px) {
  .card {
    padding: 14px 10px 26px;
    font-size: 16px;
  }

  .question-content {
    padding: 18px 15px;
  }
}
"""


def parse_args():
    parser = argparse.ArgumentParser(description="导出 829 完整版题库为 Anki 牌组")
    parser.add_argument("--data", type=Path, default=DATA_PATH, help="题库 JSON 路径")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="输出 .apkg 路径")
    return parser.parse_args()


def wrap_text(text, markji=False, class_name=None):
    classes = [name for name in (class_name, "markji" if markji else None) if name]
    class_attribute = f' class="{" ".join(classes)}"' if classes else ""
    return f"<span{class_attribute}>{html.escape(text)}</span>"


def blank_width(text):
    return min(22, max(3, len(text) + 1))


def render_segment(segment, reveal):
    text = segment.get("text", "")
    kind = segment.get("kind", "text")
    markji = bool(segment.get("markji"))
    if kind == "fill":
        if reveal:
            return wrap_text(text, markji=markji, class_name="answer-fill")
        return f'<span class="answer-blank{" markji" if markji else ""}" style="width:{blank_width(text)}em"></span>'
    if kind == "topic":
        return wrap_text(text, markji=markji, class_name="topic-mark")
    return wrap_text(text, markji=markji)


def render_block(block, reveal):
    block_type = block.get("type")
    if block_type == "paragraph":
        content = "".join(render_segment(segment, reveal) for segment in block.get("segments", []))
        return f"<p>{content}</p>"
    if block_type == "separator":
        return '<div class="content-separator"></div>'
    if block_type == "spacer":
        return '<div class="content-spacer"></div>'
    if block_type == "image":
        source = Path(block["src"]).name
        return f'<img class="question-image" src="{html.escape(source)}" alt="题目配图">'
    raise ValueError(f"未知内容块类型: {block_type}")


def first_paragraph(question):
    return next((block for block in question["blocks"] if block.get("type") == "paragraph"), None)


def render_question(question, reveal, prompt_only=False):
    if prompt_only:
        prompt = first_paragraph(question)
        blocks = [prompt] if prompt else []
    else:
        blocks = question["blocks"]
    content = "".join(render_block(block, reveal) for block in blocks)
    return f'<div class="question-content">{content}</div>'


def card_front(question, source_label):
    prompt_only = question.get("fillCount", 0) == 0
    content = render_question(question, reveal=False, prompt_only=prompt_only)
    return (
        '<div class="card-inner">'
        f'<div class="card-meta"><span>第 {question["id"]} 题</span><span>{source_label}</span></div>'
        f"{content}</div>"
    )


def card_back(question):
    return (
        '<div class="card-inner">'
        '<div class="answer-label">完整答案</div>'
        f'{render_question(question, reveal=True)}</div>'
    )


def load_and_validate(data_path):
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    questions = payload.get("questions", [])
    declared_total = payload.get("total")
    if declared_total != len(questions):
        raise ValueError(f"题目数量不一致: 声明 {declared_total}，实际 {len(questions)}")

    ids = [question.get("id") for question in questions]
    expected_ids = list(range(1, declared_total + 1))
    if ids != expected_ids:
        raise ValueError("题号必须从 1 开始连续排列且不能重复")

    referenced_media = {
        Path(block["src"]).name
        for question in questions
        for block in question["blocks"]
        if block.get("type") == "image"
    }
    missing_media = sorted(name for name in referenced_media if not (MEDIA_DIR / name).is_file())
    if missing_media:
        raise FileNotFoundError(f"缺少题目图片: {', '.join(missing_media)}")
    if not FONT_PATH.is_file():
        raise FileNotFoundError(f"缺少特殊字形字体: {FONT_PATH}")
    return payload, questions, sorted(referenced_media)


def build_deck(questions):
    model = genanki.Model(
        MODEL_ID,
        "829 完整版题库",
        fields=[
            {"name": "序号"},
            {"name": "题目"},
            {"name": "答案"},
            {"name": "来源"},
        ],
        templates=[
            {
                "name": "题目与答案",
                "qfmt": "{{题目}}",
                "afmt": '{{FrontSide}}<hr id="answer">{{答案}}',
            }
        ],
        css=CARD_CSS,
    )
    deck = genanki.Deck(DECK_ID, "829石油与天然气工程综合::完整版题库（372题）")

    for question in questions:
        question_id = question["id"]
        source_label = "原358题库" if question_id <= 358 else "教材补充14题"
        tags = ["829", "完整版", source_label, f"题号_{question_id:03d}"]
        note = genanki.Note(
            model=model,
            fields=[
                f"{question_id:03d}",
                card_front(question, source_label),
                card_back(question),
                source_label,
            ],
            sort_field=0,
            tags=tags,
            guid=genanki.guid_for("829-complete-question-bank", question_id),
        )
        note.due = question_id
        deck.add_note(note)
    return deck


def validate_package(output, expected_questions, expected_media):
    with zipfile.ZipFile(output) as archive:
        archive_names = set(archive.namelist())
        if not {"collection.anki2", "media"}.issubset(archive_names):
            raise ValueError("Anki 包缺少数据库或媒体索引")
        media_map = json.loads(archive.read("media"))
        media_names = set(media_map.values())
        missing_media = sorted(set(expected_media) - media_names)
        if missing_media:
            raise ValueError(f"Anki 包缺少媒体: {', '.join(missing_media)}")
        database = archive.read("collection.anki2")

    connection = sqlite3.connect(":memory:")
    connection.deserialize(database)
    note_count, unique_guids = connection.execute(
        "select count(*), count(distinct guid) from notes"
    ).fetchone()
    card_count, minimum_due, maximum_due = connection.execute(
        "select count(*), min(due), max(due) from cards"
    ).fetchone()
    model_data, deck_data = connection.execute("select models, decks from col").fetchone()
    model_names = {model["name"] for model in json.loads(model_data).values()}
    deck_names = {deck["name"] for deck in json.loads(deck_data).values()}
    original_count = connection.execute(
        "select count(*) from notes where tags like '%原358题库%'"
    ).fetchone()[0]
    supplemental_count = connection.execute(
        "select count(*) from notes where tags like '%教材补充14题%'"
    ).fetchone()[0]
    all_fields = "".join(row[0] for row in connection.execute("select flds from notes"))
    connection.close()

    if note_count != expected_questions or card_count != expected_questions:
        raise ValueError(f"卡片数量错误: 笔记 {note_count}，卡片 {card_count}")
    if unique_guids != expected_questions:
        raise ValueError("存在重复的 Anki 笔记 ID")
    if (minimum_due, maximum_due) != (1, expected_questions):
        raise ValueError(f"新卡顺序错误: {minimum_due}–{maximum_due}")
    if "829 完整版题库" not in model_names:
        raise ValueError("Anki 模板名称错误")
    expected_deck = "829石油与天然气工程综合::完整版题库（372题）"
    if expected_deck not in deck_names:
        raise ValueError("Anki 牌组名称错误")
    if original_count != 358 or supplemental_count != expected_questions - 358:
        raise ValueError("原题库与教材补充题标签数量错误")

    return {
        "notes": note_count,
        "cards": card_count,
        "unique_guids": unique_guids,
        "due_range": [minimum_due, maximum_due],
        "media": len(media_names),
        "blank_markup": all_fields.count("answer-blank"),
        "answer_markup": all_fields.count("answer-fill"),
        "image_references": all_fields.count("question-image"),
    }


def main():
    args = parse_args()
    payload, questions, referenced_media = load_and_validate(args.data.resolve())
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    deck = build_deck(questions)
    media_files = [str(MEDIA_DIR / name) for name in referenced_media]
    media_files.append(str(FONT_PATH))
    package = genanki.Package(deck, media_files=media_files)
    package.write_to_file(str(output))
    validation = validate_package(
        output,
        expected_questions=len(questions),
        expected_media=[*referenced_media, FONT_MEDIA_NAME],
    )

    summary = {
        "output": str(output),
        "source": payload.get("source"),
        "questions": len(questions),
        "original_questions": min(358, len(questions)),
        "supplemental_questions": max(0, len(questions) - 358),
        "images": len(referenced_media),
        "font": FONT_MEDIA_NAME,
        "bytes": output.stat().st_size,
        "validation": validation,
    }
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
