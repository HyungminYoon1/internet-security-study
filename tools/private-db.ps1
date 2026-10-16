param([ValidateSet('capture','run')][string]$Mode, [string]$Script)
$ErrorActionPreference = 'Stop'
$credentialDirectory = Join-Path $env:LOCALAPPDATA 'InternetSecurityStudy'
$credentialPath = Join-Path $credentialDirectory 'neon-production.dpapi'
if ($Mode -eq 'capture') {
    $connection = Get-Clipboard -Raw
    $match = [regex]::Match($connection, 'postgres(?:ql)?://[^\s''"]+')
    if (-not $match.Success) { throw 'The clipboard does not contain a Postgres connection string.' }
    $uri = [uri]$match.Value
    if ($uri.Host -ne 'ep-raspy-moon-aosbozvt-pooler.c-2.ap-southeast-1.aws.neon.tech' -and $uri.Host -ne 'ep-raspy-moon-aosbozvt.c-2.ap-southeast-1.aws.neon.tech') { throw 'Unexpected database host.' }
    [void][System.IO.Directory]::CreateDirectory($credentialDirectory)
    $secret = ConvertTo-SecureString -String $match.Value -AsPlainText -Force
    $encrypted = ConvertFrom-SecureString -SecureString $secret
    [System.IO.File]::WriteAllText($credentialPath, $encrypted, [System.Text.UTF8Encoding]::new($false))
    Set-Clipboard -Value ''
    $connection = $null; $match = $null; $secret = $null; $encrypted = $null
    Write-Output 'Credential saved with Windows current-user encryption; clipboard cleared. No credential value emitted.'
    exit
}
if (-not $Script -or -not (Test-Path -LiteralPath $Script)) { throw 'A local verification/migration script is required.' }
$encrypted = [System.IO.File]::ReadAllText($credentialPath, [System.Text.Encoding]::UTF8)
$secret = ConvertTo-SecureString -String $encrypted
$credential = [System.Management.Automation.PSCredential]::new('unused', $secret)
try {
    $env:STUDY_DATABASE_URL = $credential.GetNetworkCredential().Password
    & node $Script
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Remove-Item Env:STUDY_DATABASE_URL -ErrorAction SilentlyContinue
    $credential = $null; $secret = $null; $encrypted = $null
}
