"""Generate SQL chunks from filtered import files for MCP execution."""
import json
from pathlib import Path

BASE = Path(__file__).parent
OUT = BASE / "_chunks"
OUT.mkdir(exist_ok=True)


def parse_statements(content: str) -> list[str]:
    lines = content.splitlines()
    statements = []
    current = []
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


def wrap_chunk(stmts: list[str]) -> str:
    parts = ["SET session_replication_role = replica;"]
    parts.extend(stmts)
    parts.append("SET session_replication_role = DEFAULT;")
    return "\n".join(parts)


def split_recursive(stmts: list[str], label: str, out: list[tuple[str, str]]):
    if not stmts:
        return
    if len(stmts) == 1:
        out.append((label, wrap_chunk(stmts)))
        return
    mid = len(stmts) // 2
    split_recursive(stmts[:mid], f"{label}a", out)
    split_recursive(stmts[mid:], f"{label}b", out)


def process_file(name: str, chunk_size: int = 50):
    path = BASE / name
    content = path.read_text(encoding="utf-8")
    stmts = parse_statements(content)
    chunks = []
    for i in range(0, len(stmts), chunk_size):
        chunk_stmts = stmts[i : i + chunk_size]
        chunk_name = f"{name.replace('.sql','')}_chunk_{i//chunk_size:03d}.sql"
        chunk_sql = wrap_chunk(chunk_stmts)
        chunk_path = OUT / chunk_name
        chunk_path.write_text(chunk_sql, encoding="utf-8")
        chunks.append({
            "file": name,
            "chunk": chunk_name,
            "statements": len(chunk_stmts),
            "start_idx": i,
            "end_idx": i + len(chunk_stmts) - 1,
            "path": str(chunk_path),
        })
    return {"file": name, "total_statements": len(stmts), "chunks": chunks}


def main():
    manifest = {"files": []}
    for fname in ["filtered_001.sql", "filtered_002.sql", "filtered_003.sql"]:
        manifest["files"].append(process_file(fname, chunk_size=40))
    manifest_path = OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
