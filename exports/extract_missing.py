"""Extract remaining high-value statements from the original dump."""
from __future__ import annotations

import re
from pathlib import Path

SRC = Path(r"c:\Users\raint\OneDrive\Desktop\saas\backend\exports\supabase_data_import.sql")
OUT = Path(r"c:\Users\raint\OneDrive\Desktop\saas\backend\exports\remaining\missing")
WANTED = {
    "notification_triggers",
    "roles",
    "role_permissions",
    "message_notice_templates",
    "question_bank_difficulty_rules",
}
MAX_STRING = 40_000


def split_statements(sql: str) -> list[str]:
    stmts: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    in_single = False
    while i < n:
        ch = sql[i]
        if in_single:
            buf.append(ch)
            if ch == "'":
                if i + 1 < n and sql[i + 1] == "'":
                    buf.append(sql[i + 1])
                    i += 2
                    continue
                in_single = False
            i += 1
            continue
        if ch == "'":
            in_single = True
            buf.append(ch)
            i += 1
            continue
        if ch == ";":
            buf.append(ch)
            stmt = "".join(buf).strip()
            if stmt:
                stmts.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    return stmts


def shrink_literals(stmt: str) -> str:
    out: list[str] = []
    i = 0
    n = len(stmt)
    while i < n:
        ch = stmt[i]
        if ch != "'":
            out.append(ch)
            i += 1
            continue
        j = i + 1
        chars: list[str] = []
        while j < n:
            if stmt[j] == "'":
                if j + 1 < n and stmt[j + 1] == "'":
                    chars.append("'")
                    j += 2
                    continue
                break
            chars.append(stmt[j])
            j += 1
        literal = "".join(chars)
        if len(literal) > MAX_STRING:
            out.append("NULL")
        else:
            out.append("'" + literal.replace("'", "''") + "'")
        i = j + 1 if j < n else n
    return "".join(out)


def main() -> None:
    stmts = split_statements(SRC.read_text(encoding="utf-8-sig"))
    by_table: dict[str, list[str]] = {t: [] for t in WANTED}
    for stmt in stmts:
        m = re.search(r"INSERT INTO public\.([a-z0-9_]+)", stmt, re.I)
        if not m:
            continue
        table = m.group(1)
        if table not in WANTED:
            continue
        ready = shrink_literals(stmt)
        if ready.endswith(";"):
            ready = ready[:-1].rstrip() + " ON CONFLICT DO NOTHING;"
        else:
            ready = ready.rstrip() + " ON CONFLICT DO NOTHING;"
        by_table[table].append(ready)

    OUT.mkdir(parents=True, exist_ok=True)
    for table, rows in by_table.items():
        path = OUT / f"{table}.sql"
        body = "SET session_replication_role = replica;\n" + "\n".join(rows) + "\nSET session_replication_role = DEFAULT;\n"
        path.write_text(body, encoding="utf-8")
        print(f"{table}: {len(rows)} stmts bytes={path.stat().st_size}")


if __name__ == "__main__":
    main()
