param(
  [string]$DatabaseName = "bsp_store",
  [string]$DbUser = "bsp_app",
  [string]$DbPassword = "bsp_local_dev_2026",
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

$BackupDir = Join-Path $PSScriptRoot "..\backups"
if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$DumpFile = Join-Path $BackupDir "${DatabaseName}_${Timestamp}.dump"
$HashFile = "${DumpFile}.sha256"

$PgDumpPath = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
if (-not (Test-Path $PgDumpPath)) {
  $PgDumpPath = "pg_dump"
}

Write-Host "[BSP Store Backup] Iniciando respaldo de '$DatabaseName' en $DumpFile ..." -ForegroundColor Cyan

$env:PGPASSWORD = $DbPassword
try {
  & $PgDumpPath -h $DbHost -p $DbPort -U $DbUser -F c -b -v -f $DumpFile $DatabaseName
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump finalizó con código de error $LASTEXITCODE"
  }

  $HashObj = Get-FileHash -Path $DumpFile -Algorithm SHA256
  $HashObj.Hash | Set-Content -Path $HashFile -Encoding ASCII

  Write-Host "[BSP Store Backup] Respaldo completado exitosamente." -ForegroundColor Green
  Write-Host "  Archivo : $DumpFile"
  Write-Host "  SHA-256 : $($HashObj.Hash)"

  # Limpieza de respaldos antiguos según ventana de retención
  $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -Path $BackupDir -Filter "*.dump" | Where-Object { $_.LastWriteTime -lt $CutoffDate } | ForEach-Object {
    Remove-Item $_.FullName -Force
    if (Test-Path "$($_.FullName).sha256") {
      Remove-Item "$($_.FullName).sha256" -Force
    }
  }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
