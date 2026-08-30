param (
    [string]$DbUrl = "",
    [string]$BbApiKey = "",
    [string]$BbProjectId = ""
)

if ([string]::IsNullOrWhiteSpace($DbUrl)) {
    $DbUrl = Read-Host "Please paste your PostgreSQL Database URL (e.g., postgresql://user:pass@host/db)"
}

if ([string]::IsNullOrWhiteSpace($DbUrl)) {
    Write-Host "Error: Database URL is required to deploy." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($BbApiKey)) {
    $BbApiKey = Read-Host "Please paste your BROWSERBASE_API_KEY"
}

if ([string]::IsNullOrWhiteSpace($BbProjectId)) {
    $BbProjectId = Read-Host "Please paste your BROWSERBASE_PROJECT_ID"
}

Write-Host "`nInitializing Cloud Run Deployment..." -ForegroundColor Cyan

gcloud run deploy trans4mers `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars="DATABASE_URL=$DbUrl,GOOGLE_CLOUD_PROJECT=trans4mers,GCS_BUCKET_NAME=trans4mers-artifacts,BROWSERBASE_API_KEY=$BbApiKey,BROWSERBASE_PROJECT_ID=$BbProjectId" `
  --session-affinity
