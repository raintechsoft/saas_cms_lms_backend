"""Load SQL file and print JSON args for MCP execute_sql."""
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
query = path.read_text(encoding="utf-8")
print(json.dumps({"query": query}))
