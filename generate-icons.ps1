Add-Type -AssemblyName System.Drawing

$publicDir = (Resolve-Path "public").Path
$sourceJpg = Join-Path $publicDir "barakah-centre-logo.jpg"

Write-Host "Loading source image from: $sourceJpg"
$src = [System.Drawing.Image]::FromFile($sourceJpg)

function Resize-And-Save-Png($image, $targetPath, $width, $height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($image, 0, 0, $width, $height)
    $g.Dispose()
    
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved: $targetPath ($width x $height)"
}

# 1. Full PNG
Resize-And-Save-Png $src (Join-Path $publicDir "barakah-centre-logo.png") $src.Width $src.Height

# 2. Apple Touch Icon (180x180)
Resize-And-Save-Png $src (Join-Path $publicDir "apple-touch-icon.png") 180 180

# 3. Icon 192 (192x192)
Resize-And-Save-Png $src (Join-Path $publicDir "icon-192.png") 192 192

# 4. Icon 512 (512x512)
Resize-And-Save-Png $src (Join-Path $publicDir "icon-512.png") 512 512

# 5. Favicon 32x32 PNG
Resize-And-Save-Png $src (Join-Path $publicDir "favicon-32x32.png") 32 32

# 6. Favicon 16x16 PNG
Resize-And-Save-Png $src (Join-Path $publicDir "favicon-16x16.png") 16 16

# 7. True ICO file
$icoBmp = New-Object System.Drawing.Bitmap(48, 48)
$gIco = [System.Drawing.Graphics]::FromImage($icoBmp)
$gIco.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gIco.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gIco.DrawImage($src, 0, 0, 48, 48)
$gIco.Dispose()

$hIcon = $icoBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoPath = Join-Path $publicDir "favicon.ico"
$icoStream = [System.IO.File]::OpenWrite($icoPath)
$icon.Save($icoStream)
$icoStream.Close()
$icoStream.Dispose()
$icon.Dispose()
$icoBmp.Dispose()

# Also copy to dist/client if it exists
$distClient = Join-Path (Resolve-Path ".").Path "dist\client"
if (Test-Path $distClient) {
    Copy-Item (Join-Path $publicDir "favicon.ico") (Join-Path $distClient "favicon.ico") -Force
    Copy-Item (Join-Path $publicDir "barakah-centre-logo.png") (Join-Path $distClient "barakah-centre-logo.png") -Force
    Copy-Item (Join-Path $publicDir "favicon-32x32.png") (Join-Path $distClient "favicon-32x32.png") -Force
    Copy-Item (Join-Path $publicDir "favicon-16x16.png") (Join-Path $distClient "favicon-16x16.png") -Force
    Copy-Item (Join-Path $publicDir "apple-touch-icon.png") (Join-Path $distClient "apple-touch-icon.png") -Force
    Write-Host "Copied updated assets to dist/client"
}

$src.Dispose()
Write-Host "All icons generated successfully!"
