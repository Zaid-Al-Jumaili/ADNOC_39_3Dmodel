# Minimal local web server for the existing-floor 3D model (no installation needed).
# Serves this folder on http://localhost:<port>/ and opens the default browser.
param([int]$Port = 0, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8';
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml';
  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp'; '.gif' = 'image/gif';
  '.glb' = 'model/gltf-binary'; '.gltf' = 'model/gltf+json'; '.bin' = 'application/octet-stream'; '.wasm' = 'application/wasm';
  '.mp4' = 'video/mp4'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'; '.csv' = 'text/csv; charset=utf-8'; '.ktx2' = 'image/ktx2'
}
$listener = $null
$ports = if ($Port -gt 0) { @($Port) } else { 8761..8785 }
foreach ($port in $ports) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$port/")
    $l.Start()
    $listener = $l
    break
  } catch { }
}
if (-not $listener) { Write-Host 'Could not start a local server (ports 8761-8785 busy).'; Read-Host 'Press Enter to exit'; exit 1 }
$url = $listener.Prefixes | Select-Object -First 1
Write-Host ''
Write-Host '  Level 37 - existing floor - 3D model' -ForegroundColor Yellow
Write-Host "  Serving $root"
Write-Host "  Open: $url" -ForegroundColor Cyan
Write-Host '  Keep this window open while viewing. Close it to stop.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
    $full = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $path))
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($full)) {
      $res.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $res.OutputStream.Write($b, 0, $b.Length)
    } else {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.AddHeader('Cache-Control', 'no-cache')
      $fs = [System.IO.File]::OpenRead($full)
      try { $res.ContentLength64 = $fs.Length; $fs.CopyTo($res.OutputStream) } finally { $fs.Close() }
    }
    $res.OutputStream.Close()
  } catch { try { $ctx.Response.Abort() } catch { } }
}
