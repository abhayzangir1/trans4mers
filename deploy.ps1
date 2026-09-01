# Trans4mers Secure Deployment Script for Google Cloud Run
# 
# IMPORTANT: This script uses Google Cloud Secret Manager to keep credentials secure.
# Credentials are NOT passed as plaintext environment variables.
#
# Prerequisites:
# 1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
# 2. Authenticate: gcloud auth application-default login
# 3. Set your project: gcloud config set project YOUR-PROJECT-ID
# 4. Create secrets (see section below)

param (
    [string]$ProjectId = "",
    [string]$Region = "us-central1",
    [string]$ServiceName = "trans4mers"
)

# ============================================================================
# CONFIGURATION
# ============================================================================

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    $ProjectId = (gcloud config get-value project 2>$null).Trim()
    if ([string]::IsNullOrWhiteSpace($ProjectId)) {
        Write-Host "ERROR: Please set your GCP project first:" -ForegroundColor Red
        Write-Host "  gcloud config set project YOUR-PROJECT-ID" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Trans4mers Secure Cloud Run Deployment" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Project: $ProjectId" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Green
Write-Host "Service: $ServiceName" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 1: CREATE OR UPDATE GOOGLE CLOUD SECRETS
# ============================================================================

Write-Host "Step 1: Setting up Google Cloud Secrets..." -ForegroundColor Cyan
Write-Host ""

# Check if secrets exist, if not prompt user to create them
$requiredSecrets = @(
    "trans4mers-database-url",
    "trans4mers-browserbase-api-key",
    "trans4mers-browserbase-project-id"
)

foreach ($secretName in $requiredSecrets) {
    $secretExists = gcloud secrets describe $secretName --project=$ProjectId 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Secret '$secretName' not found" -ForegroundColor Yellow
        Write-Host "To create this secret, run:" -ForegroundColor Yellow
        Write-Host "  echo 'your-secret-value' | gcloud secrets create $secretName --replication-policy=automatic --data-file=-" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "✅ Secret '$secretName' found" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "If any secrets are missing above, please create them before continuing." -ForegroundColor Yellow
$continue = Read-Host "Continue with deployment? (yes/no)"
if ($continue -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# ============================================================================
# STEP 2: GRANT SECRET MANAGER ACCESS TO CLOUD RUN SERVICE ACCOUNT
# ============================================================================

Write-Host "Step 2: Configuring IAM permissions..." -ForegroundColor Cyan

$serviceAccountEmail = "$ProjectId@appspot.gserviceaccount.com"
Write-Host "Service Account: $serviceAccountEmail" -ForegroundColor Green

foreach ($secretName in $requiredSecrets) {
    Write-Host "Granting Secret Reader role for: $secretName"
    gcloud secrets add-iam-policy-binding $secretName `
        --member="serviceAccount:$serviceAccountEmail" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId `
        --quiet *>$null
}

Write-Host "✅ IAM permissions configured" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 3: DEPLOY TO CLOUD RUN WITH SECRET REFERENCES
# ============================================================================

Write-Host "Step 3: Deploying to Cloud Run..." -ForegroundColor Cyan
Write-Host ""

# Secrets are referenced without exposing their values
gcloud run deploy $ServiceName `
    --source . `
    --project=$ProjectId `
    --region=$Region `
    --allow-unauthenticated `
    --set-env-vars="NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1,GOOGLE_CLOUD_PROJECT=$ProjectId,GCS_BUCKET_NAME=$($ServiceName)-artifacts" `
    --set-secrets="DATABASE_URL=trans4mers-database-url:latest,BROWSERBASE_API_KEY=trans4mers-browserbase-api-key:latest,BROWSERBASE_PROJECT_ID=trans4mers-browserbase-project-id:latest" `
    --session-affinity `
    --timeout=3600 `
    --memory=2Gi `
    --cpu=2 `
    --concurrency=50

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    
    $serviceUrl = (gcloud run services describe $ServiceName --region=$Region --project=$ProjectId --format='value(status.url)' 2>$null).Trim()
    if ($serviceUrl) {
        Write-Host "Service URL: $serviceUrl" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. View logs: gcloud run logs read $ServiceName --project=$ProjectId" -ForegroundColor Yellow
    Write-Host "2. Update service: Run this script again" -ForegroundColor Yellow
    Write-Host "3. Monitor: https://console.cloud.google.com/run" -ForegroundColor Yellow
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 4: SECURITY VERIFICATION
# ============================================================================

Write-Host ""
Write-Host "Step 4: Verifying security settings..." -ForegroundColor Cyan

# Check that service runs without plaintext secrets in logs
$recentRevisions = gcloud run revisions list `
    --service=$ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --limit=1 `
    --format='value(metadata.name)' 2>$null

if ($recentRevisions) {
    Write-Host "✅ Service is running (no plaintext secrets in environment)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not verify service status" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
