#!/bin/bash
# scaffold a new r1 creation
# usage: sh new-creation.sh <name> [description]
set -e

NAME="${1:?usage: sh new-creation.sh <name> [description]}"
DESC="${2:-a rabbit r1 creation}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
DIR="$ROOT/$NAME"

if [ -e "$DIR" ]; then
  echo "already exists: $DIR"
  exit 1
fi

mkdir -p "$DIR/css" "$DIR/js"

cat > "$DIR/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=240, initial-scale=1.0, user-scalable=no">
<title>$NAME</title>
<link rel="stylesheet" href="css/styles.css">
</head>
<body>
<div id="app">
  <h1>$NAME</h1>
  <p>built for r1</p>
</div>
<script src="js/app.js"></script>
</body>
</html>
EOF

cat > "$DIR/css/styles.css" <<'EOF'
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 240px; height: 282px; overflow: hidden; }
body { background: #0e0e10; color: #fff; font-family: -apple-system, sans-serif; }
#app { padding: 16px; }
h1 { font-size: 20px; margin-bottom: 8px; }
p { font-size: 13px; color: rgba(255,255,255,0.6); }
EOF

cat > "$DIR/js/app.js" <<'EOF'
// creation logic goes here.
// r1 screen: 240x282. data persists in localStorage on the device.
console.log('creation booted');
EOF

cat > "$DIR/install.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Install $NAME</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0e0e10; color: #fff; font-family: -apple-system, sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; }
h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
p { font-size: 14px; color: rgba(255,255,255,0.45); margin-bottom: 32px; text-align: center; }
#qr { margin-bottom: 20px; }
.url { font-size: 11px; color: rgba(255,255,255,0.25); word-break: break-all; text-align: center; max-width: 300px; }
</style>
</head>
<body>
<h1>$NAME</h1>
<p>Scan with your Rabbit R1 to install.</p>
<div id="qr"></div>
<div class="url" id="url-label"></div>
<script src="https://unpkg.com/qr-code-styling@1.6.0/lib/qr-code-styling.js"></script>
<script>
  var creationUrl = location.href.replace(/\/install\.html.*$/, '/');
  document.getElementById('url-label').textContent = creationUrl;
  var qrData = JSON.stringify({
    title: "$NAME",
    url: creationUrl,
    description: "$DESC",
    iconUrl: "",
    themeColor: "#FE5000"
  });
  new QRCodeStyling({
    width: 260, height: 260,
    data: qrData,
    dotsOptions: { color: "#ffffff", type: "rounded" },
    backgroundOptions: { color: "#0e0e10" },
    cornersSquareOptions: { color: "#FE5000", type: "extra-rounded" },
    cornersDotOptions: { color: "#FE5000" }
  }).append(document.getElementById('qr'));
</script>
</body>
</html>
EOF

# add a card to the repo landing page
if [ -f "$ROOT/index.html" ] && grep -q '<!-- creations -->' "$ROOT/index.html"; then
  SAFE_DESC=$(printf '%s' "$DESC" | sed 's/[&\|]/\\&/g')
  sed -i '' "s|<!-- creations -->|<a class=\"card\" href=\"$NAME/install.html\">\n  <h2>$NAME</h2>\n  <span>$SAFE_DESC</span>\n</a>\n<!-- creations -->|" "$ROOT/index.html"
  echo "added to landing page"
fi

echo "created $DIR"
echo "next: build it, then commit + push"
