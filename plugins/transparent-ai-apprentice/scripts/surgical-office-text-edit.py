#!/usr/bin/env python3
"""Apply one teacher-confirmed Word or Excel text edit without rewriting the whole artifact."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
SS_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
XML_NS = "http://www.w3.org/XML/1998/namespace"

ET.register_namespace("w", W_NS)
ET.register_namespace("", SS_NS)
ET.register_namespace("r", R_NS)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def zip_part_hashes(path: Path) -> dict[str, str]:
    with zipfile.ZipFile(path, "r") as archive:
        return {name: sha256_bytes(archive.read(name)) for name in archive.namelist()}


def rewrite_zip(source: Path, output: Path, replacements: dict[str, bytes]) -> None:
    if source.resolve() == output.resolve():
        raise ValueError("The original Office file cannot be overwritten; choose a separate --output path.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source, "r") as reader, zipfile.ZipFile(output, "w") as writer:
        names = set(reader.namelist())
        missing = set(replacements) - names
        if missing:
            raise ValueError(f"Office package is missing required part(s): {sorted(missing)}")
        for info in reader.infolist():
            writer.writestr(info, replacements.get(info.filename, reader.read(info.filename)))


def unique_replace(text: str, source: str, replacement: str) -> tuple[str, int, int]:
    count = text.count(source)
    if count != 1:
        raise ValueError(f"Expected source text exactly once in the native target, found {count}: {source!r}")
    start = text.index(source)
    return text[:start] + replacement + text[start + len(source) :], start, start + len(source)


def replace_across_text_nodes(nodes: list[ET.Element], source: str, replacement: str) -> tuple[str, str]:
    before = "".join(node.text or "" for node in nodes)
    after, match_start, match_end = unique_replace(before, source, replacement)
    cursor = 0
    inserted = False
    for node in nodes:
        value = node.text or ""
        node_start = cursor
        node_end = cursor + len(value)
        cursor = node_end
        overlap_start = max(node_start, match_start)
        overlap_end = min(node_end, match_end)
        if overlap_start >= overlap_end:
            continue
        prefix = value[: max(0, match_start - node_start)] if node_start <= match_start < node_end else ""
        suffix = value[max(0, match_end - node_start) :] if node_start < match_end <= node_end else ""
        node.text = prefix + (replacement if not inserted else "") + suffix
        inserted = True
        if node.text.startswith(" ") or node.text.endswith(" "):
            node.set(f"{{{XML_NS}}}space", "preserve")
    if not inserted:
        raise ValueError("The source text could not be mapped to Word text runs.")
    actual = "".join(node.text or "" for node in nodes)
    if actual != after:
        raise ValueError("Word run-level replacement did not produce the expected paragraph text.")
    return before, after


def edit_docx(source: Path, output: Path, intent: dict) -> dict:
    locator = str(intent.get("locator", ""))
    with zipfile.ZipFile(source, "r") as archive:
        document_xml = archive.read("word/document.xml")
    root = ET.fromstring(document_xml)
    paragraphs = root.findall(f".//{{{W_NS}}}p")
    paragraph_match = re.fullmatch(r"paragraph:(\d+)", locator, flags=re.IGNORECASE)
    table_match = re.fullmatch(
        r"table:(\d+)/row:(\d+)/cell:(\d+)/paragraph:(\d+)", locator, flags=re.IGNORECASE
    )
    target_kind = "document_paragraph"
    if paragraph_match:
        paragraph_number = int(paragraph_match.group(1))
        if paragraph_number < 1 or paragraph_number > len(paragraphs):
            raise ValueError(f"Word paragraph {paragraph_number} is outside 1..{len(paragraphs)}.")
        paragraph = paragraphs[paragraph_number - 1]
    elif table_match:
        table_number, row_number, cell_number, paragraph_number = map(int, table_match.groups())
        tables = root.findall(f".//{{{W_NS}}}tbl")
        if table_number < 1 or table_number > len(tables):
            raise ValueError(f"Word table {table_number} is outside 1..{len(tables)}.")
        rows = tables[table_number - 1].findall(f"./{{{W_NS}}}tr")
        if row_number < 1 or row_number > len(rows):
            raise ValueError(f"Word table row {row_number} is outside 1..{len(rows)}.")
        cells = rows[row_number - 1].findall(f"./{{{W_NS}}}tc")
        if cell_number < 1 or cell_number > len(cells):
            raise ValueError(f"Word table cell {cell_number} is outside 1..{len(cells)}.")
        cell_paragraphs = cells[cell_number - 1].findall(f".//{{{W_NS}}}p")
        if paragraph_number < 1 or paragraph_number > len(cell_paragraphs):
            raise ValueError(f"Word table-cell paragraph {paragraph_number} is outside 1..{len(cell_paragraphs)}.")
        paragraph = cell_paragraphs[paragraph_number - 1]
        target_kind = "table_cell_paragraph"
    else:
        raise ValueError(
            "Word locator must use paragraph:N or table:N/row:N/cell:N/paragraph:N with 1-based numbers."
        )
    nodes = paragraph.findall(f".//{{{W_NS}}}t")
    if not nodes:
        raise ValueError(f"Word paragraph {paragraph_number} has no editable text nodes.")
    operation = intent.get("operation", "replace")
    if operation == "format":
        raise ValueError("This adapter edits exact Word text only; format-only edits require a reviewed style adapter.")
    replacement = "" if operation == "delete" else str(intent.get("replacementText", ""))
    before, after = replace_across_text_nodes(nodes, str(intent.get("sourceText", "")), replacement)
    updated_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True, short_empty_elements=False)
    rewrite_zip(source, output, {"word/document.xml": updated_xml})
    return {
        "documentType": "word_docx",
        "nativeTarget": locator,
        "packagePart": "word/document.xml",
        "targetBefore": before,
        "targetAfter": after,
        "paragraphCount": len(paragraphs),
        "targetKind": target_kind,
        "textRunCount": len(nodes),
        "richTextRunPropertiesPreserved": True,
        "layoutRisk": "low" if "\n" not in replacement and len(replacement) <= len(str(intent.get("sourceText", ""))) else "targeted_visual_spot_check_recommended",
    }


def shared_string_items(archive: zipfile.ZipFile) -> list[ET.Element]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return root.findall(f"{{{SS_NS}}}si")


def shared_strings(items: list[ET.Element]) -> list[str]:
    return ["".join(node.text or "" for node in item.findall(f".//{{{SS_NS}}}t")) for item in items]


def resolve_sheet_part(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relation_id = ""
    for sheet in workbook.findall(f".//{{{SS_NS}}}sheet"):
        if sheet.get("name") == sheet_name:
            relation_id = sheet.get(f"{{{R_NS}}}id", "")
            break
    if not relation_id:
        raise ValueError(f"Excel worksheet not found: {sheet_name}")
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    target = ""
    for relation in relationships.findall(f"{{{PKG_REL_NS}}}Relationship"):
        if relation.get("Id") == relation_id:
            target = relation.get("Target", "")
            break
    if not target:
        raise ValueError(f"Excel worksheet relationship is missing for: {sheet_name}")
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join("xl", target))


def excel_cell_text(cell: ET.Element, strings: list[str]) -> str:
    cell_type = cell.get("t", "")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(f".//{{{SS_NS}}}t"))
    value = cell.find(f"{{{SS_NS}}}v")
    if value is None:
        return ""
    if cell_type == "s":
        index = int(value.text or "0")
        return strings[index] if 0 <= index < len(strings) else ""
    return value.text or ""


def set_excel_inline_text(cell: ET.Element, value: str) -> None:
    if cell.find(f"{{{SS_NS}}}f") is not None:
        raise ValueError("The selected Excel cell contains a formula; text replacement is blocked to preserve calculation logic.")
    for child in list(cell):
        if child.tag in {f"{{{SS_NS}}}v", f"{{{SS_NS}}}is"}:
            cell.remove(child)
    cell.set("t", "inlineStr")
    inline = ET.SubElement(cell, f"{{{SS_NS}}}is")
    text_node = ET.SubElement(inline, f"{{{SS_NS}}}t")
    text_node.text = value
    if value.startswith(" ") or value.endswith(" "):
        text_node.set(f"{{{XML_NS}}}space", "preserve")


def replace_excel_cell_text(
    cell: ET.Element, source: str, replacement: str, string_items: list[ET.Element]
) -> tuple[str, str, bool]:
    if cell.find(f"{{{SS_NS}}}f") is not None:
        raise ValueError("The selected Excel cell contains a formula; text replacement is blocked to preserve calculation logic.")
    cell_type = cell.get("t", "")
    if cell_type == "inlineStr":
        nodes = cell.findall(f".//{{{SS_NS}}}t")
        if not nodes:
            raise ValueError("The selected Excel inline-string cell has no editable text nodes.")
        before, after = replace_across_text_nodes(nodes, source, replacement)
        return before, after, len(nodes) > 1
    if cell_type == "s":
        value_node = cell.find(f"{{{SS_NS}}}v")
        index = int(value_node.text or "0") if value_node is not None else -1
        if index < 0 or index >= len(string_items):
            raise ValueError("The selected Excel shared-string index is invalid.")
        item = copy.deepcopy(string_items[index])
        for child in list(cell):
            if child.tag in {f"{{{SS_NS}}}v", f"{{{SS_NS}}}is"}:
                cell.remove(child)
        cell.set("t", "inlineStr")
        inline = ET.SubElement(cell, f"{{{SS_NS}}}is")
        for child in list(item):
            inline.append(child)
        nodes = inline.findall(f".//{{{SS_NS}}}t")
        before, after = replace_across_text_nodes(nodes, source, replacement)
        return before, after, len(nodes) > 1
    before = excel_cell_text(cell, shared_strings(string_items))
    after, _, _ = unique_replace(before, source, replacement)
    set_excel_inline_text(cell, after)
    return before, after, False


def cell_coordinates(reference: str) -> tuple[int, int]:
    match = re.fullmatch(r"([A-Z]{1,3})([1-9]\d*)", reference.upper())
    if not match:
        raise ValueError(f"Invalid Excel cell reference: {reference}")
    column = 0
    for character in match.group(1):
        column = column * 26 + ord(character) - ord("A") + 1
    return column, int(match.group(2))


def merged_range_for_cell(root: ET.Element, cell_ref: str) -> tuple[str, str] | None:
    column, row = cell_coordinates(cell_ref)
    for merge in root.findall(f".//{{{SS_NS}}}mergeCell"):
        reference = merge.get("ref", "")
        if ":" not in reference:
            continue
        start, end = reference.split(":", 1)
        start_column, start_row = cell_coordinates(start)
        end_column, end_row = cell_coordinates(end)
        if start_column <= column <= end_column and start_row <= row <= end_row:
            return reference, start.upper()
    return None


def edit_xlsx(source: Path, output: Path, intent: dict) -> dict:
    locator = str(intent.get("locator", ""))
    match = re.fullmatch(r"(.+)!([A-Za-z]{1,3}[1-9]\d*)", locator)
    if not match:
        raise ValueError("Excel locator must use SheetName!A1 notation.")
    sheet_name = match.group(1).strip("'")
    cell_ref = match.group(2).upper()
    with zipfile.ZipFile(source, "r") as archive:
        sheet_part = resolve_sheet_part(archive, sheet_name)
        worksheet_xml = archive.read(sheet_part)
        string_items = shared_string_items(archive)
        strings = shared_strings(string_items)
    root = ET.fromstring(worksheet_xml)
    merged = merged_range_for_cell(root, cell_ref)
    if merged and merged[1] != cell_ref:
        raise ValueError(
            f"Excel cell {cell_ref} is inside merged range {merged[0]} but is not its anchor {merged[1]}; edit the anchor cell instead."
        )
    cell = root.find(f".//{{{SS_NS}}}c[@r='{cell_ref}']")
    if cell is None:
        raise ValueError(f"Excel cell does not exist in the source workbook: {sheet_name}!{cell_ref}")
    before = excel_cell_text(cell, strings)
    operation = intent.get("operation", "replace")
    if operation == "format":
        raise ValueError("This adapter edits exact Excel cell text only; format-only edits require a reviewed style adapter.")
    replacement = "" if operation == "delete" else str(intent.get("replacementText", ""))
    before, after, rich_text_preserved = replace_excel_cell_text(
        cell, str(intent.get("sourceText", "")), replacement, string_items
    )
    updated_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True, short_empty_elements=False)
    rewrite_zip(source, output, {sheet_part: updated_xml})
    return {
        "documentType": "excel_xlsx",
        "nativeTarget": f"{sheet_name}!{cell_ref}",
        "packagePart": sheet_part,
        "targetBefore": before,
        "targetAfter": after,
        "mergedRange": merged[0] if merged else None,
        "mergedAnchor": merged[1] if merged else None,
        "richTextRunPropertiesPreserved": rich_text_preserved,
        "layoutRisk": "targeted_cell_width_spot_check_recommended" if len(after) > len(before) else "low",
    }


def select_change_target(packet: dict, target_id: str) -> dict:
    targets = [target for target in packet.get("changeTargets", []) if target.get("contentType") == "text"]
    if target_id:
        targets = [target for target in targets if target.get("id") == target_id]
    if len(targets) != 1:
        raise ValueError(f"Expected exactly one text change target, found {len(targets)}. Use --target-id when needed.")
    target = targets[0]
    if not target.get("completeness", {}).get("complete"):
        raise ValueError(f"Mask target is incomplete: {target.get('completeness', {}).get('reason')}")
    return target


def execute(request_path: Path, source: Path, output: Path, target_id: str = "") -> dict:
    packet = json.loads(request_path.read_text(encoding="utf-8-sig"))
    if packet.get("modificationFormat") != "mingtu_multimodal_surgical_mask_correction_v1":
        raise ValueError("Request is not a MingTu multimodal surgical mask correction packet.")
    if packet.get("surgicalEditContract", {}).get("changeOnlyInsideSelectedTargets") is not True:
        raise ValueError("Surgical edit contract is missing the selected-target-only lock.")
    target = select_change_target(packet, target_id)
    intent = target.get("editIntent", {})
    document_type = intent.get("documentType")
    extension = source.suffix.lower()
    expected_type = {".docx": "word_docx", ".xlsx": "excel_xlsx"}.get(extension)
    if not expected_type:
        raise ValueError("Only .docx and .xlsx native Office files are supported by this adapter.")
    if document_type != expected_type:
        raise ValueError(f"Mask document type {document_type!r} does not match source file {extension}.")
    if not source.exists():
        raise ValueError(f"Source Office file does not exist: {source}")

    source_hash_before = sha256_file(source)
    before_parts = zip_part_hashes(source)
    result = edit_docx(source, output, intent) if extension == ".docx" else edit_xlsx(source, output, intent)
    source_hash_after = sha256_file(source)
    if source_hash_before != source_hash_after:
        raise ValueError("Original Office file changed during surgical edit; output is rejected.")
    after_parts = zip_part_hashes(output)
    changed_parts = sorted(name for name in before_parts if before_parts.get(name) != after_parts.get(name))
    added_parts = sorted(set(after_parts) - set(before_parts))
    removed_parts = sorted(set(before_parts) - set(after_parts))
    if changed_parts != [result["packagePart"]] or added_parts or removed_parts:
        raise ValueError(f"Unexpected Office package changes: changed={changed_parts}, added={added_parts}, removed={removed_parts}")

    report = {
        "format": "mingtu_surgical_office_text_edit_report_v1",
        "status": "passed_targeted_edit",
        "requestPath": str(request_path.resolve()),
        "sourcePath": str(source.resolve()),
        "outputPath": str(output.resolve()),
        "targetId": target.get("id"),
        "sourceFileSha256Before": source_hash_before,
        "sourceFileSha256After": source_hash_after,
        "outputFileSha256": sha256_file(output),
        "changedPackageParts": changed_parts,
        "unchangedPackagePartCount": len(before_parts) - len(changed_parts),
        "unexpectedAddedParts": added_parts,
        "unexpectedRemovedParts": removed_parts,
        "targetedEdit": result,
        "verification": {
            "originalFileUnchanged": True,
            "onlyExpectedNativePartChanged": True,
            "exactSourceMatchedOnce": True,
            "targetAfterMatchesRequestedReplacement": True,
            "fullDocumentRecheckRequired": False,
            "targetedVisualSpotCheckRecommended": result["layoutRisk"] != "low",
            "reviewScope": result["nativeTarget"],
        },
        "locks": {
            "accepted": False,
            "ruleEnabled": False,
            "packagingGated": True,
            "sourceOverwritten": False,
            "unselectedOfficePartsChanged": False,
        },
    }
    report_path = output.with_suffix(output.suffix + ".edit-report.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report["reportPath"] = str(report_path.resolve())
    return report


def create_test_fixtures(output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    docx_path = output_dir / "office-mask-source.docx"
    xlsx_path = output_dir / "office-mask-source.xlsx"
    complex_docx_path = output_dir / "office-mask-complex.docx"
    complex_xlsx_path = output_dir / "office-mask-complex.xlsx"
    docx_parts = {
        "[Content_Types].xml": b'''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>''',
        "_rels/.rels": b'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>''',
        "word/document.xml": f'''<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W_NS}"><w:body><w:p><w:r><w:t>项目说明</w:t></w:r></w:p><w:p><w:r><w:t>本方案将在周五提交审核。</w:t></w:r></w:p><w:p><w:r><w:t>其他段落保持不变。</w:t></w:r></w:p><w:sectPr/></w:body></w:document>'''.encode("utf-8"),
    }
    with zipfile.ZipFile(docx_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in docx_parts.items():
            archive.writestr(name, data)
    xlsx_parts = {
        "[Content_Types].xml": b'''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>''',
        "_rels/.rels": b'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>''',
        "xl/workbook.xml": f'''<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="{SS_NS}" xmlns:r="{R_NS}"><sheets><sheet name="进度表" sheetId="1" r:id="rId1"/></sheets></workbook>'''.encode("utf-8"),
        "xl/_rels/workbook.xml.rels": f'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{PKG_REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'''.encode("utf-8"),
        "xl/worksheets/sheet1.xml": f'''<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="{SS_NS}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>任务</t></is></c><c r="B1" t="inlineStr"><is><t>状态</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>包装评审</t></is></c><c r="B2" t="inlineStr"><is><t>待处理</t></is></c></row></sheetData></worksheet>'''.encode("utf-8"),
    }
    with zipfile.ZipFile(xlsx_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in xlsx_parts.items():
            archive.writestr(name, data)
    complex_docx_parts = {
        **docx_parts,
        "word/document.xml": f'''<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W_NS}"><w:body><w:p><w:r><w:t>复杂文档说明</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>审</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>核中</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>批注和其他内容保持不变。</w:t></w:r></w:p><w:sectPr/></w:body></w:document>'''.encode("utf-8"),
        "word/comments.xml": f'''<?xml version="1.0" encoding="UTF-8"?><w:comments xmlns:w="{W_NS}"><w:comment w:id="0" w:author="teacher"><w:p><w:r><w:t>保留批注</w:t></w:r></w:p></w:comment></w:comments>'''.encode("utf-8"),
        "word/styles.xml": f'''<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="{W_NS}"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>'''.encode("utf-8"),
    }
    with zipfile.ZipFile(complex_docx_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in complex_docx_parts.items():
            archive.writestr(name, data)
    complex_xlsx_parts = {
        **xlsx_parts,
        "xl/sharedStrings.xml": f'''<?xml version="1.0" encoding="UTF-8"?><sst xmlns="{SS_NS}" count="1" uniqueCount="1"><si><r><rPr><b/></rPr><t>待</t></r><r><rPr><i/></rPr><t>处理</t></r></si></sst>'''.encode("utf-8"),
        "xl/worksheets/sheet1.xml": f'''<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="{SS_NS}"><sheetData><row r="1"><c r="A1" t="s" s="1"><v>0</v></c><c r="C1"><f>SUM(1,1)</f><v>2</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells></worksheet>'''.encode("utf-8"),
        "xl/styles.xml": f'''<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="{SS_NS}"><fonts count="1"><font><sz val="11"/></font></fonts></styleSheet>'''.encode("utf-8"),
        "xl/comments1.xml": f'''<?xml version="1.0" encoding="UTF-8"?><comments xmlns="{SS_NS}"><authors><author>teacher</author></authors><commentList><comment ref="A1" authorId="0"><text><t>保留批注</t></text></comment></commentList></comments>'''.encode("utf-8"),
    }
    with zipfile.ZipFile(complex_xlsx_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in complex_xlsx_parts.items():
            archive.writestr(name, data)
    return {
        "docx": str(docx_path.resolve()),
        "xlsx": str(xlsx_path.resolve()),
        "complexDocx": str(complex_docx_path.resolve()),
        "complexXlsx": str(complex_xlsx_path.resolve()),
    }


def create_large_docx(output: Path, paragraph_count: int) -> dict:
    if paragraph_count < 100 or paragraph_count > 50000:
        raise ValueError("Large DOCX paragraph count must be between 100 and 50000.")
    target_number = paragraph_count // 2
    paragraphs = []
    for number in range(1, paragraph_count + 1):
        text = "PERFORMANCE_TARGET_OLD" if number == target_number else f"Stable paragraph {number}"
        paragraphs.append(f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>")
    document = (
        f'''<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W_NS}"><w:body>'''
        + "".join(paragraphs)
        + "<w:sectPr/></w:body></w:document>"
    ).encode("utf-8")
    parts = {
        "[Content_Types].xml": b'''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>''',
        "_rels/.rels": b'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>''',
        "word/document.xml": document,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in parts.items():
            archive.writestr(name, data)
    return {
        "format": "ai_apprentice_large_office_fixture_v1",
        "docx": str(output.resolve()),
        "paragraphCount": paragraph_count,
        "targetLocator": f"paragraph:{target_number}",
        "sourceText": "PERFORMANCE_TARGET_OLD",
        "replacementText": "PERFORMANCE_TARGET_NEW",
        "fileBytes": output.stat().st_size,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request")
    parser.add_argument("--input")
    parser.add_argument("--output")
    parser.add_argument("--target-id", default="")
    parser.add_argument("--create-test-fixtures")
    parser.add_argument("--create-large-test-fixture")
    parser.add_argument("--paragraph-count", type=int, default=5000)
    args = parser.parse_args()
    try:
        if args.create_large_test_fixture:
            result = create_large_docx(Path(args.create_large_test_fixture), args.paragraph_count)
        elif args.create_test_fixtures:
            result = {"format": "mingtu_surgical_office_test_fixtures_v1", **create_test_fixtures(Path(args.create_test_fixtures))}
        else:
            if not args.request or not args.input or not args.output:
                raise ValueError("--request, --input, and --output are required.")
            result = execute(Path(args.request), Path(args.input), Path(args.output), args.target_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:  # noqa: BLE001
        print(json.dumps({"format": "mingtu_surgical_office_text_edit_error_v1", "status": "blocked", "error": str(error)}, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main())
