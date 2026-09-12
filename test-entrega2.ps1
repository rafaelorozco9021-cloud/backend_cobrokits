$b='{"email":"esperanza@demo.cobrokits","password":"Esperanza2026!"}'
$r=Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $b -ContentType 'application/json' -UseBasicParsing -TimeoutSec 10
$j=$r.Content|ConvertFrom-Json
$t=$j.token
$h=@{Authorization="Bearer $t";"Content-Type"="application/json"}

$cr=Invoke-WebRequest -Uri 'http://localhost:3000/api/cobros' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$cobs=$cr.Content|ConvertFrom-Json
$cob=$cobs[9]
Write-Host "cobro $($cob.name) $($cob.grupo) seller $($cob.seller_name) seller_id $($cob.seller_id)"

$pr=Invoke-WebRequest -Uri 'http://localhost:3000/api/products' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$prods=$pr.Content|ConvertFrom-Json
$p1=$prods | Where-Object {$_.sku -eq 'DEMO-001'} | Select-Object -First 1
$p2=$prods | Where-Object {$_.sku -eq 'DEMO-002'} | Select-Object -First 1
Write-Host "p1 $($p1.name) $($p1.id) p2 $($p2.name) $($p2.id)"

$body=@{
  seller_id=$cob.seller_id
  cobro_id=$cob.id
  items=@(
    @{product_id=$p1.id;quantity=2}
    @{product_id=$p2.id;quantity=1}
  )
} | ConvertTo-Json -Depth 4
Write-Host "body $body"

$d=Invoke-WebRequest -Uri 'http://localhost:3000/api/inventory' -Method POST -Headers $h -Body $body -UseBasicParsing -TimeoutSec 10
Write-Host "entrega $($d.StatusCode) $($d.Content)"

$inv=Invoke-WebRequest -Uri "http://localhost:3000/api/inventory?sellerId=$($cob.seller_id)" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$arr=$inv.Content|ConvertFrom-Json
Write-Host "inventory count $($arr.Count)"
$arr | Where-Object {$_.product_id -eq $p1.id} | Format-Table product_id,quantity
