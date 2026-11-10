param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DatabaseName = "bsp_store",
  [string]$DbUser = "bsp_app",
  [string]$DbPassword = "bsp_local_dev_2026",
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  throw "No se encontró el archivo de respaldo especificado: $BackupFile"
}

$HashFile = "${BackupFile}.sha256"
if (Test-Path $HashFile) {
  $ExpectedHash = (Get-Content -Path $HashFile -Raw).Trim()
  $ActualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
  if ($ExpectedHash -ne $ActualHash) {
    throw "Error de integridad: el hash SHA-256 del respaldo no coincide ($ActualHash vs $ExpectedHash)."
  }
  Write-Host "[BSP Store Restore] Verificación de integridad SHA-256 exitosa." -ForegroundColor Green
}

$PgRestorePath = "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
if (-not (Test-Path $PgRestorePath)) {
  $PgRestorePath = "pg_restore"
}

Write-Host "[BSP Store Restore] Restaurando '$BackupFile' sobre la base de datos '$DatabaseName'..." -ForegroundColor Yellow

$env:PGPASSWORD = $DbPassword
try {
  & $PgRestorePath -h $DbHost -p $DbPort -U $DbUser --clean --if-exists --no-owner --no-privileges -d $DatabaseName $BackupFile
  if ($LASTEXITCODE -ne 0) {
    throw "pg_restore finalizó con código de error $LASTEXITCODE"
  }
  Write-Host "[BSP Store Restore] Restauración completada exitosamente." -ForegroundColor Green
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
