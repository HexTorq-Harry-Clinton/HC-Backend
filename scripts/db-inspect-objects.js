require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool, poolConnect, sql } = require("../config/db_harry_clinton");

const OUT_DIR = path.join(process.cwd(), "db-snapshots");
const JSON_OUT = path.join(OUT_DIR, "latest-db-objects.json");
const MD_OUT = path.join(OUT_DIR, "latest-db-objects.md");

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toISOString();
  } catch {
    return String(value);
  }
};

const fence = (value, lang = "sql") => {
  const body = value ? String(value).trim() : "-- definition not available";
  return `\`\`\`${lang}\n${body}\n\`\`\``;
};

const groupBy = (rows, keyFn) => {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
};

async function queryDatabase() {
  await poolConnect;

  const request = pool.request();

  const schemas = await request.query(`
    SELECT
      name AS schema_name,
      schema_id
    FROM sys.schemas
    WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA')
    ORDER BY name;
  `);

  const objects = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      o.name AS object_name,
      o.type AS object_type,
      o.type_desc,
      o.create_date,
      o.modify_date,
      sm.definition
    FROM sys.objects o
    INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
    LEFT JOIN sys.sql_modules sm ON sm.object_id = o.object_id
    WHERE o.is_ms_shipped = 0
      AND o.type IN ('V', 'P', 'FN', 'IF', 'TF', 'TR')
    ORDER BY s.name, o.type_desc, o.name;
  `);

  const indexes = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      i.name AS index_name,
      i.type_desc,
      i.is_unique,
      i.is_primary_key,
      i.is_unique_constraint,
      ic.key_ordinal,
      ic.is_included_column,
      c.name AS column_name
    FROM sys.indexes i
    INNER JOIN sys.tables t ON t.object_id = i.object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    LEFT JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    LEFT JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.name IS NOT NULL
      AND t.is_ms_shipped = 0
    ORDER BY s.name, t.name, i.name, ic.key_ordinal, ic.index_column_id;
  `);

  const columns = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      c.column_id,
      c.name AS column_name,
      ty.name AS data_type,
      c.max_length,
      c.precision,
      c.scale,
      c.is_nullable,
      c.is_identity,
      dc.definition AS default_definition
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    INNER JOIN sys.columns c ON c.object_id = t.object_id
    INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.default_constraints dc
      ON dc.parent_object_id = t.object_id
     AND dc.parent_column_id = c.column_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, c.column_id;
  `);

  const constraints = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      kc.name AS constraint_name,
      kc.type_desc AS constraint_type,
      ic.key_ordinal,
      c.name AS column_name
    FROM sys.key_constraints kc
    INNER JOIN sys.tables t ON t.object_id = kc.parent_object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    INNER JOIN sys.index_columns ic
      ON ic.object_id = kc.parent_object_id
     AND ic.index_id = kc.unique_index_id
    INNER JOIN sys.columns c
      ON c.object_id = ic.object_id
     AND c.column_id = ic.column_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, kc.name, ic.key_ordinal;
  `);

  const foreignKeys = await pool.request().query(`
    SELECT
      fk.name AS foreign_key_name,
      parent_schema.name AS parent_schema,
      parent_table.name AS parent_table,
      parent_col.name AS parent_column,
      ref_schema.name AS referenced_schema,
      ref_table.name AS referenced_table,
      ref_col.name AS referenced_column,
      fk.delete_referential_action_desc,
      fk.update_referential_action_desc,
      fkc.constraint_column_id
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.tables parent_table ON parent_table.object_id = fk.parent_object_id
    INNER JOIN sys.schemas parent_schema ON parent_schema.schema_id = parent_table.schema_id
    INNER JOIN sys.columns parent_col
      ON parent_col.object_id = parent_table.object_id
     AND parent_col.column_id = fkc.parent_column_id
    INNER JOIN sys.tables ref_table ON ref_table.object_id = fk.referenced_object_id
    INNER JOIN sys.schemas ref_schema ON ref_schema.schema_id = ref_table.schema_id
    INNER JOIN sys.columns ref_col
      ON ref_col.object_id = ref_table.object_id
     AND ref_col.column_id = fkc.referenced_column_id
    WHERE parent_table.is_ms_shipped = 0
    ORDER BY parent_schema.name, parent_table.name, fk.name, fkc.constraint_column_id;
  `);

  const rowCounts = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      SUM(p.rows) AS row_count
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    INNER JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    WHERE t.is_ms_shipped = 0
    GROUP BY s.name, t.name
    ORDER BY s.name, t.name;
  `);

  return {
    generated_at: new Date().toISOString(),
    database: process.env.DB_HARRY_CLINTON_NAME || null,
    schemas: schemas.recordset,
    objects: objects.recordset,
    columns: columns.recordset,
    constraints: constraints.recordset,
    indexes: indexes.recordset,
    foreign_keys: foreignKeys.recordset,
    row_counts: rowCounts.recordset,
  };
}

function buildMarkdown(snapshot) {
  const objectsByType = groupBy(snapshot.objects, (row) => row.type_desc);
  const columnsByTable = groupBy(snapshot.columns, (row) => `${row.schema_name}.${row.table_name}`);
  const constraintsByTable = groupBy(snapshot.constraints, (row) => `${row.schema_name}.${row.table_name}`);
  const indexesByTable = groupBy(snapshot.indexes, (row) => `${row.schema_name}.${row.table_name}`);
  const fksByTable = groupBy(snapshot.foreign_keys, (row) => `${row.parent_schema}.${row.parent_table}`);

  const lines = [];
  lines.push("# Live MSSQL Object Snapshot");
  lines.push("");
  lines.push(`Generated: ${snapshot.generated_at}`);
  lines.push(`Database: ${snapshot.database || "(from current connection)"}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Schemas: ${snapshot.schemas.length}`);
  lines.push(`- Views: ${(objectsByType.get("VIEW") || []).length}`);
  lines.push(`- Stored procedures: ${(objectsByType.get("SQL_STORED_PROCEDURE") || []).length}`);
  lines.push(`- Scalar functions: ${(objectsByType.get("SQL_SCALAR_FUNCTION") || []).length}`);
  lines.push(`- Inline table functions: ${(objectsByType.get("SQL_INLINE_TABLE_VALUED_FUNCTION") || []).length}`);
  lines.push(`- Table functions: ${(objectsByType.get("SQL_TABLE_VALUED_FUNCTION") || []).length}`);
  lines.push(`- Triggers: ${(objectsByType.get("SQL_TRIGGER") || []).length}`);
  lines.push(`- Tables: ${columnsByTable.size}`);
  lines.push(`- Column rows: ${snapshot.columns.length}`);
  lines.push(`- Key constraint rows: ${snapshot.constraints.length}`);
  lines.push(`- Index column rows: ${snapshot.indexes.length}`);
  lines.push(`- Foreign key column rows: ${snapshot.foreign_keys.length}`);
  lines.push("");

  lines.push("## Schemas");
  lines.push("");
  for (const schema of snapshot.schemas) {
    lines.push(`- ${schema.schema_name}`);
  }
  lines.push("");

  lines.push("## Row Counts");
  lines.push("");
  lines.push("| Table | Rows |");
  lines.push("|---|---:|");
  for (const row of snapshot.row_counts) {
    lines.push(`| ${row.schema_name}.${row.table_name} | ${row.row_count || 0} |`);
  }
  lines.push("");

  lines.push("## Tables and Columns");
  lines.push("");
  for (const [tableName, rows] of columnsByTable) {
    lines.push(`### ${tableName}`);
    lines.push("");
    lines.push("| Column | Type | Nullable | Identity | Default |");
    lines.push("|---|---|---:|---:|---|");
    for (const row of rows) {
      const typeSuffix = ["varchar", "nvarchar", "char", "nchar", "binary", "varbinary"].includes(row.data_type)
        ? `(${row.max_length === -1 ? "max" : row.max_length})`
        : ["decimal", "numeric"].includes(row.data_type)
          ? `(${row.precision},${row.scale})`
          : "";
      lines.push(`| ${row.column_name} | ${row.data_type}${typeSuffix} | ${row.is_nullable ? "yes" : "no"} | ${row.is_identity ? "yes" : "no"} | ${row.default_definition || ""} |`);
    }
    const constraints = constraintsByTable.get(tableName) || [];
    if (constraints.length > 0) {
      const byConstraint = groupBy(constraints, (row) => row.constraint_name);
      lines.push("");
      lines.push("| Constraint | Type | Columns |");
      lines.push("|---|---|---|");
      for (const [constraintName, constraintRows] of byConstraint) {
        const ordered = constraintRows.sort((a, b) => a.key_ordinal - b.key_ordinal);
        lines.push(`| ${constraintName} | ${ordered[0].constraint_type} | ${ordered.map((row) => row.column_name).join(", ")} |`);
      }
    }
    lines.push("");
  }

  lines.push("## Indexes");
  lines.push("");
  for (const [tableName, rows] of indexesByTable) {
    lines.push(`### ${tableName}`);
    const byIndex = groupBy(rows, (row) => row.index_name);
    lines.push("");
    lines.push("| Index | Type | Unique | Primary | Columns | Included |");
    lines.push("|---|---|---:|---:|---|---|");
    for (const [indexName, indexRows] of byIndex) {
      const first = indexRows[0];
      const keys = indexRows
        .filter((row) => row.column_name && !row.is_included_column)
        .sort((a, b) => a.key_ordinal - b.key_ordinal)
        .map((row) => row.column_name)
        .join(", ");
      const included = indexRows
        .filter((row) => row.column_name && row.is_included_column)
        .map((row) => row.column_name)
        .join(", ");
      lines.push(`| ${indexName} | ${first.type_desc} | ${first.is_unique ? "yes" : "no"} | ${first.is_primary_key ? "yes" : "no"} | ${keys} | ${included} |`);
    }
    lines.push("");
  }

  lines.push("## Foreign Keys");
  lines.push("");
  for (const [tableName, rows] of fksByTable) {
    lines.push(`### ${tableName}`);
    const byFk = groupBy(rows, (row) => row.foreign_key_name);
    lines.push("");
    lines.push("| Foreign Key | Columns | References | On Delete | On Update |");
    lines.push("|---|---|---|---|---|");
    for (const [fkName, fkRows] of byFk) {
      const ordered = fkRows.sort((a, b) => a.constraint_column_id - b.constraint_column_id);
      const columns = ordered.map((row) => row.parent_column).join(", ");
      const referenced = `${ordered[0].referenced_schema}.${ordered[0].referenced_table}(${ordered.map((row) => row.referenced_column).join(", ")})`;
      lines.push(`| ${fkName} | ${columns} | ${referenced} | ${ordered[0].delete_referential_action_desc} | ${ordered[0].update_referential_action_desc} |`);
    }
    lines.push("");
  }

  const typeSections = [
    ["VIEW", "Views"],
    ["SQL_STORED_PROCEDURE", "Stored Procedures"],
    ["SQL_SCALAR_FUNCTION", "Scalar Functions"],
    ["SQL_INLINE_TABLE_VALUED_FUNCTION", "Inline Table-Valued Functions"],
    ["SQL_TABLE_VALUED_FUNCTION", "Table-Valued Functions"],
    ["SQL_TRIGGER", "Triggers"],
  ];

  for (const [type, title] of typeSections) {
    const rows = objectsByType.get(type) || [];
    lines.push(`## ${title}`);
    lines.push("");
    if (rows.length === 0) {
      lines.push("_None found._");
      lines.push("");
      continue;
    }
    for (const row of rows) {
      lines.push(`### ${row.schema_name}.${row.object_name}`);
      lines.push("");
      lines.push(`Created: ${formatDate(row.create_date)}`);
      lines.push(`Modified: ${formatDate(row.modify_date)}`);
      lines.push("");
      lines.push(fence(row.definition));
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const snapshot = await queryDatabase();
  fs.writeFileSync(JSON_OUT, JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(MD_OUT, buildMarkdown(snapshot));
  console.log(`Wrote ${JSON_OUT}`);
  console.log(`Wrote ${MD_OUT}`);
  console.log(`Objects: ${snapshot.objects.length}, tables: ${groupBy(snapshot.columns, (row) => `${row.schema_name}.${row.table_name}`).size}, columns: ${snapshot.columns.length}, indexes rows: ${snapshot.indexes.length}, FK rows: ${snapshot.foreign_keys.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sql.close();
    } catch {
      // ignore close errors
    }
  });
