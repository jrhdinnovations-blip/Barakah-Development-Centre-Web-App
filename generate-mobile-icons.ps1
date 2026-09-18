Add-Type -AssemblyName System.Drawing

$baseDir = (Resolve-Path ".").Path
$sourceLogo = Join-Path $baseDir "public\swiftmove-logo.jpg"

if (-not (Test-Path $sourceLogo)) {
    Write-Error "Source logo not found at $sourceLogo"
    exit 1
}

Write-Host "Generating mobile icons from: $sourceLogo"
$src = [System.Drawing.Image]::FromFile($sourceLogo)

function Resize-And-Save($image, $targetPath, $width, $height) {
    $parent = Split-Path -Parent $targetPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(255, 8, 12, 23)) # SwiftMove dark background
    $g.DrawImage($image, 0, 0, $width, $height)
    $g.Dispose()
    
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $targetPath ($width x $height)"
}

# --- ANDROID ICONS ---
$androidRes = Join-Path $baseDir "android\app\src\main\res"

$androidSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $androidSizes.Keys) {
    $size = $androidSizes[$folder]
    $dir = Join-Path $androidRes $folder
    Resize-And-Save $src (Join-Path $dir "ic_launcher.png") $size $size
    Resize-And-Save $src (Join-Path $dir "ic_launcher_round.png") $size $size
    Resize-And-Save $src (Join-Path $dir "ic_launcher_foreground.png") $size $size
}

# Android Splash drawables
$splashSizes = @{
    "drawable-land-mdpi" = @(480, 320)
    "drawable-land-hdpi" = @(800, 480)
    "drawable-land-xhdpi" = @(1280, 720)
    "drawable-land-xxhdpi" = @(1600, 960)
    "drawable-land-xxxhdpi" = @(1920, 1280)
    "drawable-port-mdpi" = @(320, 480)
    "drawable-port-hdpi" = @(480, 800)
    "drawable-port-xhdpi" = @(720, 1280)
    "drawable-port-xxhdpi" = @(960, 1600)
    "drawable-port-xxxhdpi" = @(1280, 1920)
}

foreach ($splash in $splashSizes.Keys) {
    $w = $splashSizes[$splash][0]
    $h = $splashSizes[$splash][1]
    $splashDir = Join-Path $androidRes $splash
    Resize-And-Save $src (Join-Path $splashDir "splash.png") $w $h
}

# --- IOS ICONS ---
$iosAppIconDir = Join-Path $baseDir "ios\App\App\Assets.xcassets\AppIcon.appiconset"
if (Test-Path $iosAppIconDir) {
    $iosSizes = @(
        @{ name = "AppIcon-20x20@2x.png"; size = 40 },
        @{ name = "AppIcon-20x20@3x.png"; size = 60 },
        @{ name = "AppIcon-29x29@2x.png"; size = 58 },
        @{ name = "AppIcon-29x29@3x.png"; size = 87 },
        @{ name = "AppIcon-40x40@2x.png"; size = 80 },
        @{ name = "AppIcon-40x40@3x.png"; size = 120 },
        @{ name = "AppIcon-60x60@2x.png"; size = 120 },
        @{ name = "AppIcon-60x60@3x.png"; size = 180 },
        @{ name = "AppIcon-512@2x.png"; size = 1024 }
    )

    foreach ($icon in $iosSizes) {
        $target = Join-Path $iosAppIconDir $icon.name
        Resize-And-Save $src $target $icon.size $icon.size
    }
}

$src.Dispose()
Write-Host "SwiftMove native icons and splash screens generated successfully!"
