$b='{"email":"esperanza@demo.cobrokits","password":"Esperanza2026!"}'
$r=Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $b -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
$j=$r.Content|ConvertFrom-Json
$t=$j.token
Write-Host "token ok $($j.user.name) id $($j.user.id)"
$h=@{Authorization="Bearer $t"; "Content-Type"="application/json"}

Write-Host "`n=== POST producto test ==="
$prod='{"name":"Test Producto Unit","description":"Producto de prueba configuracion","cost_price":12000,"price":18000,"category":"general","stock":5}'
try{
  $pr=Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Method POST -Headers $h -Body $prod -UseBasicParsing -TimeoutSec 10
  Write-Host "status $($pr.StatusCode)"
  Write-Host $pr.Content.Substring(0,400)
}catch{
  Write-Host "FAIL POST prod $($_.Exception.Message)"
  Write-Host $_.ErrorDetails.Message
}

Write-Host "`n=== POST cliente test ==="
$sellerId=$j.user.id
$cli=@{
  name="Test Cliente Unit"
  phone="3009988776"
  email="testunit@demo.cobrokits"
  address="Calle Test 123"
  seller_id=$sellerId
} | ConvertTo-Json -Compress
try{
  $cr=Invoke-WebRequest -Uri "http://localhost:3000/api/customers" -Method POST -Headers $h -Body $cli -UseBasicParsing -TimeoutSec 10
  Write-Host "status $($cr.StatusCode)"
  Write-Host $cr.Content.Substring(0,500)
}catch{
  Write-Host "FAIL POST cli $($_.Exception.Message)"
  Write-Host $_.ErrorDetails.Message
}

Write-Host "`n=== Verificacion GET post-insert ==="
$gp=Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$pj=$gp.Content|ConvertFrom-Json
Write-Host "products ahora $($pj.Count) incluye Test? $(($pj | Where-Object {$_.name -like '*Test Producto*'}).Count)"
$gc=Invoke-WebRequest -Uri "http://localhost:3000/api/customers" -Headers @{Authorization="Bearer $t"} -UseBasicParsing -TimeoutSec 10
$cj=$gc.Content|ConvertFrom-Json
Write-Host "customers ahora $($cj.Count) incluye Test? $(($cj | Where-Object {$_.name -like '*Test Cliente*'}).Count)"
