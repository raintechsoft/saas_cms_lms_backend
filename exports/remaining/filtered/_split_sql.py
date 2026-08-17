"""Split SQL at INSERT boundaries and write chunk files for MCP import."""
import json
import sys
from pathlib import Path


def parse_statements(content: str) -> list[str]:
    lines = content.splitlines()
    statements: list[str] = []
    current: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.upper().startswith("INSERT INTO") and current:
            statements.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        statements.append("\n".join(current))
    return statements


def wrap(stmts: list[str]) -> str:
    parts = ["SET session_replication_role = replica;"]
    parts.extend(stmts)
    parts.append("SET session_replication_role = DEFAULT;")
    return "\n".join(parts)


def main():
    path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else path.parent / "_import_parts"
    out_dir.mkdir(exist_ok=True)
    content = path.read_text(encoding="utf-8")
    stmts = parse_statements(content)
    manifest = {"file": path.name, "statements": len(stmts), "parts": []}

    def write_part(label: str, part_stmts: list[str]):
        sql = wrap(part_stmts)
        part_path = out_dir / f"{path.stem}_{label}.sql"
        part_path.write_text(sql, encoding="utf-8")
        manifest["parts"].append(
            {"label": label, "statements": len(part_stmts), "path": str(part_path), "bytes": len(sql.encode("utf-8"))}
        )

    write_part("full", stmts)
    mid = len(stmts) // 2
    if mid:
        write_part("half1", stmts[:mid])
        write_part("half2", stmts[mid:])
    manifest_path = out_dir / f"{path.stem}_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
