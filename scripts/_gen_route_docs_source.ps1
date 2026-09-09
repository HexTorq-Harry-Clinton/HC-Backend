$ErrorActionPreference = 'Stop'
$root = 'D:/2026/Harry-Clinton/HC-BACKEND'
$routesRoot = Join-Path $root 'routes/HARRY_CLINTON'
$indexPath = Join-Path $routesRoot 'index.js'

$indexContent = Get-Content -Raw -Path $indexPath
$mountRegex = "router\.use\('/([^']+)',\s*require\('\./([^']+)'\)\)"
$mounts = [regex]::Matches($indexContent, $mountRegex) | ForEach-Object {
  [pscustomobject]@{ Mount='/' + $_.Groups[1].Value; RequirePath=$_.Groups[2].Value }
}

$items = @()
foreach($m in $mounts){
  $filePath = Join-Path $routesRoot ($m.RequirePath + '.js')
  if(-not (Test-Path $filePath)){ continue }

  $endpoints = @()
  $lines = Get-Content -Path $filePath
  foreach($line in $lines){
    if($line -match 'router\.(get|post|put|patch|delete)\('){
      $method = $Matches[1].ToUpper()
      $sub = $null
      if($line -match "'([^']+)'"){ $sub = $Matches[1] }
      elseif($line -match '"([^"]+)"'){ $sub = $Matches[1] }

      if(-not [string]::IsNullOrWhiteSpace($sub)){
        $full = if($sub -eq '/') { '/API/HARRY-CLINTON' + $m.Mount } else { '/API/HARRY-CLINTON' + $m.Mount + $sub }
        $endpoints += [pscustomobject]@{ Method=$method; SubPath=$sub; FullPath=$full }
      }
    }
  }

  $crud5 = @('GET:/','GET:/:id','POST:/','PUT:/','DELETE:/')
  $sig = $endpoints | ForEach-Object { "$($_.Method):$($_.SubPath)" }
  $hasCrud5 = ($crud5 | Where-Object { $_ -notin $sig }).Count -eq 0

  $moduleName = Split-Path $m.RequirePath -Leaf
  $moduleFolder = Split-Path $m.RequirePath -Parent

  $items += [pscustomobject]@{
    Mount=$m.Mount
    RequirePath=$m.RequirePath
    FilePath=($filePath.Substring($root.Length+1) -replace '\\','/')
    ModuleName=$moduleName
    ModuleFolder=if([string]::IsNullOrWhiteSpace($moduleFolder)){ 'ROOT' } else { $moduleFolder }
    Crud5=$hasCrud5
    EndpointCount=($endpoints | Measure-Object).Count
    Endpoints=$endpoints
  }
}

$out = 'D:/2026/Harry-Clinton/HC-BACKEND/reports/route-files-endpoints-source-20260414.json'
$items | ConvertTo-Json -Depth 10 | Set-Content -Path $out -Encoding UTF8
Write-Output "Generated: $out"
Write-Output ("Modules: " + $items.Count)
