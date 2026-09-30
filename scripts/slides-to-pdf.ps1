# Converts the deck to PDF using the PowerPoint installation on this machine,
# so the PDF is a faithful render of the PPTX rather than a separate export.
param(
    [string]$Pptx = (Join-Path (Split-Path -Parent $PSScriptRoot) "deliverables\Slides\Production-Control-Tower.pptx")
)

$ErrorActionPreference = "Stop"
$pdf = [System.IO.Path]::ChangeExtension($Pptx, ".pdf")
if (Test-Path $pdf) { Remove-Item $pdf -Force }

$ppt = New-Object -ComObject PowerPoint.Application
try {
    # 2 = open read-only, untitled=false, withWindow=false
    $pres = $ppt.Presentations.Open($Pptx, $true, $false, $false)
    # 32 = ppSaveAsPDF
    $pres.SaveAs($pdf, 32)
    $slides = $pres.Slides.Count
    $pres.Close()
    "{0} หน้า  ->  {1}  ({2:N0} KB)" -f $slides, (Split-Path $pdf -Leaf), ((Get-Item $pdf).Length / 1KB)
}
finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
