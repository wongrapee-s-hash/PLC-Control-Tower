# Renders every slide to PNG and checks that no shape spills outside the slide.
# The PNGs are for a visual pass; the bounds check catches the failure this
# script exists to prevent, an element quietly landing off the edge.
param(
    [string]$Pptx = (Join-Path (Split-Path -Parent $PSScriptRoot) "deliverables\Slides\Production-Control-Tower.pptx"),
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "deliverables\Slides\preview")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$ppt = New-Object -ComObject PowerPoint.Application
$problems = @()
try {
    $pres = $ppt.Presentations.Open($Pptx, $true, $false, $false)
    $pres.Export($OutDir, "PNG", 1600, 900)

    # PowerPoint names the files after the slide, which follows the UI language.
    # Rename to a zero-padded English sequence so the folder sorts correctly.
    $i = 0
    foreach ($f in Get-ChildItem $OutDir | Sort-Object { [int]($_.BaseName -replace '\D', '') }) {
        $i++
        $new = Join-Path $OutDir ("Slide{0:d2}.png" -f $i)
        if ($f.FullName -ne $new) { Rename-Item $f.FullName $new -Force }
    }

    $slideW = $pres.PageSetup.SlideWidth
    $slideH = $pres.PageSetup.SlideHeight

    for ($i = 1; $i -le $pres.Slides.Count; $i++) {
        $s = $pres.Slides.Item($i)
        foreach ($sh in $s.Shapes) {
            # 0.02" of slack: rounded corners legitimately sit on the boundary.
            $over = @()
            if ($sh.Left -lt -0.02 -or $sh.Top -lt -0.02) { $over += "เริ่มนอกขอบ" }
            if (($sh.Left + $sh.Width) -gt ($slideW + 0.02)) { $over += "ล้นขวา" }
            if (($sh.Top + $sh.Height) -gt ($slideH + 0.02)) { $over += "ล้นล่าง" }

            # A box can sit inside the slide and still be too short for its text.
            # Thai wraps mid-word far more eagerly than Latin, so this is worth
            # measuring rather than eyeballing.
            $textOverflow = $false
            if ($sh.HasTextFrame -and $sh.TextFrame.HasText -and $sh.TextFrame2.TextRange.Text.Trim() -ne "") {
                $needed = $sh.TextFrame2.TextRange.BoundHeight
                $available = $sh.Height
                if ($sh.TextFrame2.AutoSize -ne 0) { continue }
                if ($needed -gt ($available + 2)) {
                    $textOverflow = $true
                    $over += "ข้อความสูง $($needed.ToString('0')) จากกรอบ $($available.ToString('0'))"
                }
            }

            if ($over.Count) {
                $label = if ($sh.HasTextFrame -and $sh.TextFrame.HasText) { $sh.TextFrame.TextRange.Text.Substring(0, [Math]::Min(24, $sh.TextFrame.TextRange.Text.Length)) -replace "\s+", " " } else { $sh.Name }
                $problems += "หน้า $i : $($over -join ', ') : $label"
            }
        }
    }
    $pres.Close()
}
finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}

"===== เนื้อหาต่อหน้า ====="
foreach ($f in Get-ChildItem $OutDir -Filter *.png | Sort-Object Name) {
    $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $ink = 0; $total = 0
    for ($y = 0; $y -lt $bmp.Height; $y += 4) {
        for ($x = 0; $x -lt $bmp.Width; $x += 4) {
            $total++
            $c = $bmp.GetPixel($x, $y)
            if (($c.R + $c.G + $c.B) -lt 700) { $ink++ }
        }
    }
    "  {0,-12} เนื้อหา {1,5:N1}%" -f $f.BaseName, (100 * $ink / $total)
    $bmp.Dispose()
}

"===== วัตถุล้นขอบ ====="
if ($problems.Count) { $problems | ForEach-Object { "  $_" } } else { "  ไม่พบ" }
