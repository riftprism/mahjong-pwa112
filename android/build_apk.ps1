$root = "D:\A\mahjong-pwa112"
$proj = "$root\android"
$build = "$proj\build"
Remove-Item $build -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$build\gen","$build\classes","$build\dex" | Out-Null

Write-Output "[1/8] Building frontend (Vite -> dist)..."
Push-Location $root
& npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Output "Frontend build failed"; exit 1 }
Pop-Location

$bt   = "C:\Users\1000\AppData\Local\Android\Sdk\build-tools\36.0.0"
$jar  = "C:\Users\1000\AppData\Local\Android\Sdk\platforms\android-37.0\android.jar"
$jbr  = "C:\Program Files\Android\Android Studio\jbr"
$kc   = "C:\Program Files\Android\Android Studio\plugins\Kotlin\kotlinc"
$kstd = "$kc\lib\kotlin-stdlib.jar"
$env:JAVA_HOME = $jbr
$env:PATH = "$jbr\bin;" + $env:PATH
$utf8 = New-Object System.Text.UTF8Encoding $false

function Run-Step($name, $scriptBlock) {
    Write-Output "[..] $name"
    & $scriptBlock
    if ($LASTEXITCODE -ne 0) { Write-Output "FAILED ($LASTEXITCODE): $name"; exit 1 }
}

Run-Step "[2/8] Compile Android resources (aapt2)" {
    & "$bt\aapt2.exe" compile --dir "$proj\res" -o "$build\res.zip" *> "$build\01.log"
}

Run-Step "[3/8] Link base.apk + R.java (targetSdk 37 / Android 17)" {
    & "$bt\aapt2.exe" link -o "$build\base.apk" -I $jar --manifest "$proj\AndroidManifest.xml" --min-sdk-version 28 --target-sdk-version 37 --java "$build\gen" "$build\res.zip" *> "$build\02.log"
}

$rjava = Get-ChildItem "$build\gen" -Recurse -Filter *.java | ForEach-Object { $_.FullName }
Run-Step "[4/8] Compile R.java" {
    & "$jbr\bin\javac.exe" --release 17 -d "$build\classes" -cp $jar $rjava *> "$build\03.log"
}

$kt = Get-ChildItem "$proj\src" -Recurse -Filter *.kt | ForEach-Object { $_.FullName }
$argLines = @("-jvm-target", "17", "-nowarn", "-d", "$build\classes", "-classpath", "$jar;$build\classes") + $kt
[System.IO.File]::WriteAllLines("$build\kotlinc.args", $argLines, $utf8)
Write-Output "[5/8] Compile Kotlin (MainActivity.kt)..."
& "$kc\bin\kotlinc.bat" "@$build\kotlinc.args" *> "$build\04.log"
if ($LASTEXITCODE -ne 0) {
    Write-Output "KOTLINC FAILED. errors:"
    Get-Content "$build\04.log"
    exit 1
}

$cls = Get-ChildItem "$build\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
Write-Output "[6/8] Dexing classes (d8)..."
& "$bt\d8.bat" --release --min-api 28 --lib $jar --output "$build\dex" $cls $kstd *> "$build\d8.log"
if (-not (Test-Path "$build\dex\classes.dex")) {
    Write-Output "D8 FAILED:"
    Get-Content "$build\d8.log" -Tail 25
    exit 1
}

Write-Output "[7/8] Packaging classes.dex & dist/ web assets with forward-slash paths..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$build\base.apk", "Update")
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$build\dex\classes.dex", "classes.dex", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null

$distPath = (Resolve-Path "$root\dist").Path
$distFiles = Get-ChildItem -Path $distPath -Recurse -File
foreach ($file in $distFiles) {
    $rel = $file.FullName.Substring($distPath.Length).TrimStart('\', '/').Replace('\', '/')
    $entryName = "assets/www/$rel"
    # Store uncompressed (NoCompression) so Android AssetManager.open() can stream directly
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::NoCompression) | Out-Null
}
$zip.Dispose()

Run-Step "[8/8] Zipalign & Sign APK" {
    & "$bt\zipalign.exe" -f -p 4 "$build\base.apk" "$build\aligned.apk" *> "$build\06.log"
}

$ks = "$proj\debug.keystore"
if (-not (Test-Path $ks)) {
    & "$jbr\bin\keytool.exe" -genkeypair -keystore $ks -alias androiddebugkey -dname "CN=Android Debug,O=Android,C=US" -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 *> "$build\keytool.log"
}

$outApk = "$root\GuocuiMahjong.apk"
Run-Step "Sign APK" {
    & "$bt\apksigner.bat" sign --ks $ks --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out $outApk "$build\aligned.apk" *> "$build\sign.log"
}
Run-Step "Verify APK" {
    & "$bt\apksigner.bat" verify $outApk *> "$build\verify.log"
}

Copy-Item -Path $outApk -Destination "D:\A\GuocuiMahjong.apk" -Force
Write-Output ("SUCCESS -> " + $outApk + " (" + [math]::Round((Get-Item $outApk).Length/1KB,1) + " KB)")
