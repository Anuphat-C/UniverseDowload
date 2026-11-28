<#
  Renumber "NN - title [id].ext" files in a folder by TikTok post time (oldest = 1).
  TikTok video IDs carry the post time (id >> 32 = unix seconds), so no re-download is needed.

  Preview only (default):  .\renumber-episodes.ps1 -Folder "C:\...\snapdrama_tv"
  Rename for real:         .\renumber-episodes.ps1 -Folder "C:\...\snapdrama_tv" -Apply
  Undo the last rename:    .\renumber-episodes.ps1 -Folder "C:\...\snapdrama_tv" -Undo
#>
param(
  [Parameter(Mandatory)][string]$Folder,
  [int]$Start = 1,
  [int]$Pad = 2,
  [switch]$Apply,
  [switch]$Undo
)
$ErrorActionPreference = 'Stop'
$log = Join-Path $Folder '.renumber-undo.csv'

function Rename-TwoPhase($pairs) {
  # rename through temp names first so "01 -> 05" never collides with an existing "05"
  $tmp = foreach ($p in $pairs) {
    $t = '~' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '~' + $p.To
    Rename-Item -LiteralPath (Join-Path $Folder $p.From) -NewName $t
    [pscustomobject]@{ Tmp = $t; To = $p.To }
  }
  foreach ($t in $tmp) { Rename-Item -LiteralPath (Join-Path $Folder $t.Tmp) -NewName $t.To }
}

if ($Undo) {
  if (-not (Test-Path -LiteralPath $log)) { throw "No undo file found in $Folder" }
  $pairs = Import-Csv -LiteralPath $log | ForEach-Object { [pscustomobject]@{ From = $_.To; To = $_.From } }
  Rename-TwoPhase $pairs
  Remove-Item -LiteralPath $log
  "Restored $($pairs.Count) file names."
  return
}

$files = Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Name -match '^\d+ - .*\[(\d{15,})\]' }
if (-not $files) { "No numbered files with a [video id] found in $Folder"; return }

# group by video id so a clip's .mp4, .jpg, .srt etc. get the same number
$groups = $files | Group-Object { [uint64]([regex]::Match($_.Name, '\[(\d{15,})\]').Groups[1].Value) } |
  Sort-Object { [uint64]$_.Name }

$pairs = @()
$n = $Start
foreach ($g in $groups) {
  $num = $n.ToString().PadLeft($Pad, '0')
  foreach ($f in $g.Group) {
    $new = $f.Name -replace '^\d+ - ', "$num - "
    if ($new -ne $f.Name) { $pairs += [pscustomobject]@{ From = $f.Name; To = $new } }
  }
  $n++
}

"$($groups.Count) clips, $($pairs.Count) files need a new number."
$pairs | Select-Object -First 8 | ForEach-Object { "  {0}  ->  {1}" -f $_.From.Substring(0, [Math]::Min(6, $_.From.Length)), $_.To.Substring(0, [Math]::Min(6, $_.To.Length)) }
if ($pairs.Count -gt 8) { "  ..." }

if (-not $Apply) { "`nPreview only. Add -Apply to rename."; return }
if (-not $pairs) { return }
$pairs | Export-Csv -LiteralPath $log -NoTypeInformation -Encoding UTF8
Rename-TwoPhase $pairs
"Renamed $($pairs.Count) files. Undo with -Undo."
