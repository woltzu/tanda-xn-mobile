# TandaXn V0 Organizer - FIXED VERSION
$v0Path = "C:\Users\franck\OneDrive\Desktop\TandaXn\V0 completed"
$rnPath = "C:\Users\franck\OneDrive\Desktop\TandaXn\tanda-xn-mobile"

Write-Host "📂 Organizing V0 files..." -ForegroundColor Green

# Create React Native folder structure (including kyc subfolder)
$folders = @(
    "app",
    "app/(auth)",
    "app/(app)",
    "app/onboarding",
    "app/error",
    "app/legal",
    "app/(auth)/kyc",  # FIXED: Add kyc subfolder
    "app/(app)/dashboard",
    "app/(app)/wallet",
    "app/(app)/circles",
    "app/(app)/loans",
    "app/(app)/goals",
    "app/(app)/community",
    "app/(app)/settings",
    "app/(app)/score",
    "app/(app)/elder",
    "app/(app)/cross-border",
    "app/(app)/remittance",
    "app/(app)/account",
    "app/(app)/data",
    "app/(app)/help",
    "app/(app)/private",
    "components",
    "constants",
    "context",
    "hooks",
    "lib",
    "types",
    "assets/images"
)

foreach ($folder in $folders) {
    $fullPath = Join-Path $rnPath $folder
    if (!(Test-Path $fullPath)) {
        New-Item -ItemType Directory -Force -Path $fullPath | Out-Null
    }
}

# Map V0 folders to new structure
$mapping = @{
    "Auth" = "app/(auth)"
    "Dash" = "app/(app)/dashboard"
    "Wal" = "app/(app)/wallet"
    "Circ" = "app/(app)/circles"
    "Advance" = "app/(app)/loans"
    "Goal" = "app/(app)/goals"
    "Comm" = "app/(app)/community"
    "Setting" = "app/(app)/settings"
    "Score" = "app/(app)/score"
    "Elder" = "app/(app)/elder"
    "XBorder" = "app/(app)/cross-border"
    "Remit" = "app/(app)/remittance"
    "KYC" = "app/(auth)/kyc"
    "Account" = "app/(app)/account"
    "Data" = "app/(app)/data"
    "Error" = "app/error"
    "Help" = "app/(app)/help"
    "Legal" = "app/legal"
    "Private" = "app/(app)/private"
    "Divers" = "app/(app)/dashboard"
    "Pay" = "app/(app)/wallet"
    "Return" = "app/(app)/wallet"
}

# Copy files - FIXED ARRAY CONCATENATION
$totalFiles = 0
foreach ($key in $mapping.Keys) {
    $source = Join-Path $v0Path $key
    $dest = Join-Path $rnPath $mapping[$key]
    
    if (Test-Path $source) {
        Write-Host "`n📁 $key → $($mapping[$key])" -ForegroundColor Yellow
        
        # Get files - FIXED: Use @() to create arrays
        $jsxFiles = @(Get-ChildItem $source -Filter *.jsx -ErrorAction SilentlyContinue)
        $tsxFiles = @(Get-ChildItem $source -Filter *.tsx -ErrorAction SilentlyContinue)
        
        # Combine arrays safely
        $files = @()
        if ($jsxFiles) { $files += $jsxFiles }
        if ($tsxFiles) { $files += $tsxFiles }
        
        foreach ($file in $files) {
            $destFile = Join-Path $dest $file.Name
            try {
                Copy-Item $file.FullName $destFile -Force -ErrorAction Stop
                Write-Host "    ✅ $($file.Name)" -ForegroundColor Green
                $totalFiles++
            } catch {
                Write-Host "    ❌ Failed to copy $($file.Name): $_" -ForegroundColor Red
            }
        }
        
        if ($files.Count -eq 0) {
            Write-Host "    (No .jsx/.tsx files found)" -ForegroundColor DarkGray
        }
    }
}

Write-Host "`n🎉 Done! $totalFiles files organized." -ForegroundColor Green
Write-Host "📊 Total screens available: $totalFiles" -ForegroundColor Cyan
