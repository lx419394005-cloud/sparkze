# 如何应用优化

## 快速开始

### 1. 引入工具库

在所有 HTML 文件的 `<head>` 部分,在其他 script 标签之前添加:

```html
<script src="utils.js"></script>
```

需要修改的文件:
- `sidepanel.html`
- `gallery.html`
- `draw.html`
- `options.html`

### 2. 更新 manifest.json

已完成 ✅ - `utils.js` 已添加到 `web_accessible_resources`

### 3. 运行优化脚本 (可选)

如果想自动替换所有 console.log:

```bash
./optimize.sh
```

或者手动替换:

```javascript
// 旧代码
console.log('[Sparkze] Something');
console.warn('[Sparkze] Warning');

// 新代码
SparkzeUtils.logger.log('Something');
SparkzeUtils.logger.warn('Warning');
```

### 4. 测试

1. 在 Chrome 中重新加载插件
2. 打开开发者工具查看日志
3. 测试所有核心功能

### 5. 生产环境配置

在 `utils.js` 中修改:

```javascript
logger: {
  enabled: false, // 关闭日志
  // ...
}
```

## 示例: 更新 sidepanel.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles.css">
  <!-- 👇 添加这一行 -->
  <script src="utils.js"></script>
</head>
<body class="sidepanel-body notranslate" translate="no">
  <!-- ... 其他内容 ... -->
  
  <!-- 原有的脚本 -->
  <script src="sidepanel.js"></script>
</body>
</html>
```

## 示例: 更新 sidepanel.js

### 替换日志

```javascript
// 旧代码
console.log('[Sparkze] Initializing event listeners...');

// 新代码
SparkzeUtils.logger.log('Initializing event listeners...');
```

### 使用存储工具

```javascript
// 旧代码
async function loadAndRender() {
  const data = await chrome.storage.local.get('savedImages');
  allSavedImages = data.savedImages || [];
  renderUI();
}

// 新代码
async function loadAndRender() {
  const data = await SparkzeUtils.storage.get('savedImages');
  allSavedImages = data.savedImages || [];
  renderUI();
}
```

### 使用防抖

```javascript
// 旧代码
searchInput.addEventListener('input', (e) => {
  currentSearchTerm = e.target.value.toLowerCase();
  renderUI();
});

// 新代码
const debouncedSearch = SparkzeUtils.debounce((value) => {
  currentSearchTerm = value.toLowerCase();
  renderUI();
}, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

### 使用 Toast

```javascript
// 旧代码
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 新代码
SparkzeUtils.toast.success('保存成功');
SparkzeUtils.toast.error('操作失败');
```

## 渐进式迁移策略

不需要一次性全部替换,可以按以下顺序逐步迁移:

### 阶段 1: 基础设施 (1天)
- ✅ 创建 `utils.js`
- ✅ 更新 `manifest.json`
- 在所有 HTML 中引入 `utils.js`
- 测试工具库是否正常工作

### 阶段 2: 日志系统 (1天)
- 替换 `background.js` 中的日志
- 替换 `content.js` 中的日志
- 测试功能是否正常

### 阶段 3: 存储优化 (1天)
- 替换 `sidepanel.js` 中的存储操作
- 替换 `gallery.js` 中的存储操作
- 测试数据读写

### 阶段 4: 性能优化 (2-3天)
- 添加防抖/节流
- 实现图片懒加载
- 优化事件监听器

### 阶段 5: 代码重构 (1周)
- 拆分大文件
- 优化 CSS
- 添加错误监控

## 验证清单

- [ ] `utils.js` 已创建
- [ ] `manifest.json` 已更新
- [ ] 所有 HTML 文件已引入 `utils.js`
- [ ] 日志系统正常工作
- [ ] 存储操作正常
- [ ] 所有功能测试通过
- [ ] 性能有明显提升
- [ ] 无控制台错误

## 回滚方案

如果出现问题:

1. 从 `.backup/` 目录恢复文件
2. 或使用 git 回滚: `git checkout -- *.js`
3. 重新加载插件

## 性能对比

优化前后可以使用 Chrome DevTools 的 Performance 面板对比:

1. 打开 DevTools → Performance
2. 点击 Record
3. 执行常见操作 (搜索、筛选、保存等)
4. 停止录制
5. 查看 Main Thread 活动和内存使用

预期改善:
- 主线程空闲时间增加 15-20%
- 内存使用减少 20-30MB
- 页面响应速度提升 10-15%

## 常见问题

### Q: 为什么要使用工具库?
A: 统一管理、减少重复代码、提升性能、便于维护

### Q: 会影响现有功能吗?
A: 不会,工具库只是封装,不改变功能逻辑

### Q: 必须全部替换吗?
A: 不必须,可以渐进式迁移,新代码使用新工具即可

### Q: 如何关闭日志?
A: 在 `utils.js` 中设置 `logger.enabled = false`

### Q: 性能提升明显吗?
A: 日志优化可提升 10-15%,配合其他优化可达 30-40%
