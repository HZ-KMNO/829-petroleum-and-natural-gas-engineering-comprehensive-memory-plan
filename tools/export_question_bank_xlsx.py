import json
from datetime import date
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.drawing.image import Image as ExcelImage
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "data" / "questions.json"
OUTPUT = ROOT / f"829题库-空白审核模板-{date.today().isoformat()}.xlsx"

HEADER_FILL = PatternFill("solid", fgColor="176B5B")
HEADER_FONT = Font(color="FFFFFF", bold=True)
SUBTLE_FILL = PatternFill("solid", fgColor="EAF2EF")
EDIT_FILL = PatternFill("solid", fgColor="FFF6D8")
DONE_FILL = PatternFill("solid", fgColor="DDEFE4")
PAUSE_FILL = PatternFill("solid", fgColor="F2E2DE")
THIN_BORDER = Border(bottom=Side(style="thin", color="D8DEDA"))


def write_text(cell, value):
    cell.value = "" if value is None else str(value)
    cell.data_type = "s"


def display_block(block):
    block_type = block.get("type")
    if block_type == "paragraph":
        return block.get("text", "")
    if block_type == "image":
        return f"[图片：{block.get('src', '')}]"
    if block_type == "separator":
        return "────────"
    return ""


def combined_question(question):
    lines = [display_block(block) for block in question.get("blocks", [])]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines)


def image_file(src):
    return ROOT / "public" / src.lstrip("/")


