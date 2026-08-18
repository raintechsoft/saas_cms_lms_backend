"""Extract complete INSERT statements and write valid-only chunks."""
import json
import re
from pathlib import Path

BASE = Path(__file__).parent
SRC = BASE / "filtered_001.sql"
OUT = BASE / "_import_parts"
OUT.mkdir(exist_ok=True)

content = SRC.read_text(encoding="utf-8")
lines = content.splitlines()
valid = []
for line in lines:
    s = line.strip()
    if s.upper().startswith("INSERT INTO") and s.endswith("ON CONFLICT DO NOTHING;"):
        valid.append(s)

def wrap(stmts):
    return "\n".join(["SET session_replication_role = replica;", *stmts, "SET session_replication_role = DEFAULT;"])

chunk_size = 25
chunks = []
for i in range(0, len(valid), chunk_size):
    chunk = valid[i : i + chunk_size]
    name = f"filtered_001_valid_{i//chunk_size:03d}.sql"
    path = OUT / name
    path.write_text(wrap(chunk), encoding="utf-8")
    chunks.append({"file": name, "statements": len(chunk), "path": str(path)})

manifest = {"source": str(SRC), "valid_statements": len(valid), "chunks": chunks}
(OUT / "filtered_001_valid_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest, indent=2))
