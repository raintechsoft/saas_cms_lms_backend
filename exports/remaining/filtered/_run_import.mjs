import fs from 'fs';
import path from 'path';

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const files = ['filtered_004.sql', 'filtered_005.sql', 'filtered_006.sql'];

function splitAtInsertBoundaries(sql) {
  const lines = sql.split(/\r?\n/);
  const inserts = [];
  let preamble = [];
  let postamble = [];
  let inInserts = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('INSERT INTO')) {
      inInserts = true;
      inserts.push(line);
    } else if (inInserts && trimmed.startsWith('SET session_replication_role = DEFAULT')) {
      postamble.push(line);
      inInserts = false;
    } else if (!inInserts && trimmed.startsWith('SET session_replication_role = replica')) {
      preamble.push(line);
    } else if (inInserts) {
      inserts.push(line);
    } else if (postamble.length) {
      postamble.push(line);
    } else if (preamble.length) {
      preamble.push(line);
    }
  }
  return { preamble, inserts, postamble };
}

function buildSql(preamble, insertLines, postamble) {
  const parts = [];
  if (preamble.length) parts.push(...preamble);
  if (insertLines.length) parts.push(...insertLines);
  if (postamble.length) parts.push(...postamble);
  return parts.join('\n');
}

function halveInserts(inserts) {
  const mid = Math.floor(inserts.length / 2);
  if (mid === 0) return [inserts, []];
  return [inserts.slice(0, mid), inserts.slice(mid)];
}

for (const file of files) {
  const fullPath = path.join(dir, file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  const outPath = path.join(dir, `_payload_${file.replace('.sql', '')}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ file, query: sql }));
  console.log(`WROTE ${outPath} (${sql.length} chars)`);
}
