#!/bin/bash

echo "🔧 Pinker Badge 快速修复"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 检查文件完整性
echo "1️⃣  检查文件..."
if [ ! -f "content.js" ]; then
  echo "❌ content.js 不存在!"
  exit 1
fi

if [ ! -f "styles.css" ]; then
  echo "❌ styles.css 不存在!"
  exit 1
fi

echo "✅ 文件完整"
echo ""

# 2. 检查 content.js 中是否有 PinkerUtils 残留
echo "2️⃣  检查 PinkerUtils 残留..."
if grep -q "PinkerUtils" content.js; then
  echo "⚠️  发现 PinkerUtils 残留,正在清理..."
  cp .backup/content.js content.js
  echo "✅ 已从备份恢复"
else
  echo "✅ 无 PinkerUtils 残留"
fi
echo ""

# 3. 检查语法
echo "3️⃣  检查 JavaScript 语法..."
if node -c content.js 2>/dev/null; then
  echo "✅ 语法正确"
else
  echo "❌ 语法错误!"
  node -c content.js
  exit 1
fi
echo ""

# 4. 检查 CSS
echo "4️⃣  检查 CSS..."
if grep -q "picker-analyze-badge" styles.css; then
  echo "✅ Badge 样式存在"
else
  echo "❌ Badge 样式缺失!"
  exit 1
fi
echo ""

# 5. 检查 manifest
echo "5️⃣  检查 manifest.json..."
if grep -q '"content.js"' manifest.json; then
  echo "✅ content.js 已配置"
else
  echo "❌ content.js 未在 manifest 中配置!"
  exit 1
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有检查通过!"
echo ""
echo "📋 下一步操作:"
echo "  1. 在 Chrome 中重新加载插件"
echo "  2. 完全关闭并重新打开测试网页"
echo "  3. 清除浏览器缓存 (Ctrl+Shift+Delete)"
echo "  4. 打开控制台 (F12) 查看错误信息"
echo ""
echo "如果还是不行,请提供控制台的错误信息"
echo ""
