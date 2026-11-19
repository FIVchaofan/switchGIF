param(
    [string]$Toolchain = "D:\android-toolchain",
    [string]$Output = "D:\workspace\switchGIF\android\out\app-release.apk",
    [switch]$SkipArchive
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $project "app"
$build = Join-Path $project "build"
$jdk = Join-Path $Toolchain "jdk\jdk-17.0.2"
$buildTools = Join-Path $Toolchain "build-tools\android-14"
$platform = Join-Path $Toolchain "platform\android-35\android.jar"
$aapt2 = Join-Path $buildTools "aapt2.exe"
$zipalign = Join-Path $buildTools "zipalign.exe"
$apksigner = Join-Path $buildTools "apksigner.bat"
$keytool = Join-Path $jdk "bin\keytool.exe"

New-Item -ItemType Directory -Force (Split-Path -Parent $Output) | Out-Null

foreach ($path in @($aapt2, $platform, $zipalign, $apksigner, $keytool)) {
    if (-not (Test-Path $path)) { throw "Missing build tool: $path" }
}

$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;$buildTools;$env:Path"

if (Test-Path $build) { Remove-Item -Recurse -Force $build }
New-Item -ItemType Directory -Force $build, "$build\gen", "$build\classes", "$build\dex" | Out-Null

Write-Host "[1/6] aapt2 compile"
& $aapt2 compile --dir "$app\res" -o "$build\res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "[2/6] aapt2 link"
& $aapt2 link -o "$build\base.apk" -I $platform --manifest "$app\AndroidManifest.xml" -A "$app\assets" --java "$build\gen" -R "$build\res.zip" --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "[3/6] javac"
$javaFiles = @(Get-ChildItem -Path "$build\gen", "$app\src" -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$ijkJar = Join-Path $app "libs\ijkplayer.jar"
if (-not (Test-Path $ijkJar)) { throw "Missing IjkPlayer jar: $ijkJar" }
& "$jdk\bin\javac.exe" -encoding UTF-8 -source 11 -target 11 -classpath "$platform;$ijkJar" -d "$build\classes" @javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "[4/6] d8"
$classFiles = @(Get-ChildItem -Path "$build\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName })
& "$buildTools\d8.bat" --lib $platform --min-api 29 --output "$build\dex" @classFiles $ijkJar
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "[5/6] package / zipalign"
python (Join-Path $project "add_dex.py") "$build\base.apk" "$build\dex\classes.dex" "$build\unsigned.apk" "$app\jniLibs"
if ($LASTEXITCODE -ne 0) { throw "add classes.dex failed" }
& $zipalign -f -p 4 "$build\unsigned.apk" "$build\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "[6/6] sign"
$keystoreDir = Join-Path $project "keystore"
$keystore = Join-Path $keystoreDir "yuansu-gif.jks"
if (-not (Test-Path $keystore)) {
    New-Item -ItemType Directory -Force $keystoreDir | Out-Null
    & $keytool -genkeypair -v -keystore $keystore -alias yuansu -keyalg RSA -keysize 2048 -validity 10000 -storepass yuansugif -keypass yuansugif -dname "CN=YuanSu GIF, OU=Local, O=YuanSu, L=Local, ST=Local, C=CN" -noprompt
    if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}
& $apksigner sign --ks $keystore --ks-key-alias yuansu --ks-pass pass:yuansugif --key-pass pass:yuansugif --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $Output "$build\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }
& $apksigner verify --verbose --print-certs $Output
if ($LASTEXITCODE -ne 0) { throw "APK verification failed" }

$info = Get-Item $Output
Write-Host ""
Write-Host "APK built: $($info.FullName)"
Write-Host "Size: $([math]::Round($info.Length / 1MB, 1)) MB"

# Keep every released version. Never overwrite a different APK with the same version.
if ($SkipArchive) {
    Write-Host "Archive skipped (test build)."
    return
}
$workspace = Split-Path -Parent $project
$manifestText = Get-Content (Join-Path $app "AndroidManifest.xml") -Raw
$versionName = if ($manifestText -match 'android:versionName="([^"]+)"') { $Matches[1] } else { "unknown" }
$versionCode = if ($manifestText -match 'android:versionCode="(\d+)"') { $Matches[1] } else { "0" }
$releaseRoot = Join-Path $workspace "releases"
$releaseDir = Join-Path $releaseRoot "v$versionName"
$archiveName = "YuansuGIF-v$versionName.apk"
$archiveFile = Join-Path $releaseDir $archiveName
$newHash = (Get-FileHash $Output -Algorithm SHA256).Hash
$isNewArchive = -not (Test-Path $archiveFile)

if (-not $isNewArchive) {
    $oldHash = (Get-FileHash $archiveFile -Algorithm SHA256).Hash
    if ($oldHash -ne $newHash) {
        throw "Release v$versionName already exists with different content. Bump versionName/versionCode before building. Archive: $archiveFile"
    }
    Write-Host "Release archive already exists (identical): $archiveFile"
} else {
    New-Item -ItemType Directory -Force $releaseDir | Out-Null
    Copy-Item -LiteralPath $Output -Destination $archiveFile
    Write-Host "Archived release: $archiveFile"
}

if ($isNewArchive -or -not (Test-Path (Join-Path $releaseDir "SHA256.txt"))) {
    Set-Content -Path (Join-Path $releaseDir "SHA256.txt") -Value "$newHash  $archiveName" -Encoding ASCII
}
if ($isNewArchive -or -not (Test-Path (Join-Path $releaseDir "version.json"))) {
    $meta = [ordered]@{
        versionCode = [int]$versionCode
        versionName = $versionName
        file = $archiveName
        sha256 = $newHash
        size = (Get-Item $archiveFile).Length
        minSdk = 29
        targetSdk = 34
        builtAt = (Get-Date -Format "yyyy-MM-dd")
        notes = ""
    } | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $releaseDir "version.json"), $meta, [System.Text.UTF8Encoding]::new($false))
}

