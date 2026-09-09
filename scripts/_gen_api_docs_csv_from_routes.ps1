$ErrorActionPreference='Stop'
$src='D:/2026/Harry-Clinton/HC-BACKEND/reports/route-files-endpoints-source-20260414.json'
$items=Get-Content -Raw -Path $src | ConvertFrom-Json

$csv1='D:/2026/Harry-Clinton/HC-BACKEND/reports/API-Level-1-Module-Endpoint-Index-20260414.csv'
$csv2='D:/2026/Harry-Clinton/HC-BACKEND/reports/API-Level-2-Endpoint-Contracts-20260414.csv'

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
    'GET' { if($sub -eq '/'){"Returns a filtered list from $m module."} else {"Returns one $m record by id."} }
    'POST' {"Creates a new $m record from request body."}
    'PUT' {"Updates an existing $m record using request body."}
    'PATCH' {"Partially updates an existing $m record."}
    'DELETE' {"Deletes or soft-deletes an existing $m record."}
    default {"Module operation endpoint for $m."}
  }
}

$l1=@()
$l2=@()
foreach($m in ($items | Sort-Object ModuleFolder,Mount)){
  foreach($e in $m.Endpoints){
    $short=Get-ShortDesc $e.Method $e.SubPath
    $long=Get-LongDesc $m.Mount $e.Method $e.SubPath

    $l1 += [pscustomobject]@{
      ModuleGroup=$m.ModuleFolder
      ModuleMount=$m.Mount
      RouteFile=$m.FilePath
      HttpMethod=$e.Method
      Endpoint=$e.FullPath
      ShortDescription=$short
      LongDescription=$long
    }

    $payload = if($e.Method -in @('POST','PUT','PATCH','DELETE')){'application/json body (module-specific fields)'}else{'path/query params as applicable'}
    $response='200 success; 400/405 validation; 404 not found; 409 conflict (some modules); 500 server error'

    $l2 += [pscustomobject]@{
      ModuleGroup=$m.ModuleFolder
      ModuleMount=$m.Mount
      RouteFile=$m.FilePath
      Crud5Complete=($(if($m.Crud5){'Yes'}else{'No'}))
      HttpMethod=$e.Method
      Endpoint=$e.FullPath
      PayloadContract=$payload
      ResponseTypes=$response
      Notes='Generated from route files only'
    }
  }
}

$l1 | Export-Csv -Path $csv1 -NoTypeInformation -Encoding UTF8
$l2 | Export-Csv -Path $csv2 -NoTypeInformation -Encoding UTF8
Write-Output "Generated: $csv1"
Write-Output "Generated: $csv2"
