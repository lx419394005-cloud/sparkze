#!/bin/bash

# Pinker 插件测试 - 使用 Unsplash 作为测试页面

echo "🧪 Pinker 插件功能测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 关闭现有浏览器
echo "🔄 关闭现有浏览器..."
agent-browser close 2>/dev/null

# 获取插件路径
EXTENSION_PATH="$(pwd)"
echo "📦 插件路径: $EXTENSION_PATH"
echo ""

# 启动带插件的浏览器
echo "1️⃣  启动浏览器并加载插件..."
agent-browser --headed --extension "$EXTENSION_PATH" open "https://unsplash.com"
sleep 3

# 获取页面快照
echo ""
echo "2️⃣  获取页面元素..."
agent-browser snapshot -i -c | head -50

# 等待页面加载
echo ""
echo "3️⃣  等待图片加载..."
agent-browser wait 2000

# 查找图片元素
echo ""
echo "4️⃣  查找图片元素..."
agent-browser eval "document.querySelectorAll('img').length + ' images found'"

# 检查插件是否注入
echo ""
echo "5️⃣  检查 Pinker 插件是否注入..."
agent-browser eval "document.querySelector('.picker-analyze-badge') ? '✅ Badge element exists' : '❌ Badge not found'"

# 检查 content script
echo ""
echo "6️⃣  检查 content script..."
agent-browser eval "typeof window !== 'undefined' ? '✅ Window available' : '❌ No window'"

# 截图
echo ""
echo "7️⃣  保存截图..."
agent-browser screenshot --full pinker-unsplash-test.png
echo "✅ 截图已保存: pinker-unsplash-test.png"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 测试完成!"
echo ""
echo "💡 提示:"
echo "  • 浏览器窗口保持打开,可以手动测试"
echo "  • 悬停图片查看 badge 是否出现"
echo "  • 运行 'agent-browser close' 关闭浏览器"
