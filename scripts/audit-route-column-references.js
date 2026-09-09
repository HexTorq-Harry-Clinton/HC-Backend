const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(ROOT, 'routes', 'HARRY_CLINTON');
const SNAPSHOT_PATH = path.join(ROOT, 'db-snapshots', 'latest-db-objects.json');
const REPORT_JSON = path.join(ROOT, 'reports', 'route-column-audit-latest.json');
const REPORT_MD = path.join(ROOT, 'reports', 'route-column-audit-latest.md');

const SQL_KEYWORDS = new Set([
  'and', 'as', 'asc', 'begin', 'between', 'by', 'case', 'cast', 'count', 'dateadd', 'day',
  'declare', 'desc', 'distinct', 'else', 'end', 'exists', 'from', 'getdate', 'getutcdate',
  'group', 'having', 'in', 'inner', 'inserted', 'into', 'is', 'join', 'left', 'like',
  'minute', 'not', 'null', 'on', 'or', 'order', 'outer', 'output', 'right', 'select',
  'set', 'then', 'top', 'update', 'values', 'when', 'where', 'with'
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

function normalizeIdentifier(value) {
  return String(value || '')
    .replace(/^\[|\]$/g, '')
    .trim()
    .toLowerCase();
}

function normalizeTable(value) {
  const clean = String(value || '').replace(/\[|\]/g, '').trim().toLowerCase();
  if (!clean) return clean;
  return clean.includes('.') ? clean : `dbo.${clean}`;
}

function parseStringArray(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm'));
  if (!match) return [];
  const fields = [];
  const fieldRe = /['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]/g;
  let fieldMatch;
  while ((fieldMatch = fieldRe.exec(match[1]))) fields.push(fieldMatch[1]);
  return fields;
}

function parseObjectKeys(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`, 'm'));
  if (!match) return [];
  const keys = [];
  const keyRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm;
  let keyMatch;
  while ((keyMatch = keyRe.exec(match[1]))) keys.push(keyMatch[1]);
  return keys;
}

function parseConstants(source) {
  const constants = {};
  const constRe = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*['"`]([^'"`]+)['"`]\s*;/g;
  let match;
  while ((match = constRe.exec(source))) constants[match[1]] = match[2];
  return constants;
}

function extractSqlFragments(source, constants) {
  const fragments = [];
  const queryRe = /\.(?:query|batch)\s*\(\s*(`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\s*\)/g;
  let match;
  while ((match = queryRe.exec(source))) {
    let sql = match[1].slice(1, -1);
    for (const [name, value] of Object.entries(constants)) {
      sql = sql.replace(new RegExp(`\\$\\{\\s*${name}\\s*\\}`, 'g'), value);
    }
    sql = sql
      .replace(/\$\{\s*where\.join\([^)]*\)\s*\}/g, '')
      .replace(/\$\{\s*setClause\s*\}/g, '')
      .replace(/\$\{\s*cols\.join\([^)]*\)\s*\}/g, '')
      .replace(/\$\{\s*placeholders\.join\([^)]*\)\s*\}/g, '')
      .replace(/\$\{[^}]+\}/g, '');
    fragments.push(sql);
  }
  return fragments;
}

function extractTableAliases(sql) {
  const aliases = new Map();
  const tables = [];
  const tableRe = /\b(?:from|join|update|into|delete\s+from)\s+((?:\[?dbo\]?\.)?\[?tbl_[A-Za-z0-9_]+\]?)(?:\s+(?:as\s+)?([A-Za-z_][A-Za-z0-9_]*))?/gi;
  let match;
  while ((match = tableRe.exec(sql))) {
    const table = normalizeTable(match[1]);
    tables.push(table);
    const alias = match[2] && !SQL_KEYWORDS.has(match[2].toLowerCase()) ? match[2].toLowerCase() : null;
    if (alias) aliases.set(alias, table);
    aliases.set(table.split('.').pop(), table);
  }
  return { aliases, tables };
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function addIssue(issues, issue) {
  issues.push(issue);
}

function columnExists(schema, table, column) {
  const columns = schema.get(normalizeTable(table));
  return Boolean(columns && columns.has(normalizeIdentifier(column)));
}

function columnExistsAnywhere(schema, tables, column) {
  const uniqueTables = [...new Set(tables.map(normalizeTable))];
  return uniqueTables.some((table) => columnExists(schema, table, column));
}

function validateSqlColumns({ file, source, sql, offset, schema, issues }) {
  const { aliases, tables } = extractTableAliases(sql);
  const knownTables = tables.filter((table) => schema.has(table));
  const unknownTables = tables.filter((table) => !schema.has(table));

  unknownTables.forEach((table) => {
    addIssue(issues, {
      severity: 'error',
      type: 'unknown_table',
      file,
      line: lineForOffset(source, offset),
      table,
      detail: `Table ${table} is referenced in SQL but is not present in the live schema snapshot.`
    });
  });

  const aliasColRe = /\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let match;
  while ((match = aliasColRe.exec(sql))) {
    const alias = match[1].toLowerCase();
    const column = match[2];
    if (alias === 'dbo' || alias === 'inserted' || alias === 'deleted') continue;
    const table = aliases.get(alias);
    if (table && schema.has(table) && !columnExists(schema, table, column)) {
      addIssue(issues, {
        severity: 'error',
        type: 'unknown_column',
        file,
        line: lineForOffset(source, offset),
        table,
        column,
        detail: `${alias}.${column} does not exist on ${table}.`
      });
    }
  }

  if (knownTables.length === 0) return;

  const simpleColumnRe = /\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:=|<>|!=|<|>|<=|>=|\blike\b|\bin\b|\bis\b)/gi;
  while ((match = simpleColumnRe.exec(sql))) {
    const column = match[1];
    const lower = column.toLowerCase();
    if (SQL_KEYWORDS.has(lower) || lower.startsWith('@')) continue;
    if (!columnExistsAnywhere(schema, knownTables, column)) {
      addIssue(issues, {
        severity: 'warning',
        type: 'ambiguous_or_unknown_column',
        file,
        line: lineForOffset(source, offset),
        table: knownTables.join(', '),
        column,
        detail: `${column} is used unqualified and was not found in the referenced table set.`
      });
    }
  }

  const orderRe = /\border\s+by\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+asc|\s+desc|[\s;]|$)/gi;
  while ((match = orderRe.exec(sql))) {
    const column = match[1];
    if (!SQL_KEYWORDS.has(column.toLowerCase()) && !columnExistsAnywhere(schema, knownTables, column)) {
      addIssue(issues, {
        severity: 'warning',
        type: 'ambiguous_or_unknown_column',
        file,
        line: lineForOffset(source, offset),
        table: knownTables.join(', '),
        column,
        detail: `${column} is used in ORDER BY and was not found in the referenced table set.`
      });
    }
  }
}

function main() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const schema = new Map();
  for (const column of snapshot.columns || []) {
    const table = normalizeTable(`${column.schema_name}.${column.table_name}`);
    if (!schema.has(table)) schema.set(table, new Set());
    schema.get(table).add(normalizeIdentifier(column.column_name));
  }

  const routeFiles = walk(ROUTES_DIR);
  const issues = [];
  const fileSummaries = [];

  for (const absoluteFile of routeFiles) {
    const relativeFile = path.relative(ROOT, absoluteFile).replace(/\\/g, '/');
    const source = fs.readFileSync(absoluteFile, 'utf8');
    const constants = parseConstants(source);
    const sqlFragments = extractSqlFragments(source, constants);
    const allSql = sqlFragments.join('\n');
    const sqlTables = [...new Set(extractTableAliases(allSql).tables)];
    const primaryTable = normalizeTable(constants.TABLE_NAME || sqlTables[0] || '');

    const insertFields = parseStringArray(source, 'INSERT_FIELDS');
    const updateFields = parseStringArray(source, 'UPDATE_FIELDS');
    const fieldTypes = parseObjectKeys(source, 'FIELD_TYPES');

    if (primaryTable && !schema.has(primaryTable)) {
      addIssue(issues, {
        severity: 'error',
        type: 'unknown_primary_table',
        file: relativeFile,
        line: 1,
        table: primaryTable,
        detail: `Primary route table ${primaryTable} is not present in the live schema snapshot.`
      });
    }

    for (const field of [...insertFields, ...updateFields]) {
      if (primaryTable && schema.has(primaryTable) && !columnExists(schema, primaryTable, field)) {
        addIssue(issues, {
          severity: 'error',
          type: 'field_array_unknown_column',
          file: relativeFile,
          line: lineForOffset(source, source.indexOf(field)),
          table: primaryTable,
          column: field,
          detail: `${field} appears in INSERT_FIELDS/UPDATE_FIELDS but does not exist on ${primaryTable}.`
        });
      }
    }

    for (const field of fieldTypes) {
      if (primaryTable && schema.has(primaryTable) && !columnExists(schema, primaryTable, field)) {
        addIssue(issues, {
          severity: 'warning',
          type: 'field_type_not_on_primary_table',
          file: relativeFile,
          line: lineForOffset(source, source.indexOf(`${field}:`)),
          table: primaryTable,
          column: field,
          detail: `${field} appears in FIELD_TYPES but not on primary table ${primaryTable}; this may be a joined/filter/input-only field.`
        });
      }
    }

    let searchOffset = 0;
    for (const sql of sqlFragments) {
      const offset = source.indexOf(sql.trim().split(/\r?\n/)[0].trim(), searchOffset);
      validateSqlColumns({
        file: relativeFile,
        source,
        sql,
        offset: offset >= 0 ? offset : 0,
        schema,
        issues
      });
      if (offset >= 0) searchOffset = offset + sql.length;
    }

    fileSummaries.push({
      file: relativeFile,
      primaryTable,
      referencedTables: sqlTables,
      insertFieldCount: insertFields.length,
      updateFieldCount: updateFields.length,
      fieldTypeCount: fieldTypes.length,
      sqlFragmentCount: sqlFragments.length
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    route_dir: path.relative(ROOT, ROUTES_DIR).replace(/\\/g, '/'),
    route_js_files_checked: routeFiles.length,
    live_tables_loaded: schema.size,
    live_columns_loaded: [...schema.values()].reduce((sum, columns) => sum + columns.size, 0),
    issue_count: issues.length,
    error_count: issues.filter((issue) => issue.severity === 'error').length,
    warning_count: issues.filter((issue) => issue.severity === 'warning').length
  };

  const report = { summary, issues, files: fileSummaries };
  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  const md = [
    '# Route Column Audit',
    '',
    `Generated: ${summary.generated_at}`,
    `Route JS files checked: ${summary.route_js_files_checked}`,
    `Live tables loaded: ${summary.live_tables_loaded}`,
    `Live columns loaded: ${summary.live_columns_loaded}`,
    `Errors: ${summary.error_count}`,
    `Warnings: ${summary.warning_count}`,
    '',
    '## Issues',
    '',
    issues.length
      ? issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.file}:${issue.line} ${issue.type} ${issue.table || ''} ${issue.column || ''} - ${issue.detail}`).join('\n')
      : 'No table/column reference issues found by the static audit.',
    ''
  ].join('\n');
  fs.writeFileSync(REPORT_MD, md);

  console.log(JSON.stringify(summary, null, 2));
  if (summary.error_count > 0) process.exitCode = 1;
}

main();
