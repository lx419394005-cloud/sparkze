(function() {
  let currentHoveredImage = null;
  const badge = document.createElement('div');
  badge.className = 'picker-analyze-badge notranslate';
  badge.setAttribute('translate', 'no');
  badge.innerHTML = `
    <button class="picker-badge-action-btn picker-badge-main-btn" type="button" title="分析">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
      </svg>
    </button>
    <button class="picker-badge-action-btn picker-badge-settings-btn" type="button" title="设置">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
    <div class="picker-badge-menu" role="menu" aria-label="Badge 菜单">
      <button class="picker-badge-menu-item" type="button" data-action="move">移动</button>
      <button class="picker-badge-menu-item" type="button" data-action="save">收藏</button>
    </div>
  `;
  document.body.appendChild(badge);

  // Badge 拖拽功能
  let isMoveMode = false;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let lastAutoLeft = 0;
  let lastAutoTop = 0;
  let badgeOffsetX = 0;
  let badgeOffsetY = 0;

  const mainBtn = badge.querySelector('.picker-badge-main-btn');
  const settingsBtn = badge.querySelector('.picker-badge-settings-btn');
  const menuEl = badge.querySelector('.picker-badge-menu');
  let badgeMeasuredSize = null;

  chrome.storage.local.get(['badgeOffset']).then(({ badgeOffset }) => {
    if (badgeOffset && typeof badgeOffset.x === 'number' && typeof badgeOffset.y === 'number') {
      badgeOffsetX = badgeOffset.x;
      badgeOffsetY = badgeOffset.y;
    }
  }).catch(() => {});

  function closeMenu() {
    badge.classList.remove('menu-open');
  }

  function toggleMenu() {
    badge.classList.toggle('menu-open');
  }

  document.addEventListener('click', (e) => {
    if (!badge.classList.contains('menu-open')) return;
    if (badge.contains(e.target)) return;
    closeMenu();
  }, true);

  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  menuEl.addEventListener('click', (e) => {
    const item = e.target.closest('.picker-badge-menu-item');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    const action = item.dataset.action;
    closeMenu();

    if (action === 'move') {
      isMoveMode = true;
      badge.classList.add('move-mode');
      return;
    }

    if (action === 'save') {
      if (!currentHoveredImage) return;
      const imageUrl = getBestImageUrl(currentHoveredImage);
      if (!imageUrl) return;
      chrome.runtime.sendMessage({
        action: 'start_sidepanel_quick_save',
        imageUrl,
        pageUrl: window.location.href
      });
    }
  });

  function getExpandedBadgeSize() {
    if (badgeMeasuredSize) return badgeMeasuredSize;

    const prevDisplay = badge.style.display;
    const prevVisibility = badge.style.visibility;
    const prevLeft = badge.style.left;
    const prevTop = badge.style.top;

    badge.classList.add('force-expanded');
    badge.style.visibility = 'hidden';
    badge.style.display = 'flex';
    badge.style.left = '-9999px';
    badge.style.top = '-9999px';

    const rect = badge.getBoundingClientRect();
    badgeMeasuredSize = {
      width: rect.width || 80,
      height: rect.height || 32
    };

    badge.style.display = prevDisplay;
    badge.style.visibility = prevVisibility;
    badge.style.left = prevLeft;
    badge.style.top = prevTop;
    badge.classList.remove('force-expanded');

    return badgeMeasuredSize;
  }

  badge.addEventListener('mousedown', (e) => {
    if (!isMoveMode) return;
    if (e.button !== 0) return;
    if (!e.target.closest('.picker-analyze-badge')) return;
    isDragging = true;
    const rect = badge.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    badge.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;

    if (currentHoveredImage && typeof currentHoveredImage.getBoundingClientRect === 'function') {
      const rect = currentHoveredImage.getBoundingClientRect();
      const badgeSize = getExpandedBadgeSize();
      const minLeft = rect.left + window.scrollX;
      const minTop = rect.top + window.scrollY;
      const maxLeft = rect.left + window.scrollX + rect.width - badgeSize.width;
      const maxTop = rect.top + window.scrollY + rect.height - badgeSize.height;

      if (maxLeft < minLeft) newX = minLeft;
      else newX = Math.min(Math.max(newX, minLeft), maxLeft);

      if (maxTop < minTop) newY = minTop;
      else newY = Math.min(Math.max(newY, minTop), maxTop);
    }

    badge.style.left = `${newX}px`;
    badge.style.top = `${newY}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      badge.style.transition = 'opacity 0.2s ease, transform 0.2s ease, background 0.2s ease';
      if (isMoveMode) {
        const left = parseFloat(badge.style.left) || 0;
        const top = parseFloat(badge.style.top) || 0;
        badgeOffsetX = left - lastAutoLeft;
        badgeOffsetY = top - lastAutoTop;
        chrome.storage.local.set({ badgeOffset: { x: badgeOffsetX, y: badgeOffsetY } }).catch(() => {});
        isMoveMode = false;
        badge.classList.remove('move-mode');
      }
    }
  });

  // 1. 核心工具函数：解析 srcset 获取最高清 URL
  function getBestImageUrl(img) {
    let bestUrl = img.src;

    // 过滤掉无效 URL (CSS gradient, data URI 等)
    if (!bestUrl || !bestUrl.startsWith('http')) {
      bestUrl = null;
    }

    // 解析 srcset
    if (img.srcset) {
      try {
        const srcsetItems = img.srcset.split(',').map(item => {
          const parts = item.trim().split(/\s+/);
          const url = parts[0];
          let width = 0;
          if (parts[1]) {
            if (parts[1].endsWith('w')) width = parseInt(parts[1]);
            else if (parts[1].endsWith('x')) width = parseFloat(parts[1]) * 1000;
          }
          return { url, width };
        });

        // 过滤出有效的 http URL 并按宽度排序
        const validItems = srcsetItems.filter(item => item.url.startsWith('http'));
        if (validItems.length > 0) {
          validItems.sort((a, b) => b.width - a.width);
          bestUrl = validItems[0].url;
        }
      } catch (err) {
        console.warn('Sparkze: Failed to parse srcset', err);
      }
    }

    // 针对特定网站的 URL 优化
    if (bestUrl && bestUrl.includes('pinimg.com')) {
      bestUrl = bestUrl.replace(/\/(170x|236x|474x|736x)\//, '/originals/');
    } else if (bestUrl && bestUrl.includes('behance.net')) {
      bestUrl = bestUrl.replace(/\/project_modules\/(disp|max_1200|1400|max_1200_webp)\//, '/project_modules/source/');
    }

    return bestUrl;
  }

  // 2. 图片识别逻辑：支持 elementsFromPoint 穿透覆盖层
  let hideTimeout = null;
  let lastImage = null;

  function showBadge(el) {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    const imageUrl = getBestImageUrl(el);
    if (!imageUrl) {
      badge.style.display = 'none';
      badge.classList.remove('visible');
      currentHoveredImage = null;
      return;
    }

    currentHoveredImage = el;
    const rect = typeof el.getBoundingClientRect === 'function' 
      ? el.getBoundingClientRect() 
      : el.parentElement.getBoundingClientRect();
      
    const badgeSize = getExpandedBadgeSize();
    const badgeHeight = badgeSize.height;
    const badgeWidth = badgeSize.width;
    
    let top = rect.top + window.scrollY + 12;
    let left = rect.left + window.scrollX + 12;

    if (rect.width < 100 || rect.height < 100) {
      top = rect.top + window.scrollY + 2;
      left = rect.left + window.scrollX + 2;
    }

    lastAutoLeft = left;
    lastAutoTop = top;

    left += badgeOffsetX;
    top += badgeOffsetY;

    const minLeft = rect.left + window.scrollX;
    const minTop = rect.top + window.scrollY;
    const maxLeft = rect.left + window.scrollX + rect.width - badgeWidth;
    const maxTop = rect.top + window.scrollY + rect.height - badgeHeight;

    if (maxLeft < minLeft) left = minLeft;
    else left = Math.min(Math.max(left, minLeft), maxLeft);

    if (maxTop < minTop) top = minTop;
    else top = Math.min(Math.max(top, minTop), maxTop);

    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;
    badge.style.display = 'flex';
    badge.offsetHeight;
    badge.classList.add('visible');
  }

  function hideBadge() {
    if (hideTimeout) return;
    hideTimeout = setTimeout(() => {
      badge.classList.remove('visible');
      setTimeout(() => {
        if (!badge.classList.contains('visible')) {
          badge.style.display = 'none';
        }
      }, 300);
      currentHoveredImage = null;
      lastImage = null;
      hideTimeout = null;
    }, 400);
  }

  // 节流处理 - 优化性能
  const throttledMouseMove = (() => {
    let timer = null;
    return (e) => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        handleMouseMove(e);
      }, 50);
    };
  })();

  function handleMouseMove(e) {
    if (isDragging || isMoveMode) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let foundImage = null;

    for (const el of elements) {
      if (el === badge || badge.contains(el)) {
        // 如果鼠标在 badge 上,保持显示
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        return;
      }
      
      if (el.tagName === 'IMG') {
        if (el.offsetWidth > 150 || el.naturalWidth > 150) {
          foundImage = el;
          break;
        }
      }
      // 处理一些将图片设为 background-image 的情况
      const style = window.getComputedStyle(el);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        if (el.offsetWidth > 200 && el.offsetHeight > 200) {
          const bgUrl = style.backgroundImage.slice(4, -1).replace(/"/g, "");
          foundImage = { 
            src: bgUrl, 
            getBoundingClientRect: () => el.getBoundingClientRect(),
            offsetWidth: el.offsetWidth,
            naturalWidth: el.offsetWidth,
            parentElement: el
          };
          break;
        }
      }
    }

    if (foundImage) {
      if (lastImage !== foundImage) {
        lastImage = foundImage;
        showBadge(foundImage);
      } else {
        // 同一张图,如果 hideTimeout 存在则清除
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
      }
    } else {
      hideBadge();
    }
  }

  document.addEventListener('mousemove', throttledMouseMove);

  // 处理分析点击 (整个 badge 区域)
  badge.addEventListener('click', (e) => {
    console.log('[Sparkze] Badge clicked');
    // 如果点在设置按钮或菜单里，由它们自己的监听器处理
    if (e.target.closest('.picker-badge-settings-btn') || e.target.closest('.picker-badge-menu')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (isDragging) return;
    
    // 如果是在移动模式，点击任何地方都退出移动模式
    if (isMoveMode) {
      console.log('[Sparkze] Exit move mode via click');
      isMoveMode = false;
      badge.classList.remove('move-mode');
      return;
    }

    if (!currentHoveredImage) {
      console.warn('[Sparkze] No hovered image when clicked');
      return;
    }

    const imageUrl = getBestImageUrl(currentHoveredImage);
    if (!imageUrl) {
      console.warn('[Sparkze] Could not resolve image URL');
      return;
    }

    const pageUrl = window.location.href;
    console.log('[Sparkze] Triggering analysis for:', imageUrl);
    console.log('[Sparkze] Sending start_sidepanel_analysis message', { imageUrl, pageUrl });

    // 不再在当前页面显示弹窗，而是通知 background 打开 sidepanel 并开始分析
    chrome.runtime.sendMessage({
      action: 'start_sidepanel_analysis',
      imageUrl: imageUrl,
      pageUrl: pageUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Sparkze] Send message failed:', chrome.runtime.lastError);
      } else {
        console.log('[Sparkze] Message response:', response);
      }
    });
  });

  // 3. 弹窗逻辑 (已弃用，功能已迁移至 sidepanel)
  // function showModal(imageUrl) { ... }
})();
