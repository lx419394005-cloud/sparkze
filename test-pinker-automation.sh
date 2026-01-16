#!/bin/bash

# Pinker 插件自动化测试脚本
# 使用 agent-browser 测试核心功能

echo "🧪 Pinker 插件自动化测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 获取插件路径
EXTENSION_PATH="$(pwd)"

echo "📦 插件路径: $EXTENSION_PATH"
echo ""

# 1. 打开测试页面
echo "1️⃣  打开测试页面..."
agent-browser --headed --extension "$EXTENSION_PATH" open "file://$(pwd)/test-badge.html"
sleep 2

# 2. 获取页面快照
echo "2️⃣  获取页面快照..."
agent-browser snapshot -i > /tmp/pinker-test-snapshot.txt
cat /tmp/pinker-test-snapshot.txt

# 3. 检查 badge 元素
echo ""
echo "3️⃣  检查 badge 元素..."
agent-browser eval "document.querySelector('.picker-analyze-badge') ? 'Badge found' : 'Badge not found'"

# 4. 悬停图片
echo ""
echo "4️⃣  悬停图片触发 badge..."
agent-browser hover "img.test-image"
sleep 1

# 5. 截图
echo ""
echo "5️⃣  截图保存..."
agent-browser screenshot pinker-test-hover.png
echo "✅ 截图已保存: pinker-test-hover.png"

# 6. 检查 badge 是否可见
echo ""
echo "6️⃣  检查 badge 可见性..."
agent-browser eval "window.getComputedStyle(document.querySelector('.picker-analyze-badge')).display"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 测试完成!"
echo ""
echo "查看结果:"
echo "  • 快照: /tmp/pinker-test-snapshot.txt"
echo "  • 截图: pinker-test-hover.png"
