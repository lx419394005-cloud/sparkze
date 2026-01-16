// ============================================
// Sparkze Utils - 公共工具函数库
// ============================================

const SparkzeUtils = {
  // 日志管理 - 生产环境可关闭
  logger: {
    enabled: true, // 设为 false 可关闭所有日志
    log(...args) {
      if (this.enabled) console.log('[Sparkze]', ...args);
    },
    warn(...args) {
      if (this.enabled) console.warn('[Sparkze]', ...args);
    },
    error(...args) {
      console.error('[Sparkze]', ...args); // 错误始终输出
    }
  },

  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  // 节流函数
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // 统一的存储操作
  storage: {
    async get(keys) {
      try {
        return await chrome.storage.local.get(keys);
      } catch (error) {
        SparkzeUtils.logger.error('Storage get failed:', error);
        return {};
      }
    },
    
    async set(items) {
      try {
        await chrome.storage.local.set(items);
        return true;
      } catch (error) {
        SparkzeUtils.logger.error('Storage set failed:', error);
        return false;
      }
    },

    async remove(keys) {
      try {
        await chrome.storage.local.remove(keys);
        return true;
      } catch (error) {
        SparkzeUtils.logger.error('Storage remove failed:', error);
        return false;
      }
    }
  },

  // 统一的消息传递
  messaging: {
    async send(message) {
      try {
        return await chrome.runtime.sendMessage(message);
      } catch (error) {
        SparkzeUtils.logger.error('Message send failed:', error);
        throw error;
      }
    },

    onMessage(callback) {
      return chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const result = callback(request, sender);
        if (result instanceof Promise) {
          result.then(sendResponse).catch(err => {
            SparkzeUtils.logger.error('Message handler error:', err);
            sendResponse({ success: false, error: err.message });
          });
          return true; // 异步响应
        }
        return false;
      });
    }
  },

  // DOM 操作辅助
  dom: {
    // 缓存 DOM 查询
    cache: new Map(),
    
    $(selector, useCache = true) {
      if (useCache && this.cache.has(selector)) {
        return this.cache.get(selector);
      }
      const el = document.querySelector(selector);
      if (useCache && el) this.cache.set(selector, el);
      return el;
    },

    $$(selector) {
      return document.querySelectorAll(selector);
    },

    clearCache() {
      this.cache.clear();
    },

    // 创建元素
    create(tag, attrs = {}, children = []) {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') el.className = value;
        else if (key === 'innerHTML') el.innerHTML = value;
        else el.setAttribute(key, value);
      });
      children.forEach(child => {
        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
        else el.appendChild(child);
      });
      return el;
    }
  },

  // 图片 URL 优化
  image: {
    getBestUrl(img) {
      if (!img) return null;

      // 特殊网站处理
      const url = img.src || img.currentSrc;
      if (!url) return null;

      // Pinterest 优化
      if (url.includes('pinimg.com')) {
        return url.replace(/\/\d+x/, '/originals');
      }

      // Behance 优化
      if (url.includes('behance.net')) {
        return url.replace(/\/\d+\//, '/max_4096/');
      }

      // Instagram 优化
      if (url.includes('cdninstagram.com')) {
        return url.split('?')[0];
      }

      // 处理 srcset
      if (img.srcset) {
        const sources = img.srcset.split(',').map(s => {
          const [url, size] = s.trim().split(' ');
          return { url, size: parseInt(size) || 0 };
        });
        sources.sort((a, b) => b.size - a.size);
        return sources[0]?.url || url;
      }

      return url;
    },

    // 预加载图片
    preload(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }
  },

  // Toast 通知
  toast: {
    show(message, type = 'info', duration = 3000) {
      const toast = SparkzeUtils.dom.create('div', {
        className: `sparkze-toast sparkze-toast-${type}`,
        innerHTML: message
      });
      
      document.body.appendChild(toast);
      
      // 触发动画
      requestAnimationFrame(() => toast.classList.add('show'));
      
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    success(message) {
      this.show(message, 'success');
    },

    error(message) {
      this.show(message, 'error');
    },

    info(message) {
      this.show(message, 'info');
    }
  },

  // 数据验证
  validate: {
    isValidUrl(string) {
      try {
        new URL(string);
        return true;
      } catch {
        return false;
      }
    },

    isImageUrl(url) {
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || 
             url.includes('image') || 
             url.includes('img');
    }
  },

  // 时间格式化
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
    
    return date.toLocaleDateString('zh-CN');
  },

  // 错误处理
  handleError(error, context = '') {
    this.logger.error(`Error in ${context}:`, error);
    this.toast.error(`操作失败: ${error.message || '未知错误'}`);
  }
};

// 导出到全局
if (typeof window !== 'undefined') {
  window.SparkzeUtils = SparkzeUtils;
}
