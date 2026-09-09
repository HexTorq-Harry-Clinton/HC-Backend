require("dotenv").config();

const { pool, poolConnect, sql } = require("../config/db_harry_clinton");

const TYPE_MAP = {
  bigint: sql.BigInt,
  bit: sql.Bit,
  char: sql.Char,
  date: sql.Date,
  datetime: sql.DateTime,
  datetime2: sql.DateTime2,
  decimal: sql.Decimal,
  float: sql.Float,
  int: sql.Int,
  money: sql.Money,
  nchar: sql.NChar,
  numeric: sql.Decimal,
  nvarchar: sql.NVarChar,
  real: sql.Real,
  smalldatetime: sql.SmallDateTime,
  smallint: sql.SmallInt,
  smallmoney: sql.SmallMoney,
  text: sql.Text,
  time: sql.Time,
  tinyint: sql.TinyInt,
  uniqueidentifier: sql.UniqueIdentifier,
  varchar: sql.VarChar,
};

function usage() {
  return [
    "Usage:",
    "  npm run db:sp:list",
    '  npm run db:sp:describe -- dbo.sp_register_user',
    '  npm run db:sp:test -- dbo.sp_register_user "{\\"full_name\\":\\"Test\\",\\"email_id\\":\\"test@example.com\\"}"',
    "",
    "Note: db:sp:test can execute stored procedures and may change data depending on the SP.",
  ].join("\n");
}

function parseArgs() {
  const [, , command, procedureName, paramsJson] = process.argv;
  return { command, procedureName, paramsJson };
}

function normalizeProcedureName(name) {
  if (!name) return null;
  const parts = name.split(".").map((part) => part.replace(/^\[|\]$/g, ""));
  if (parts.length === 1) return { schema: "dbo", name: parts[0], fullName: parts[0] };
  return { schema: parts[0], name: parts[1], fullName: `${parts[0]}.${parts[1]}` };
}

function getType(meta) {
  const typeName = String(meta.type_name || "").replace(/\(.*/, "").toLowerCase();
  const base = TYPE_MAP[typeName] || sql.NVarChar;

  if (["varchar", "nvarchar", "char", "nchar"].includes(typeName)) {
    const max = meta.max_length < 0 ? sql.MAX : Number(meta.max_length || 255);
    return base(max);
  }

  if (["decimal", "numeric"].includes(typeName)) {
    return base(Number(meta.precision || 18), Number(meta.scale || 2));
  }

  if (typeName === "datetime2" || typeName === "time") {
    return base(Number(meta.scale || 7));
  }

  return base;
}

async function getProcedures() {
  const result = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      p.name AS procedure_name,
      p.create_date,
      p.modify_date
    FROM sys.procedures p
    INNER JOIN sys.schemas s ON s.schema_id = p.schema_id
    WHERE p.is_ms_shipped = 0
    ORDER BY s.name, p.name;
  `);
  return result.recordset;
}

async function getProcedureMeta(schemaName, procedureName) {
  const request = pool
    .request()
    .input("schema_name", sql.NVarChar(128), schemaName)
    .input("procedure_name", sql.NVarChar(128), procedureName);

  const result = await request.query(`
    SELECT
      s.name AS schema_name,
      p.name AS procedure_name,
      prm.name AS parameter_name,
      prm.parameter_id,
      prm.is_output,
      TYPE_NAME(prm.user_type_id) AS type_name,
      prm.max_length,
      prm.precision,
      prm.scale,
      sm.definition
    FROM sys.procedures p
    INNER JOIN sys.schemas s ON s.schema_id = p.schema_id
    LEFT JOIN sys.parameters prm ON prm.object_id = p.object_id
    LEFT JOIN sys.sql_modules sm ON sm.object_id = p.object_id
    WHERE s.name = @schema_name
      AND p.name = @procedure_name
    ORDER BY prm.parameter_id;
  `);
  return result.recordset;
}

async function listProcedures() {
  const rows = await getProcedures();
  console.table(rows);
}

async function describeProcedure(procedureName) {
  const proc = normalizeProcedureName(procedureName);
  if (!proc) throw new Error(usage());

  const rows = await getProcedureMeta(proc.schema, proc.name);
  if (rows.length === 0) throw new Error(`Stored procedure not found: ${proc.fullName}`);

  console.log(`Procedure: ${proc.fullName}`);
  console.table(
    rows
      .filter((row) => row.parameter_name)
      .map((row) => ({
        parameter: row.parameter_name,
        type: row.type_name,
        max_length: row.max_length,
        precision: row.precision,
        scale: row.scale,
        output: row.is_output,
      }))
  );
  console.log("\nDefinition:\n");
  console.log(rows[0].definition || "-- definition not available");
}

async function testProcedure(procedureName, paramsJson) {
  const proc = normalizeProcedureName(procedureName);
  if (!proc || !paramsJson) throw new Error(usage());

  const params = JSON.parse(paramsJson);
  const rows = await getProcedureMeta(proc.schema, proc.name);
  if (rows.length === 0) throw new Error(`Stored procedure not found: ${proc.fullName}`);

  const request = pool.request();
  for (const row of rows.filter((item) => item.parameter_name)) {
    const paramName = row.parameter_name.replace(/^@/, "");
    const dbType = getType(row);
    if (row.is_output) {
      request.output(paramName, dbType);
    } else if (Object.prototype.hasOwnProperty.call(params, paramName)) {
      request.input(paramName, dbType, params[paramName]);
    } else {
      request.input(paramName, dbType, null);
    }
  }

  const result = await request.execute(proc.fullName);
  console.log("Output parameters:");
  console.table(result.output || {});

  const recordsets = result.recordsets || (result.recordset ? [result.recordset] : []);
  recordsets.forEach((recordset, index) => {
    console.log(`\nRecordset ${index + 1}: ${recordset.length} row(s)`);
    console.table(recordset);
  });

  console.log(`Rows affected: ${(result.rowsAffected || []).join(", ") || "none"}`);
}

async function main() {
  const { command, procedureName, paramsJson } = parseArgs();
  await poolConnect;

  if (command === "list") return listProcedures();
  if (command === "describe") return describeProcedure(procedureName);
  if (command === "test") return testProcedure(procedureName, paramsJson);
  throw new Error(usage());
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
