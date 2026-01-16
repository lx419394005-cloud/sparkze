#!/bin/bash

# Pinker 插件优化脚本
# 用途: 批量替换 console.log 为 PinkerUtils.logger

echo "🚀 开始优化 Pinker Chrome 插件..."

# 备份原文件
echo "📦 创建备份..."
mkdir -p .backup
cp *.js .backup/ 2>/dev/null
echo "✅ 备份完成 (保存在 .backup/ 目录)"

# 统计当前 console.log 数量
echo ""
echo "📊 当前状态:"
echo "console.log 数量: $(grep -r "console\.log" *.js 2>/dev/null | wc -l)"
echo "console.warn 数量: $(grep -r "console\.warn" *.js 2>/dev/null | wc -l)"
echo "console.error 数量: $(grep -r "console\.error" *.js 2>/dev/null | wc -l)"

# 询问是否继续
echo ""
read -p "是否继续优化? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ 已取消"
    exit 1
fi

# 在每个 JS 文件开头添加 utils.js 引用注释
echo ""
echo "🔧 开始替换..."

for file in background.js content.js sidepanel.js gallery.js draw.js options.js; do
    if [ -f "$file" ]; then
        echo "处理 $file..."
        
        # 替换 console.log (保留 [Pinker] 前缀的内容)
        sed -i.bak "s/console\.log('\[Pinker\] /PinkerUtils.logger.log('/g" "$file"
        sed -i.bak 's/console\.log("\[Pinker\] /PinkerUtils.logger.log("/g' "$file"
        sed -i.bak "s/console\.log(\`\[Pinker\] /PinkerUtils.logger.log(\`/g" "$file"
        
        # 替换普通 console.log
        sed -i.bak "s/console\.log(/PinkerUtils.logger.log(/g" "$file"
        
        # 替换 console.warn
        sed -i.bak "s/console\.warn('\[Pinker\] /PinkerUtils.logger.warn('/g" "$file"
        sed -i.bak 's/console\.warn("\[Pinker\] /PinkerUtils.logger.warn("/g' "$file"
        sed -i.bak "s/console\.warn(/PinkerUtils.logger.warn(/g" "$file"
        
        # console.error 保持不变 (错误始终要输出)
        
        # 删除临时备份文件
        rm -f "$file.bak"
    fi
done

echo ""
echo "✅ 替换完成!"

# 统计替换后的数量
echo ""
echo "📊 优化后状态:"
echo "PinkerUtils.logger.log 数量: $(grep -r "PinkerUtils\.logger\.log" *.js 2>/dev/null | wc -l)"
echo "PinkerUtils.logger.warn 数量: $(grep -r "PinkerUtils\.logger\.warn" *.js 2>/dev/null | wc -l)"
echo "console.error 数量: $(grep -r "console\.error" *.js 2>/dev/null | wc -l)"

echo ""
echo "📝 后续步骤:"
echo "1. 在每个 HTML 文件中引入 utils.js:"
echo "   <script src=\"utils.js\"></script>"
echo ""
echo "2. 在 Chrome 中重新加载插件测试"
echo ""
echo "3. 生产环境关闭日志:"
echo "   在 utils.js 中设置 enabled: false"
echo ""
echo "4. 如果有问题,可以从 .backup/ 目录恢复"

echo ""
echo "🎉 优化完成!"
