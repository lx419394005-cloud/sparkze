#!/bin/bash

# Pinker 优化验证脚本
# 用于快速验证优化是否正确实施

echo "🔍 Pinker 优化验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查工具库
if [ -f "utils.js" ]; then
  echo "✅ utils.js 存在"
else
  echo "❌ utils.js 不存在"
  exit 1
fi

# 检查 HTML 文件
html_count=0
for file in sidepanel.html gallery.html draw.html options.html; do
  if grep -q "utils.js" "$file" 2>/dev/null; then
    echo "✅ $file 已引入 utils.js"
    ((html_count++))
  else
    echo "❌ $file 未引入 utils.js"
  fi
done

if [ $html_count -eq 4 ]; then
  echo "✅ 所有 HTML 文件已引入工具库"
else
  echo "⚠️  只有 $html_count/4 个 HTML 文件引入了工具库"
fi

echo ""

# 检查日志替换
js_count=0
for file in background.js content.js sidepanel.js gallery.js draw.js options.js; do
  if grep -q "PinkerUtils.logger" "$file" 2>/dev/null; then
    echo "✅ $file 已使用 PinkerUtils.logger"
    ((js_count++))
  else
    echo "⚠️  $file 未使用 PinkerUtils.logger"
  fi
done

echo ""

# 检查防抖
debounce_count=$(grep -c "PinkerUtils.debounce" *.js 2>/dev/null | grep -v ":0" | wc -l)
echo "✅ 已添加 $debounce_count 处防抖优化"

echo ""

# 检查备份
if [ -d ".backup" ]; then
  backup_count=$(ls -1 .backup/*.js 2>/dev/null | wc -l)
  echo "✅ 已备份 $backup_count 个 JS 文件"
else
  echo "⚠️  未找到备份目录"
fi

echo ""

# 检查 Toast 样式
if grep -q "pinker-toast" styles.css 2>/dev/null; then
  echo "✅ Toast 样式已添加到 styles.css"
else
  echo "⚠️  Toast 样式未添加"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 总结
if [ $html_count -eq 4 ] && [ $js_count -ge 5 ] && [ -d ".backup" ]; then
  echo "🎉 优化验证通过! 可以重新加载插件测试了"
  echo ""
  echo "下一步:"
  echo "  1. 打开 chrome://extensions/"
  echo "  2. 找到 Pinker 插件"
  echo "  3. 点击刷新图标 🔄"
  echo "  4. 测试所有功能"
  echo "  5. (可选) 在控制台运行: PinkerPerformanceTest.runAll()"
else
  echo "⚠️  部分验证未通过,请检查上述问题"
fi

echo ""
