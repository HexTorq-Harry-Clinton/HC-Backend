require("dotenv").config();

const { pool, poolConnect, sql } = require("../config/db_harry_clinton");

const MAX_ROWS = 200;

function getSqlArg() {
  const joined = process.argv.slice(2).join(" ").trim();
  if (!joined) {
    throw new Error('Usage: npm run db:query -- "SELECT TOP 20 * FROM dbo.tbl_products"');
  }
  return joined;
}

function stripComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
}

function assertSafeReadOnly(query) {
  const cleaned = stripComments(query).trim();
  const lower = cleaned.toLowerCase();

  const allowedStart =
    lower.startsWith("select ") ||
    lower.startsWith("with ") ||
    lower.startsWith("exec sp_help") ||
    lower.startsWith("execute sp_help") ||
    lower.startsWith("exec sys.sp_help") ||
    lower.startsWith("execute sys.sp_help");

  if (!allowedStart) {
    throw new Error("Only SELECT/WITH queries and sp_help-style metadata calls are allowed by db:query.");
  }

  const blocked = [
    " insert ",
    " update ",
    " delete ",
    " merge ",
    " drop ",
    " alter ",
    " create ",
    " truncate ",
    " grant ",
    " revoke ",
    " deny ",
    " backup ",
    " restore ",
    " shutdown",
    " xp_cmdshell",
    " sp_configure",
  ];

  const padded = ` ${lower.replace(/\s+/g, " ")} `;
  const found = blocked.find((token) => padded.includes(token));
  if (found) {
    throw new Error(`Blocked unsafe SQL token:${found}`);
  }
}

function normalizeRecordset(rows) {
  return rows.slice(0, MAX_ROWS).map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      if (Buffer.isBuffer(value)) out[key] = `<Buffer ${value.length} bytes>`;
      else out[key] = value;
    }
    return out;
  });
}

async function main() {
  const query = getSqlArg();
  assertSafeReadOnly(query);

  await poolConnect;
  const result = await pool.request().query(query);

  const recordsets = result.recordsets || (result.recordset ? [result.recordset] : []);
  if (recordsets.length === 0) {
    console.log("No recordsets returned.");
    return;
  }

  recordsets.forEach((rows, index) => {
    console.log(`\nRecordset ${index + 1}: ${rows.length} row(s)`);
    console.table(normalizeRecordset(rows));
    if (rows.length > MAX_ROWS) {
      console.log(`Shown first ${MAX_ROWS} rows only.`);
    }
  });
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sql.close();
    } catch {
      // ignore close errors
    }
  });
