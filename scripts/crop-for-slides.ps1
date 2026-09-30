# Crops the tall full-page screenshots down to a 16:9 window for use in slides.
# The originals under docs/screenshots are never modified.
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "docs\screenshots"
$dst = Join-Path $root "deliverables\Slides\assets"
New-Item -ItemType Directory -Path $dst -Force | Out-Null

foreach ($f in Get-ChildItem "$src\*.png") {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $cropH = [Math]::Round($img.Width * 9 / 16)
    if ($cropH -gt $img.Height) { $cropH = $img.Height }
    $out = Join-Path $dst $f.Name
    $bmp = New-Object System.Drawing.Bitmap $img.Width, $cropH
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $img.Width, $cropH), 0, 0, $img.Width, $cropH, [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    "{0,-30} -> {1}x{2}" -f $f.Name, $img.Width, $cropH
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
