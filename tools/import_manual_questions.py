import json
import re
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "questions.json"
XLSX_PATH = ROOT / "829题库-人工挖空模板-2026-09-11.xlsx"

IMAGE_RE = re.compile(r"^\[图片：([^\]]+)\]$")
MARK_RE = re.compile(r"\[([^\[\]\r\n]+)\]")
PRIVATE_RE = re.compile(r"[\ue000-\uf8ff]")

# These lines are memory aids, not textbook answers.  They remain visible in
# the question but must not become recall blanks.
VISIBLE_GUIDES = {
    "性蜜罐漏拔稳",
    "高侵交（胶）体（替）毛（冒）",
    "术能环稳效速率",
    "天性关压",
    "基发适提",
    "厚隔技物",
    "则透后速造",
    "速调一面",
    "整密稀换局",
    "要原储层工技输流经地温驱指（可数）",
    "描藏油地经综",
    "程试监预",
    "强粒杂便密",
    "地能转错情",
    "悬砂滤网摩擦稳定，这是低配的经济。",
}


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Normalize full-width spaces and accidental OCR spacing without touching
    # intentional spaces in formulas and units.
    text = text.replace("\u00a0", " ").replace("\u3000", " ")
    return text


def apply_manual_corrections(question_id: int, text: str) -> str:
    text = text.replace(",", "，").replace(";", "；")
    replacements = {
        "配置而成": "配制而成",
        "普通射孔完共": "普通射孔完井",
        "转动转量很困难": "转动钻柱很困难",
        "井简中的": "井筒中的",
        "带出井简": "带出井筒",
        "钻县": "钻具",
        "保待较长稳产期": "保持较长稳产期",
        "本并低产": "本井低产",
        "地层破裂压裂的变化": "地层破裂压力的变化",
        "有效作用距和裂缝": "有效作用距离和裂缝",
        "有效作用距和裂缝的": "有效作用距离和裂缝的",
        "解堵化。": "解堵酸化。",
        "CaMg(CO)3": "CaMg(CO₃)₂",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    # Repair known malformed hand-edited markers while retaining their full
    # semantic answer ranges.
    if question_id == 103:
        text = text.replace(
            "④]在键槽中遇阻、拉力稍大，转动钻柱很困难，但只要放下钻柱脱离键槽则旋转自如]",
            "④[在键槽中遇阻、拉力稍大，转动钻柱很困难，但只要放下钻柱脱离键槽则旋转自如]",
        )
    if question_id in (135, 240):
        text = text.replace("③]", "③[")
    if question_id == 135:
        text = text.replace("(3)]", "(3)[")
    if question_id == 39:
        text = text.replace("地层的]时代]", "地层的[时代]")
    if question_id == 40:
        text = text.replace("[提高采收率及开发速，用来进行", "[提高采收率及开发速度]，用来进行")
    if question_id == 355:
        text = text.replace("起到降温]的作用", "起到[降温]的作用")
    if question_id == 368:
        text = text.replace("[有效作用距离和裂缝的[导流能力]", "有效作用距离和裂缝的[导流能力]")
    if question_id == 100:
        # This is a mnemonic guide, not a textbook sentence.
        text = text.replace("[(性蜜罐漏拔稳)]", "性蜜罐漏拔稳")
    return text


def title_without_colon(title: str) -> str:
    return re.sub(r"[：:]\s*$", "", title.strip())


def parse_line(line: str, question_id: int):
    line = apply_manual_corrections(question_id, normalize_text(line))
    image_match = IMAGE_RE.fullmatch(line.strip())
    if image_match:
        return {"type": "image", "src": image_match.group(1).strip()}

    # A standalone guide mnemonic is deliberately visible.
    stripped = line.strip()
    guide = stripped
    if guide.startswith("[") and guide.endswith("]"):
        guide = guide[1:-1]
    if guide in VISIBLE_GUIDES:
        return {"type": "paragraph", "text": guide, "clozes": []}

    text_parts = []
    clozes = []
    cursor = 0
    for match in MARK_RE.finditer(line):
        text_parts.append(line[cursor:match.start()])
        answer = match.group(1)
        start = sum(len(part) for part in text_parts)
        text_parts.append(answer)
        end = start + len(answer)
        clozes.append({"start": start, "end": end, "answer": answer})
        cursor = match.end()
    text_parts.append(line[cursor:])
    text = "".join(text_parts)
    return {"type": "paragraph", "text": text, "clozes": clozes}


def parse_manual(question_id: int, manual: str):
    manual = apply_manual_corrections(question_id, normalize_text(manual or "")).strip("\n")
    if not manual or manual in {"删去", "删除", "重复题", "暂不处理"}:
        return None

    blocks = []
    for line in manual.split("\n"):
        if line == "":
            if blocks and blocks[-1].get("type") != "spacer":
                blocks.append({"type": "spacer"})
            continue
        blocks.append(parse_line(line, question_id))

    while blocks and blocks[-1].get("type") == "spacer":
        blocks.pop()
    return blocks


def split_first_prompt(blocks, question_id=None):
    """Split a one-line `提示：正文` paragraph so the prompt stays visible."""
    first_index = next(
        (index for index, block in enumerate(blocks) if block["type"] == "paragraph"),
        None,
    )
    if first_index is None:
        return
    block = blocks[first_index]
    if not block.get("clozes") and question_id != 62:
        return
    colon = re.search(r"[：:]", block["text"])
    if not colon or colon.start() == 0:
        return
    prompt = title_without_colon(block["text"][:colon.start()])
    offset = colon.end()
    while offset < len(block["text"]) and block["text"][offset].isspace():
        offset += 1
    answer_text = block["text"][offset:]
    answer_clozes = [
        {**cloze, "start": cloze["start"] - offset, "end": cloze["end"] - offset}
        for cloze in block["clozes"]
        if cloze["end"] > offset
    ]
    blocks[first_index:first_index + 1] = [
        {"type": "paragraph", "text": prompt, "clozes": []},
        {"type": "paragraph", "text": answer_text, "clozes": answer_clozes},
    ]


def read_manual_rows():
    workbook = load_workbook(XLSX_PATH, read_only=True, data_only=False)
    sheet = workbook["逐题人工挖空"]
    headers = [cell.value for cell in next(sheet.iter_rows(min_row=1, max_row=1))]
    indexes = {name: index for index, name in enumerate(headers)}
    rows = {}
    for row in sheet.iter_rows(min_row=2, values_only=True):
        value = row[indexes["题号"]]
        if value is None:
            continue
        question_id = int(value)
        rows[question_id] = {
            "manual": row[indexes["手动挖空版（在此编辑）"]] or "",
            "status": row[indexes["审核状态"]] or "",
        }
    return rows


def validate_question(question):
    if not question["blocks"]:
        raise ValueError(f"第 {question['id']} 题没有内容")
    if PRIVATE_RE.search(json.dumps(question, ensure_ascii=False)):
        raise ValueError(f"第 {question['id']} 题仍含私有字符")
    for block in question["blocks"]:
        if block["type"] != "paragraph":
            continue
        previous_end = -1
        for cloze in block.get("clozes", []):
            start, end = cloze["start"], cloze["end"]
            if not (isinstance(start, int) and isinstance(end, int) and 0 <= start < end):
                raise ValueError(f"第 {question['id']} 题存在无效挖空范围")
            if start < previous_end or block["text"][start:end] != cloze["answer"]:
                raise ValueError(f"第 {question['id']} 题挖空范围重叠或答案不一致")
            previous_end = end
        for marker in ("[", "]"):
            if marker in block["text"]:
                raise ValueError(f"第 {question['id']} 题正文残留未解析标记: {block['text']}")


def set_clozes(block, answers):
    clozes = []
    cursor = 0
    for answer in answers:
        start = block["text"].find(answer, cursor)
        if start < 0:
            raise ValueError(f"正文中找不到挖空答案 {answer!r}: {block['text']}")
        end = start + len(answer)
        clozes.append({"start": start, "end": end, "answer": answer})
        cursor = end
    block["clozes"] = clozes


def find_block(question, prefix):
    return next(
        (block for block in question["blocks"]
         if block["type"] == "paragraph" and block["text"].startswith(prefix)),
        None,
    )


def apply_audited_repairs(question):
    question_id = question["id"]
    if question_id == 4:
        block = find_block(question, "每个孔隙所连通")
        if block:
            set_clozes(block, ["孔隙", "连通", "喉道数", "2~15"])
    elif question_id == 40:
        block = find_block(question, "开发井是以开发")
        if block:
            set_clozes(block, [
                "开发", "通道", "采用各种措施", "浅油气井", "油气井", "注入井", "检查井",
            ])
    elif question_id == 8:
        first = find_block(question, "①受构造力作用")
        second = find_block(question, "②地下水活跃")
        if first:
            set_clozes(first, ["构造力作用", "微裂隙", "孔隙度增大"])
        if second:
            set_clozes(second, [
                "地下水活跃", "溶蚀", "岩石颗粒和胶结物", "孔隙度增加",
                "矿物质沉淀", "充填或缩小", "岩石孔隙", "孔隙度减小",
            ])
    elif question_id == 12:
        block = find_block(question, "分布和残存在")
        if block:
            set_clozes(block, [
                "分布和残存", "颗粒接触处", "角隅", "微细孔隙", "吸附", "岩石骨架颗粒表面",
            ])
    elif question_id == 14:
        block = find_block(question, "残余油是指")
        if block:
            set_clozes(block, ["工作剂驱洗过的地层", "滞留或闭锁", "岩石孔隙"])
    elif question_id == 15:
        block = find_block(question, "剩余油是指")
        if block:
            set_clozes(block, ["已开发油藏(或油层)", "未被工作剂驱替", "波及"])
    elif question_id == 22:
        block = find_block(question, "1mPa•s")
        if block:
            block["text"] = "1mPa•s=1cP（毫帕秒，厘泊）"
            set_clozes(block, ["1mPa•s=1cP"])
    elif question_id == 27:
        heading = next((block for block in question["blocks"] if block["type"] == "paragraph"), None)
        if heading:
            heading["text"] = "天然气的体积系数Bg"
            heading["clozes"] = []
    elif question_id == 37:
        block = find_block(question, "水驱效率=(1-Swi")
        if block:
            set_clozes(block, ["水驱效率=(1-Swi-Sor)/(1-Swi) ×100%"])
    elif question_id == 120:
        block = find_block(question, "551.6MPa")
        if block:
            set_clozes(block, ["551.6MPa"])
    elif question_id == 186:
        block = find_block(question, "(1)按组成分类")
        if block:
            block["clozes"] = []


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    manual_rows = read_manual_rows()
    original = {
        question.get("sourceId", question["id"]): question
        for question in data["questions"]
    }
    questions = []
    removed = []

    for question_id in sorted(manual_rows):
        row = manual_rows[question_id]
        blocks = parse_manual(question_id, row["manual"])
        if blocks is None:
            removed.append(question_id)
            continue
        split_first_prompt(blocks, question_id)
        question = original.get(question_id, {"id": question_id})
        question["id"] = question_id
        question["sourceId"] = question_id
        question["blocks"] = blocks
        paragraph = next((block for block in blocks if block["type"] == "paragraph"), None)
        question["title"] = title_without_colon(paragraph["text"] if paragraph else f"第 {question_id} 题")
        if paragraph:
            paragraph["text"] = question["title"]
            # The first paragraph is the visible prompt.  Any markers in a
            # title line are treated as accidental and are removed.
            paragraph["clozes"] = []
        if question_id == 127:
            body = next(
                (block for block in blocks if block["type"] == "paragraph" and "任意截面处" in block["text"]),
                None,
            )
            if body is not None:
                answer = "任意截面处的套管强度>外载"
                start = body["text"].index(answer)
                body["clozes"] = [{"start": start, "end": start + len(answer), "answer": answer}]
        apply_audited_repairs(question)
        question["fillCount"] = sum(
            len(block.get("clozes", [])) for block in blocks if block["type"] == "paragraph"
        )
        validate_question(question)
        questions.append(question)

    # The workbook itself is the source of truth for deletions.  Ensure an
    # accidental omission cannot silently drop a question from the app.
    expected_ids = set(original) - set(removed)
    actual_ids = {question["id"] for question in questions}
    missing = expected_ids - actual_ids
    if missing:
        raise ValueError(f"Excel 未提供题目: {sorted(missing)}")

    for question in questions:
        question_id = question["id"]
        if question_id <= 37:
            chapter = {"number": 1, "title": "储层岩石物性与渗流基础"}
        elif question_id <= 146:
            chapter = {"number": 2, "title": "钻井工程"}
        elif question_id <= 222:
            chapter = {"number": 3, "title": "完井工程与试油"}
        elif question_id <= 250:
            chapter = {"number": 4, "title": "油气田开发基础"}
        elif question_id <= 275:
            chapter = {"number": 5, "title": "油藏驱动与试井"}
        elif question_id <= 310:
            chapter = {"number": 6, "title": "油田注水开发"}
        elif question_id <= 343:
            chapter = {"number": 7, "title": "采油工程"}
        else:
            chapter = {"number": 8, "title": "压裂与酸化"}
        question["chapter"] = chapter

    # App-facing numbers stay continuous after workbook rows are deleted.
    # sourceId remains stable so future textbook audits can still address the
    # original Excel row without coupling saved progress to that old number.
    for display_id, question in enumerate(questions, start=1):
        question["sourceId"] = question["id"]
        question["id"] = display_id

    data["version"] = 5
    data["source"] = XLSX_PATH.name
    data["total"] = len(questions)
    data["questions"] = questions
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "version": data["version"],
        "questions": len(questions),
        "removed": removed,
        "clozes": sum(question["fillCount"] for question in questions),
        "nofill": [question["id"] for question in questions if not question["fillCount"]],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
