$b='{"email":"esperanza@demo.cobrokits","password":"Esperanza2026!"}'
$r=Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $b -ContentType 'application/json' -UseBasicParsing -TimeoutSec 10
$j=$r.Content|ConvertFrom-Json
$t=$j.token
$h=@{Authorization="Bearer $t";"Content-Type"="application/json"}
$seller='5529535a-d92a-4815-8f01-a54f891ee554' # Ana Rojas
$cob='24f240a3-2003-4810-8c05-10cb9e1c5021' # cobro1domingo

# limpiar primero
Invoke-WebRequest -Uri 'http://localhost:3000/api/inventory/close' -Method POST -Headers $h -Body (@{seller_id=$seller}|ConvertTo-Json) -UseBasicParsing -TimeoutSec 10 | Out-Null
# asignar 5 Salchichon + 4 Chorizo
$pr=Invoke-WebRequest -Uri 'http://localhost:3000/api/products' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$prods=$pr.Content|ConvertFrom-Json
$p1=$prods|Where-Object{$_.sku -eq 'DEMO-001'}|Select-Object -First 1
$p2=$prods|Where-Object{$_.sku -eq 'DEMO-002'}|Select-Object -First 1
$body=@{seller_id=$seller;cobro_id=$cob;items=@(@{product_id=$p1.id;quantity=5},@{product_id=$p2.id;quantity=4})}|ConvertTo-Json -Depth 4
$as=Invoke-WebRequest -Uri 'http://localhost:3000/api/inventory' -Method POST -Headers $h -Body $body -UseBasicParsing -TimeoutSec 10
Write-Host "ASIGNAR $($as.StatusCode) $($as.Content)"

$sum=Invoke-WebRequest -Uri "http://localhost:3000/api/inventory/summary?sellerId=$seller" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$js=$sum.Content|ConvertFrom-Json
Write-Host "SUMMARY tras asignar:"
$js | Format-Table product_id,asignado,vendido,resto

# vender 2 de p1 via visita
$cliRes=Invoke-WebRequest -Uri 'http://localhost:3000/api/customers' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$clis=$cliRes.Content|ConvertFrom-Json
$cli=$clis|Where-Object{$_.seller_id -eq $seller}|Select-Object -First 1
$venta=@{customerId=$cli.id;sellerId=$seller;cobroId=$cob;items=@(@{product_id=$p1.id;quantity=2;unit_price=[int]$p1.price});payment=10000;paymentMethod="efectivo";visitDate=(Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")}|ConvertTo-Json -Depth 4
$vs=Invoke-WebRequest -Uri 'http://localhost:3000/api/visits' -Method POST -Headers $h -Body $venta -UseBasicParsing -TimeoutSec 10
Write-Host "VENTA $($vs.StatusCode) $($vs.Content)"

$sum2=Invoke-WebRequest -Uri "http://localhost:3000/api/inventory/summary?sellerId=$seller" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$js2=$sum2.Content|ConvertFrom-Json
Write-Host "SUMMARY tras vender 2:"
$js2 | Format-Table product_id,asignado,vendido,resto

# cerrar
$cl=Invoke-WebRequest -Uri 'http://localhost:3000/api/inventory/close' -Method POST -Headers $h -Body (@{seller_id=$seller}|ConvertTo-Json) -UseBasicParsing -TimeoutSec 10
Write-Host "CERRAR $($cl.Content)"

$sum3=Invoke-WebRequest -Uri "http://localhost:3000/api/inventory/summary?sellerId=$seller" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
Write-Host "SUMMARY tras cerrar: $($sum3.Content)"
