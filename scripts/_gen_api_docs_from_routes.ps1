$ErrorActionPreference='Stop'
$src='D:/2026/Harry-Clinton/HC-BACKEND/reports/route-files-endpoints-source-20260414.json'
$items=Get-Content -Raw -Path $src | ConvertFrom-Json

$level1='D:/2026/Harry-Clinton/HC-BACKEND/reports/API-Level-1-Module-Endpoint-Index-20260414.md'
$level2='D:/2026/Harry-Clinton/HC-BACKEND/reports/API-Level-2-Endpoint-Contracts-20260414.md'

function Get-ShortDesc($method,$sub){
  switch($method){
    'GET' { if($sub -eq '/'){'Fetch list records'} else {'Fetch one record by id'} }
    'POST' { 'Create a new record' }
    'PUT' { 'Update an existing record' }
    'PATCH' { 'Partially update an existing record' }
    'DELETE' { 'Delete or soft-delete a record' }
    default { 'Operation endpoint' }
  }
}

function Get-LongDesc($module,$method,$sub){
  $m = $module -replace '-', ' '
  switch($method){
    'GET' { if($sub -eq '/'){"Returns a filtered list from $m module. Supports module-defined query options and status flags where implemented."} else {"Returns one $m record identified by path parameter id. Includes not-found response when id does not exist."} }
    'POST' {"Creates a new $m record using request body fields validated in route logic, then returns created payload."}
    'PUT' {"Updates an existing $m record using request body, validates required identifier/body fields, and returns update status."}
    'PATCH' {"Partially updates an existing $m record using patch semantics where implemented by this module."}
    'DELETE' {"Removes or soft-deletes a $m record based on module rules, usually using identifier in request body for this codebase."}
    default {"Module operation endpoint for $m."}
  }
}

$lines1=@()
$lines1 += '# API Level 1 Document'
$lines1 += ''
$lines1 += 'Source: route files only (routes/HARRY_CLINTON/*.js and nested module files).'
$lines1 += 'Base URL: /API/HARRY-CLINTON'
$lines1 += ''

$grouped = $items | Group-Object ModuleFolder | Sort-Object Name
foreach($g in $grouped){
  $lines1 += ('## Module Group: ' + $g.Name)
  $lines1 += ''
  foreach($m in ($g.Group | Sort-Object Mount)){
    $lines1 += ('### Module: ' + $m.Mount + ' (' + $m.RequirePath + ')')
    $lines1 += ''
    foreach($e in $m.Endpoints){
      $short = Get-ShortDesc $e.Method $e.SubPath
      $long = Get-LongDesc $m.Mount $e.Method $e.SubPath
      $lines1 += ('- Endpoint: ' + $e.Method + ' ' + $e.FullPath)
      $lines1 += ('  Short Description: ' + $short)
      $lines1 += ('  Long Description: ' + $long)
    }
    if(($m.Endpoints | Measure-Object).Count -eq 0){
      $lines1 += '- No endpoint declarations detected in this module file.'
    }
    $lines1 += ''
  }
}

$lines1 += '## Missing Table-wise Endpoints (as of now)'
$lines1 += '- tbl_about_us_pages: dedicated route module not present'
$lines1 += '- tbl_privacy_policy_pages: dedicated route module not present'
$lines1 += '- tbl_terms_conditions_pages: dedicated route module not present'
$lines1 += '- tbl_notification_bars: dedicated route module not present'
$lines1 += '- tbl_menu_section_images: dedicated route module not present'
$lines1 += '- tbl_subcategory_sections: dedicated route module not present'

Set-Content -Path $level1 -Value $lines1 -Encoding UTF8

$lines2=@()
$lines2 += '# API Level 2 Document (Endpoint Contracts)'
$lines2 += ''
$lines2 += 'Source: route files only.'
$lines2 += 'Base URL: /API/HARRY-CLINTON'
$lines2 += ''

foreach($m in ($items | Sort-Object Mount)){
  $lines2 += ('## Module: ' + $m.Mount)
  $lines2 += ('Route File: ' + $m.FilePath)
  $lines2 += ('CRUD-5 Complete: ' + ($(if($m.Crud5){'Yes'}else{'No'})))
  $lines2 += ''

  foreach($e in $m.Endpoints){
    $short = Get-ShortDesc $e.Method $e.SubPath
    $lines2 += ('### ' + $e.Method + ' ' + $e.FullPath)
    $lines2 += ('Description: ' + $short)
    $lines2 += 'Payload Contract:'
    if($e.Method -in @('POST','PUT','PATCH','DELETE')){
      $lines2 += '- Content-Type: application/json'
      $lines2 += '- Body: module-specific fields defined in route validation and SQL bindings'
      $lines2 += '- Common pattern in this codebase: PUT/DELETE often expect identifier in request body'
    } else {
      $lines2 += '- Path params: if endpoint includes /:id then id is required'
      $lines2 += '- Query params: optional includeDeleted/includeInactive or module-specific filters where available'
    }
    $lines2 += 'Response Types:'
    $lines2 += '- 200 OK: success response with data/message/count depending on module'
    if($e.Method -eq 'POST'){ $lines2 += '- 201 Created: record created successfully (for many CRUD modules)' }
    $lines2 += '- 400/405: missing or invalid required input'
    $lines2 += '- 404: entity not found for id-based operations'
    $lines2 += '- 409: conflict/unique constraint in some modules'
    $lines2 += '- 500: internal server/database error'
    $lines2 += ''
  }

  if(($m.Endpoints | Measure-Object).Count -eq 0){
    $lines2 += 'No endpoint declarations detected in this module file.'
    $lines2 += ''
  }
}

$lines2 += '## Missing Table-wise Endpoints (as of now)'
$lines2 += '- tbl_about_us_pages'
$lines2 += '- tbl_privacy_policy_pages'
$lines2 += '- tbl_terms_conditions_pages'
$lines2 += '- tbl_notification_bars'
$lines2 += '- tbl_menu_section_images'
$lines2 += '- tbl_subcategory_sections'

Set-Content -Path $level2 -Value $lines2 -Encoding UTF8
Write-Output "Generated: $level1"
Write-Output "Generated: $level2"