def style_header(sheet):
    for cell in sheet[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[1].height = 26
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    sheet.sheet_view.showGridLines = False


def set_widths(sheet, widths):
    for column, width in widths.items():
        sheet.column_dimensions[column].width = width


def add_status_validation(sheet, column, last_row):
    validation = DataValidation(
        type="list",
        formula1='"未审核,已完成,暂不处理"',
        allow_blank=False,
    )
    validation.error = "请选择：未审核、已完成或暂不处理"
    validation.errorTitle = "审核状态无效"
    sheet.add_data_validation(validation)
    validation.add(f"{column}2:{column}{last_row}")
    sheet.conditional_formatting.add(
        f"{column}2:{column}{last_row}",
        FormulaRule(formula=[f'{column}2="已完成"'], fill=DONE_FILL),
    )
    sheet.conditional_formatting.add(
        f"{column}2:{column}{last_row}",
        FormulaRule(formula=[f'{column}2="暂不处理"'], fill=PAUSE_FILL),
    )


def build_workbook(data):
    workbook = Workbook()
    workbook.creator = "829 记忆计划"
    workbook.title = "829题库人工挖空模板"
    workbook.subject = "逐题人工设计挖空"
    workbook.description = "从 questions.json 导出的无预设挖空题库"

    guide = workbook.active
    guide.title = "使用说明"
    guide.sheet_view.showGridLines = False
    guide.column_dimensions["A"].width = 22
    guide.column_dimensions["B"].width = 100
    guide.row_dimensions[1].height = 34
    guide["A1"] = "829题库人工挖空模板"
    guide["A1"].font = Font(size=18, bold=True, color="17332D")
    guide.merge_cells("A1:B1")
    instructions = [
        ("题库规模", f"{len(data['questions'])} 道当前有效题目；应用题号连续，sourceId 保留教材源题号。"),
        ("当前状态", "本文件没有预设任何挖空。“题目原文”和“手动挖空版”起始内容完全一致。"),
        ("主要编辑位置", "在“逐题人工挖空”表的“手动挖空版”列中编辑。"),
        ("标记方法", "把需要隐藏的完整答案放在半角方括号中，例如：孔隙与喉道直径的比值。可标为 [孔隙]与[喉道][直径]的比值。"),
        ("语义要求", "一个花括号对应一个完整答案；不要只包半个词，也不要把整句全部包住。题目提示、作用：、定义：、意义：、分类：等提问标签保持可见。"),
        ("文字纠错", "可以直接在“手动挖空版”中修改错字，但请保留原有段落换行和图片占位行。"),
        ("图片题", "[图片：路径] 表示公式或示意图，保持占位行不变；可在“图片索引”表查看全部图片预览。"),
        ("审核状态", "每题处理完后将状态改为“已完成”，需要跳过的题选择“暂不处理”。"),
        ("后续导入", "修改完成后交回此 Excel，即可按题号和块序号生成新版 App 题库。"),
        ("数据来源", str(SOURCE)),
        ("导出日期", date.today().isoformat()),
    ]
    for row_index, (label, value) in enumerate(instructions, start=3):
        guide.cell(row=row_index, column=1, value=label).font = Font(bold=True, color="176B5B")
        write_text(guide.cell(row=row_index, column=2), value)
        guide.cell(row=row_index, column=1).alignment = Alignment(vertical="top")
        guide.cell(row=row_index, column=2).alignment = Alignment(wrap_text=True, vertical="top")
        guide.row_dimensions[row_index].height = 32 if row_index not in (6, 7) else 48

    overview = workbook.create_sheet("逐题人工挖空")
    overview.append([
        "题号", "章", "章节名称", "题目提示", "题目原文（勿改）", "手动挖空版（在此编辑）",
        "审核状态", "备注", "段落数", "图片数",
        "知识类型",
    ])
    for question in data["questions"]:
        chapter = question.get("chapter", {})
        plain_text = combined_question(question)
        paragraph_count = sum(block.get("type") == "paragraph" for block in question.get("blocks", []))
        image_count = sum(block.get("type") == "image" for block in question.get("blocks", []))
        overview.append([
            question["id"], chapter.get("number", 0), chapter.get("title", ""), question.get("title", ""),
            plain_text, plain_text, "未审核", "", paragraph_count, image_count,
            "、".join(question.get("knowledgeTypes", [])),
        ])
    style_header(overview)
    set_widths(overview, {"A": 8, "B": 6, "C": 24, "D": 40, "E": 72, "F": 72, "G": 12, "H": 28, "I": 10, "J": 10, "K": 24})
    overview.sheet_view.zoomScale = 75
    for row in overview.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = THIN_BORDER
        row[4].fill = SUBTLE_FILL
        row[4].protection = Protection(locked=True)
        row[5].fill = EDIT_FILL
        row[6].alignment = Alignment(horizontal="center", vertical="top")
        overview.row_dimensions[row[0].row].height = 96
    add_status_validation(overview, "G", overview.max_row)

    details = workbook.create_sheet("块级明细")
    details.append([
        "题号", "章", "章节名称", "块序号", "块类型", "原始内容（勿改）", "手动挖空内容",
        "图片路径", "审核状态", "备注",
        "知识类型",
    ])
    type_labels = {"paragraph": "正文", "image": "图片", "separator": "分隔线", "spacer": "空行"}
    for question in data["questions"]:
        chapter = question.get("chapter", {})
        for block_index, block in enumerate(question.get("blocks", []), start=1):
            content = display_block(block)
            details.append([
                question["id"], chapter.get("number", 0), chapter.get("title", ""), block_index,
                type_labels.get(block.get("type"), block.get("type", "")), content, content,
                block.get("src", "") if block.get("type") == "image" else "", "未审核", "",
                block.get("category", ""),
            ])
    style_header(details)
    set_widths(details, {"A": 8, "B": 6, "C": 24, "D": 10, "E": 10, "F": 70, "G": 70, "H": 38, "I": 12, "J": 28, "K": 18})
    details.sheet_view.zoomScale = 80
    for row in details.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = THIN_BORDER
        row[5].fill = SUBTLE_FILL
        row[6].fill = EDIT_FILL
    add_status_validation(details, "I", details.max_row)

    image_sheet = workbook.create_sheet("图片索引")
    image_sheet.append(["题号", "章", "题目提示", "图片路径", "图片预览"])
    image_row = 2
    for question in data["questions"]:
        chapter = question.get("chapter", {})
        for block in question.get("blocks", []):
            if block.get("type") != "image":
                continue
            src = block.get("src", "")
            image_sheet.append([question["id"], chapter.get("number", 0), question.get("title", ""), src, ""])
            path = image_file(src)
            if path.exists():
                image = ExcelImage(path)
                scale = min(1, 360 / image.width, 180 / image.height)
                image.width = int(image.width * scale)
                image.height = int(image.height * scale)
                image.anchor = f"E{image_row}"
                image_sheet.add_image(image)
                image_sheet.row_dimensions[image_row].height = max(44, image.height * 0.75 + 8)
            image_row += 1
    style_header(image_sheet)
    set_widths(image_sheet, {"A": 8, "B": 6, "C": 48, "D": 40, "E": 52})
    image_sheet.sheet_view.zoomScale = 80
    for row in image_sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = THIN_BORDER

    workbook.active = 1
    return workbook


def validate_output(path, question_count, image_count):
    workbook = load_workbook(path, data_only=False)
    overview = workbook["逐题人工挖空"]
    details = workbook["块级明细"]
    images = workbook["图片索引"]
    assert overview.max_row - 1 == question_count
    assert images.max_row - 1 == image_count
    assert all(overview.cell(row=row, column=5).value == overview.cell(row=row, column=6).value for row in range(2, overview.max_row + 1))
    assert all("{{" not in (overview.cell(row=row, column=6).value or "") for row in range(2, overview.max_row + 1))
    assert details.max_row > question_count
    assert not any(cell.data_type == "f" for sheet in workbook.worksheets for row in sheet.iter_rows() for cell in row)


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    workbook = build_workbook(data)
    workbook.save(OUTPUT)
    image_count = sum(
        block.get("type") == "image"
        for question in data["questions"]
        for block in question.get("blocks", [])
    )
    validate_output(OUTPUT, len(data["questions"]), image_count)
    print(json.dumps({
        "output": str(OUTPUT),
        "questions": len(data["questions"]),
        "detail_rows": sum(len(question.get("blocks", [])) for question in data["questions"]),
        "images": image_count,
        "preblanked": False,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
