# Sparkze 优化快速参考

## 🚀 3 分钟快速开始

```bash
# 1. 在所有 HTML 文件的 <head> 中添加
<script src="utils.js"></script>

# 2. (可选) 运行自动优化
./optimize.sh

# 3. 重新加载插件
chrome://extensions/ → 刷新
```

## 📚 API 速查表

### 日志
```javascript
SparkzeUtils.logger.log('message')      // 普通日志
SparkzeUtils.logger.warn('warning')     // 警告
SparkzeUtils.logger.error('error')      // 错误
SparkzeUtils.logger.enabled = false     // 关闭日志
```

### 存储
```javascript
await SparkzeUtils.storage.get('key')           // 读取
await SparkzeUtils.storage.set({ key: value })  // 保存
await SparkzeUtils.storage.remove('key')        // 删除
```

### 防抖/节流
```javascript
const fn = SparkzeUtils.debounce(func, 300)  // 防抖
const fn = SparkzeUtils.throttle(func, 100)  // 节流
```

### Toast
```javascript
SparkzeUtils.toast.success('成功')  // 成功提示
SparkzeUtils.toast.error('失败')    // 错误提示
SparkzeUtils.toast.info('信息')     // 信息提示
```

### DOM
```javascript
SparkzeUtils.dom.$('#id')                    // 查询(缓存)
SparkzeUtils.dom.$$('.class')                // 查询所有
SparkzeUtils.dom.create('div', {attrs})      // 创建元素
SparkzeUtils.dom.clearCache()                // 清理缓存
```

### 工具
```javascript
SparkzeUtils.image.getBestUrl(img)           // 获取最高清图片
SparkzeUtils.validate.isValidUrl(url)        // 验证 URL
SparkzeUtils.formatDate(timestamp)           // 格式化时间
SparkzeUtils.handleError(error, 'context')   // 错误处理
```

## 📊 性能测试

```javascript
// 在浏览器控制台运行
SparkzePerformanceTest.runAll()      // 所有测试
SparkzePerformanceTest.testMemory()  // 内存测试
```

## 🔧 常见替换

### 日志
```javascript
// 旧 → 新
console.log('[Sparkze] msg')  →  SparkzeUtils.logger.log('msg')
console.warn('[Sparkze] msg') →  SparkzeUtils.logger.warn('msg')
```

### 存储
```javascript
// 旧 → 新
chrome.storage.local.get('key')      →  SparkzeUtils.storage.get('key')
chrome.storage.local.set({key: v})   →  SparkzeUtils.storage.set({key: v})
```

### 搜索防抖
```javascript
// 旧
searchInput.addEventListener('input', (e) => {
  performSearch(e.target.value);
});

// 新
const debouncedSearch = SparkzeUtils.debounce((term) => {
  performSearch(term);
}, 300);
searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

## 📁 文件说明

| 文件 | 大小 | 说明 |
|------|------|------|
| `utils.js` | 6.4K | 核心工具库 |
| `OPTIMIZATION_REPORT.md` | 7.9K | 详细优化报告 |
| `OPTIMIZATION_GUIDE.md` | 4.7K | 实施指南 |
| `OPTIMIZATION_CHECKLIST.md` | 5.0K | 实施清单 |
| `README_OPTIMIZATION.md` | 6.1K | 优化总结 |
| `optimize.sh` | 2.6K | 自动化脚本 |
| `performance-test.js` | 8.3K | 性能测试 |

## ⚡ 预期效果

- 运行时性能: **+15-25%**
- 内存使用: **-20-30MB**
- 页面响应: **+10-15%**
- 代码重复: **-30-40%**

## 🎯 优先级

### 立即实施 ⭐⭐⭐
1. 引入 utils.js
2. 替换日志系统
3. 优化存储操作

### 近期实施 ⭐⭐
4. 添加防抖/节流
5. DOM 查询优化
6. 图片懒加载

### 长期优化 ⭐
7. 代码分割
8. 错误监控
9. 性能监控

## 🐛 故障排除

### 问题: SparkzeUtils is not defined
```javascript
// 确保在 HTML 中引入了 utils.js
<script src="utils.js"></script>
```

### 问题: 日志不显示
```javascript
// 检查是否被关闭
SparkzeUtils.logger.enabled = true
```

### 问题: 功能异常
```bash
# 从备份恢复
cp .backup/*.js .
# 或使用 git
git checkout -- *.js
```

## 📞 获取帮助

1. 查看 `OPTIMIZATION_GUIDE.md` 详细指南
2. 查看 `OPTIMIZATION_REPORT.md` 技术细节
3. 运行性能测试诊断问题
4. 检查浏览器控制台错误

## ✅ 验证清单

- [ ] utils.js 已引入所有 HTML
- [ ] 插件重新加载成功
- [ ] SparkzeUtils 可在控制台访问
- [ ] 所有功能正常工作
- [ ] 性能测试通过
- [ ] 无控制台错误

---

**快速链接**:
- 详细报告: `OPTIMIZATION_REPORT.md`
- 实施指南: `OPTIMIZATION_GUIDE.md`
- 实施清单: `OPTIMIZATION_CHECKLIST.md`
- 完整总结: `README_OPTIMIZATION.md`
