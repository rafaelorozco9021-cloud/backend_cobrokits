$b='{"email":"esperanza@demo.cobrokits","password":"Esperanza2026!"}'
$r=Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $b -ContentType 'application/json' -UseBasicParsing -TimeoutSec 10
$j=$r.Content|ConvertFrom-Json
$t=$j.token
$h=@{Authorization="Bearer $t";"Content-Type"="application/json"}

# cobro1domingo Ana Rojas
$cr=Invoke-WebRequest -Uri 'http://localhost:3000/api/cobros' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$cobs=$cr.Content|ConvertFrom-Json
$cob=$cobs | Where-Object {$_.name -eq 'cobro1domingo'} | Select-Object -First 1
Write-Host "COBRO $($cob.name) seller $($cob.seller_name) seller_id $($cob.seller_id)"

$pr=Invoke-WebRequest -Uri 'http://localhost:3000/api/products' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$prods=$pr.Content|ConvertFrom-Json
$pSal=$prods | Where-Object {$_.sku -eq 'DEMO-001'} | Select-Object -First 1
$pCho=$prods | Where-Object {$_.sku -eq 'DEMO-002'} | Select-Object -First 1
$pJam=$prods | Where-Object {$_.sku -eq 'DEMO-003'} | Select-Object -First 1
Write-Host "ASIGNANDO a $($cob.seller_name): $($pSal.name) x5, $($pCho.name) x4, $($pJam.name) x3"

$body=@{
  seller_id=$cob.seller_id
  cobro_id=$cob.id
  items=@(
    @{product_id=$pSal.id;quantity=5}
    @{product_id=$pCho.id;quantity=4}
    @{product_id=$pJam.id;quantity=3}
  )
} | ConvertTo-Json -Depth 4
$d=Invoke-WebRequest -Uri 'http://localhost:3000/api/inventory' -Method POST -Headers $h -Body $body -UseBasicParsing -TimeoutSec 10
Write-Host "ASIGNAR result $($d.StatusCode) $($d.Content)"

$inv=Invoke-WebRequest -Uri "http://localhost:3000/api/inventory?sellerId=$($cob.seller_id)" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$arr=$inv.Content|ConvertFrom-Json
Write-Host "STOCK ENTREGADO ahora $($arr.Count) productos:"
$arr | ForEach-Object {
  $pn=($prods | Where-Object {$_.id -eq $_.product_id} | Select-Object -First 1).name
  # get name via lookup
  $prodName=($prods | Where-Object {$_.id -eq $_.product_id}).name
  if(-not $prodName){$prodName=$_.product_id.Substring(0,8)}
  Write-Host "  $prodName x$($_.quantity)"
}

# Verificar bodega descontado
$st=Invoke-WebRequest -Uri 'http://localhost:3000/api/stock' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$wh=$st.Content|ConvertFrom-Json
$wSal=$wh | Where-Object {$_.product_id -eq $pSal.id} | Select-Object -First 1
$wCho=$wh | Where-Object {$_.product_id -eq $pCho.id} | Select-Object -First 1
Write-Host "BODEGA Salchichon $($wSal.total_quantity) Chorizo $($wCho.total_quantity)"

Write-Host "`n--- Simulando una venta: Ana Rojas vende 2 Salchichon ---"
# Buscar un cliente de Ana Rojas
$cliRes=Invoke-WebRequest -Uri 'http://localhost:3000/api/customers' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$clis=$cliRes.Content|ConvertFrom-Json
$cli=$clis | Where-Object {$_.seller_id -eq $cob.seller_id} | Select-Object -First 1
Write-Host "Cliente $($cli.name) $($cli.id)"
$ventaBody=@{
  customerId=$cli.id
  sellerId=$cob.seller_id
  cobroId=$cob.id
  items=@(@{product_id=$pSal.id;quantity=2;unit_price=[int]$pSal.price})
  payment=20000
  paymentMethod="efectivo"
  notes="Venta prueba entregar"
  visitDate=(Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")
} | ConvertTo-Json -Depth 4
$v=Invoke-WebRequest -Uri 'http://localhost:3000/api/visits' -Method POST -Headers $h -Body $ventaBody -UseBasicParsing -TimeoutSec 10
Write-Host "VENTA result $($v.StatusCode) $($v.Content.Substring(0,200))"

$inv2=Invoke-WebRequest -Uri "http://localhost:3000/api/inventory?sellerId=$($cob.seller_id)" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$arr2=$inv2.Content|ConvertFrom-Json
Write-Host "STOCK tras venta:"
$arr2 | Where-Object {$_.product_id -eq $pSal.id} | Format-Table product_id,quantity

Write-Host "`n--- Cerrando venta de hoy ---"
$closeBody=@{seller_id=$cob.seller_id} | ConvertTo-Json
$cl=Invoke-WebRequest -Uri 'http://localhost:3000/api/inventory/close' -Method POST -Headers $h -Body $closeBody -UseBasicParsing -TimeoutSec 10
Write-Host "CERRAR $($cl.StatusCode) $($cl.Content)"

$inv3=Invoke-WebRequest -Uri "http://localhost:3000/api/inventory?sellerId=$($cob.seller_id)" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$arr3=$inv3.Content|ConvertFrom-Json
Write-Host "STOCK tras cerrar count $($arr3.Count)"

$st2=Invoke-WebRequest -Uri 'http://localhost:3000/api/stock' -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$wh2=$st2.Content|ConvertFrom-Json
$wSal2=$wh2 | Where-Object {$_.product_id -eq $pSal.id} | Select-Object -First 1
Write-Host "BODEGA Salchichon tras cerrar $($wSal2.total_quantity) (debe haber vuelto sobrante)"
