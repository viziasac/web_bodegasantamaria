# Configura rate limits y hardening de Auth en Supabase (Management API)
# Uso:
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."   # https://supabase.com/dashboard/account/tokens
#   .\scripts\configure-supabase-auth-security.ps1
#
# Proyecto: Bodega Santa Maria (cztnnkxvwiwpeifqygta)

$ErrorActionPreference = "Stop"
$ProjectRef = "cztnnkxvwiwpeifqygta"
$BaseUrl = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error @"
Falta SUPABASE_ACCESS_TOKEN.
1. Ve a https://supabase.com/dashboard/account/tokens
2. Crea un token con permiso auth:write / project admin
3. Ejecuta: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'
4. Vuelve a correr este script
"@
}

$Headers = @{
  Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN"
  "Content-Type" = "application/json"
}

function Get-AuthConfig {
  Invoke-RestMethod -Uri $BaseUrl -Headers @{ Authorization = $Headers.Authorization } -Method Get
}

# Valores recomendados ERP interno (equipo pequeño, anti brute-force)
# Nota: Supabase aplica burst de ~30 req en bucket IP además de estos límites.
$PatchBody = @{
  disable_signup                         = $true
  external_anonymous_users_enabled       = $false
  mailer_allow_unverified_email_sign_ins = $false
  # Dashboard: "Rate limit for sign-ups and sign-ins" (por IP, ventana ~5 min)
  rate_limit_otp                         = 10
  rate_limit_verify                      = 60
  rate_limit_token_refresh               = 300
  rate_limit_email_sent                  = 4
  rate_limit_sms_sent                    = 4
  rate_limit_anonymous_users             = 10
  rate_limit_web3                        = 5
  password_hibp_enabled                  = $true
  password_min_length                    = 8
  password_required_characters           = "letters_digits"
  jwt_exp                                = 3600
  refresh_token_rotation_enabled         = $true
  security_refresh_token_reuse_interval  = 10
  security_update_password_require_reauthentication = $true
  sessions_inactivity_timeout            = 28800
} | ConvertTo-Json

Write-Host "=== Auth config ANTES (rate limits) ===" -ForegroundColor Cyan
$before = Get-AuthConfig
$before.PSObject.Properties | Where-Object { $_.Name -like 'rate_limit_*' -or $_.Name -in @(
  'disable_signup','password_hibp_enabled','password_min_length','jwt_exp'
) } | ForEach-Object { Write-Host ("  {0}: {1}" -f $_.Name, $_.Value) }

Write-Host "`n=== Aplicando hardening ===" -ForegroundColor Yellow
$result = Invoke-RestMethod -Uri $BaseUrl -Headers $Headers -Method Patch -Body $PatchBody

Write-Host "`n=== Auth config DESPUÉS ===" -ForegroundColor Green
$result.PSObject.Properties | Where-Object { $_.Name -like 'rate_limit_*' -or $_.Name -in @(
  'disable_signup','password_hibp_enabled','password_min_length','jwt_exp',
  'external_anonymous_users_enabled','mailer_allow_unverified_email_sign_ins'
) } | ForEach-Object { Write-Host ("  {0}: {1}" -f $_.Name, $_.Value) }

Write-Host "`nListo. Complementa con loginGuard client-side (ya en la web) y opcional CAPTCHA en Dashboard > Auth > Bot and Abuse Protection." -ForegroundColor Green
