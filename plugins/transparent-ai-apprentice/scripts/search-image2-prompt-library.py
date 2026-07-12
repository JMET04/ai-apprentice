import argparse
import os
import sqlite3
import sys
from pathlib import Path


DEFAULT_ROOT = Path(r"D:\image2专业提示词库")


def library_root() -> Path:
    env_root = os.environ.get("IMAGE2_PROMPT_LIBRARY")
    return Path(env_root) if env_root else DEFAULT_ROOT


def build_filters(args, alias: str):
    where = []
    params = []
    for field, column in (("category", "category"), ("source", "source"), ("quality", "quality_tier"), ("risk", "risk_tag")):
        value = getattr(args, field)
        if value:
            where.append(f"{alias}.{column} = ?")
            params.append(value)
    return where, params


def search(conn: sqlite3.Connection, args):
    filters, filter_params = build_filters(args, "p")
    sql = f"""
        SELECT p.id, p.category, p.source, p.quality_tier, p.risk_tag, p.title,
               substr(replace(replace(p.prompt, char(10), ' '), char(13), ' '), 1, 360)
        FROM prompts_fts
        JOIN prompts p ON p.id = prompts_fts.id
        WHERE {' AND '.join(['prompts_fts MATCH ?', *filters])}
        LIMIT ?
    """
    try:
        rows = conn.execute(sql, [args.query, *filter_params, args.limit]).fetchall()
    except sqlite3.OperationalError:
        rows = []
    if rows:
        return rows
    like = f"%{args.query}%"
    sql = f"""
        SELECT p.id, p.category, p.source, p.quality_tier, p.risk_tag, p.title,
               substr(replace(replace(p.prompt, char(10), ' '), char(13), ' '), 1, 360)
        FROM prompts p
        WHERE {' AND '.join(['(p.title LIKE ? OR p.prompt LIKE ? OR p.notes LIKE ?)', *filters])}
        LIMIT ?
    """
    return conn.execute(sql, [like, like, like, *filter_params, args.limit]).fetchall()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Search the optional local Image2 professional prompt library.")
    parser.add_argument("query")
    parser.add_argument("--root", default=str(library_root()))
    parser.add_argument("--category", default="")
    parser.add_argument("--source", default="")
    parser.add_argument("--quality", default="")
    parser.add_argument("--risk", default="")
    parser.add_argument("--limit", type=int, default=8)
    args = parser.parse_args()
    db = Path(args.root) / "crawled_data" / "processed" / "prompt_library.sqlite"
    if not db.exists():
        print(f"Optional prompt index missing: {db}", file=sys.stderr)
        return 2
    with sqlite3.connect(db) as conn:
        rows = search(conn, args)
    for row in rows:
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]}")
        print(f"Title: {row[5]}")
        print(f"Preview: {row[6]}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
