# TandaXn V0 Organizer
$v0Path = "C:\Users\franck\OneDrive\Desktop\TandaXn\V0 completed"
$rnPath = "C:\Users\franck\OneDrive\Desktop\TandaXn\tanda-xn-mobile"

Write-Host "📂 Organizing V0 files..." -ForegroundColor Green

# Create React Native folder structure
$folders = @(
    "app",
    "app/(auth)",
    "app/(app)",
    "app/onboarding",
    "app/error",
    "app/legal",
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
        Write-Host "  Created: $folder" -ForegroundColor DarkGray
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

# Copy files
$totalFiles = 0
foreach ($key in $mapping.Keys) {
    $source = Join-Path $v0Path $key
    $dest = Join-Path $rnPath $mapping[$key]
    
    if (Test-Path $source) {
        Write-Host "`n📁 $key → $($mapping[$key])" -ForegroundColor Yellow
        
        # Copy all JSX/TSX files
        $jsxFiles = Get-ChildItem $source -Filter *.jsx -ErrorAction SilentlyContinue
        $tsxFiles = Get-ChildItem $source -Filter *.tsx -ErrorAction SilentlyContinue
        $files = $jsxFiles + $tsxFiles
        
        foreach ($file in $files) {
            $destFile = Join-Path $dest $file.Name
            Copy-Item $file.FullName $destFile -Force
            Write-Host "    📄 $($file.Name)" -ForegroundColor Gray
            $totalFiles++
        }
        
        if ($files.Count -eq 0) {
            Write-Host "    (No .jsx/.tsx files found)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "`n📁 $key → (Source folder not found)" -ForegroundColor DarkGray
    }
}

Write-Host "`n✅ Done! $totalFiles files organized." -ForegroundColor Green
Write-Host "📊 Check your app folder structure:" -ForegroundColor Cyan
Write-Host "   app/(auth) - Authentication screens" -ForegroundColor Cyan
Write-Host "   app/(app) - Main app screens" -ForegroundColor Cyan
