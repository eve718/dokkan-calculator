Get-ChildItem -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git\\' } |
    Sort-Object Length -Descending |
    ForEach-Object { '{0,10:N1} KB  {1}' -f ($_.Length / 1KB), $_.FullName }
