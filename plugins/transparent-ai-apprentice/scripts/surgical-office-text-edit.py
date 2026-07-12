#!/usr/bin/env python3
"""Apply one teacher-confirmed Word or Excel text edit without rewriting the whole artifact."""

from __future__ import annotations

import argparse
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
    match = re.fullmatch(r"paragraph:(\d+)", locator, flags=re.IGNORECASE)
    if not match:
        raise ValueError("Word locator must use paragraph:N with a 1-based paragraph number.")
    paragraph_number = int(match.group(1))
    with zipfile.ZipFile(source, "r") as archive:
        document_xml = archive.read("word/document.xml")
    root = ET.fromstring(document_xml)
    paragraphs = root.findall(f".//{{{W_NS}}}p")
    if paragraph_number < 1 or paragraph_number > len(paragraphs):
        raise ValueError(f"Word paragraph {paragraph_number} is outside 1..{len(paragraphs)}.")
    paragraph = paragraphs[paragraph_number - 1]
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
        "layoutRisk": "low" if "\n" not in replacement and len(replacement) <= len(str(intent.get("sourceText", ""))) else "targeted_visual_spot_check_recommended",
    }


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.findall(f".//{{{SS_NS}}}t")) for item in root.findall(f"{{{SS_NS}}}si")]


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
        strings = shared_strings(archive)
    root = ET.fromstring(worksheet_xml)
    cell = root.find(f".//{{{SS_NS}}}c[@r='{cell_ref}']")
    if cell is None:
        raise ValueError(f"Excel cell does not exist in the source workbook: {sheet_name}!{cell_ref}")
    before = excel_cell_text(cell, strings)
    operation = intent.get("operation", "replace")
    if operation == "format":
        raise ValueError("This adapter edits exact Excel cell text only; format-only edits require a reviewed style adapter.")
    replacement = "" if operation == "delete" else str(intent.get("replacementText", ""))
    after, _, _ = unique_replace(before, str(intent.get("sourceText", "")), replacement)
    set_excel_inline_text(cell, after)
    updated_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True, short_empty_elements=False)
    rewrite_zip(source, output, {sheet_part: updated_xml})
    return {
        "documentType": "excel_xlsx",
        "nativeTarget": f"{sheet_name}!{cell_ref}",
        "packagePart": sheet_part,
        "targetBefore": before,
        "targetAfter": after,
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
    return {"docx": str(docx_path.resolve()), "xlsx": str(xlsx_path.resolve())}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request")
    parser.add_argument("--input")
    parser.add_argument("--output")
    parser.add_argument("--target-id", default="")
    parser.add_argument("--create-test-fixtures")
    args = parser.parse_args()
    try:
        if args.create_test_fixtures:
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
