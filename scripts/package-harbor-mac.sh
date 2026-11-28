#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo "Usage: sh scripts/package-harbor-mac.sh GAME.html [output-directory]" >&2
    exit 2
fi

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
game_html=$1
output_dir=${2:-"$script_dir/../.qa/harbor-release"}
game_name='雾港的最后一炉'
bundle_id='org.prosperityroad.fogharbor'
if [ "$(basename "$game_html")" = 'rice-market.html' ]; then
    game_name='雾港米行'
    bundle_id='org.prosperityroad.ricemarket'
elif [ "$(basename "$game_html")" = 'fog-harbor-journeys.html' ]; then
    game_name='繁荣之路·雾港'
    bundle_id='org.prosperityroad.harborjourneys'
fi
app="$output_dir/$game_name.app"
contents="$app/Contents"
archive="$output_dir/$game_name-macOS-arm64.zip"

if [ ! -s "$game_html" ]; then
    echo "Missing offline game: $game_html" >&2
    exit 1
fi
if [ -e "$app" ] && [ "$(plutil -extract CFBundleIdentifier raw -o - "$contents/Info.plist" 2>/dev/null || true)" != "$bundle_id" ]; then
    echo "Another app already uses this output path: $app" >&2
    exit 1
fi

mkdir -p "$contents/MacOS" "$contents/Resources"
cat > "$contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
    <key>CFBundleIdentifier</key><string>$bundle_id</string>
    <key>CFBundleName</key><string>$game_name</string>
    <key>CFBundleDisplayName</key><string>$game_name</string>
    <key>CFBundleExecutable</key><string>FogHarbor</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>0.1</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>13.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict></plist>
EOF

xcrun --sdk macosx swiftc -O -target arm64-apple-macosx13.0 \
    "$script_dir/harbor-mac.swift" -o "$contents/MacOS/FogHarbor"
cp "$game_html" "$contents/Resources/fog-harbor.html"
codesign --force --sign - "$app"
codesign --verify --strict "$app"
cmp "$game_html" "$contents/Resources/fog-harbor.html"

# Write a fresh archive before replacing the previous classroom download.
new_archive=$(mktemp "$output_dir/.harbor-archive.XXXXXXXX")
ditto -c -k --norsrc --keepParent "$app" "$new_archive"
chmod 644 "$new_archive"
mv -f "$new_archive" "$archive"
printf '%s\n' "$app" "$archive"
