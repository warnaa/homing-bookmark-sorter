# Render the existing Homing icon into a store promotional tile on Windows.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path $PSScriptRoot -Parent
$outputDirectory = Join-Path $repoRoot 'build'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$bitmap = [System.Drawing.Bitmap]::new(440, 280)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$icon = [System.Drawing.Image]::FromFile((Join-Path $repoRoot 'public/icons/icon-128.png'))
$background = [System.Drawing.ColorTranslator]::FromHtml('#234334')
$ring = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#527461'), 1)
$trail = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#8eae98'), 2)
$trail.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$gold = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#e9b949'))
try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear($background)
  $graphics.DrawEllipse($ring, 60, -20, 320, 320)
  $graphics.DrawEllipse($ring, 105, 25, 230, 230)
  $graphics.DrawLine($trail, 80, 90, 151, 132)
  $graphics.DrawLine($trail, 287, 150, 355, 190)
  foreach ($position in @(@(57, 65), @(350, 170))) {
    $x = $position[0]; $y = $position[1]
    $points = [System.Drawing.Point[]]@(
      [System.Drawing.Point]::new($x, $y), [System.Drawing.Point]::new($x + 26, $y),
      [System.Drawing.Point]::new($x + 26, $y + 42), [System.Drawing.Point]::new($x + 13, $y + 31),
      [System.Drawing.Point]::new($x, $y + 42)
    )
    $graphics.FillPolygon($gold, $points)
  }
  $graphics.DrawImage($icon, 150, 70, 140, 140)
  $output = Join-Path $outputDirectory 'store-promo-440x280.png'
  $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $output
} finally {
  $gold.Dispose(); $trail.Dispose(); $ring.Dispose(); $icon.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
