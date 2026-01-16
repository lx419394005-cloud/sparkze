let allSavedImages = [];
let currentSearchTerm = '';
let currentFilter = { type: null, value: null }; // type: 'tag' | 'artist'
let manualTags = []; // 存储手动添加的标签
let currentAnalysisData = null; // 缓存当前的分析数据
let analysisTimer = null;
let analysisElapsedSeconds = 0;
let analysisTimeoutWarningShown = false;
let currentQuickSaveDraft = null;
let quickSaveTags = [];

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadAndRender();
  checkCurrentAnalysis();
  checkCurrentQuickSave();
  initTabSwitching();
});

// Tab 切换功能
function initTabSwitching() {
  document.querySelectorAll('.sidepanel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // 更新 active 状态
      document.querySelectorAll('.sidepanel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (tabName === 'draw') {
        window.location.href = 'draw.html';
      } else if (tabName === 'wiki') {
        showWikiView();
      } else if (tabName === 'gallery') {
        showMainView();
      }
    });
  });
}

function initEventListeners() {
  SparkzeUtils.logger.log('Initializing event listeners...');
  const searchInput = document.getElementById('sidepanel-search');
  const clearSearchBtn = document.getElementById('clear-search');
  const removeFilterBtn = document.getElementById('remove-filter');
  const openGalleryBtn = document.getElementById('open-gallery');

  // 全局点击监听，用于调试
  document.addEventListener('click', (e) => {
    SparkzeUtils.logger.log('Global click:', e.target);
  });

  const debouncedSearch = SparkzeUtils.debounce((value) => {
    currentSearchTerm = value.toLowerCase();
    renderUI();
  }, 300);

  searchInput.addEventListener('input', (e) => {
    const value = e.target.value;
    clearSearchBtn.style.display = value ? 'flex' : 'none';
    debouncedSearch(value);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchTerm = '';
    clearSearchBtn.style.display = 'none';
    renderUI();
  });

  removeFilterBtn.addEventListener('click', () => {
    currentFilter = { type: null, value: null };
    document.getElementById('filter-indicator').style.display = 'none';
    renderUI();
  });

  openGalleryBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'gallery.html' });
  });

  // 处理列表区域的所有交互 (事件委托)
  const listContainer = document.getElementById('image-list');
  listContainer.addEventListener('click', (e) => {
    const target = e.target;

    // 1. 处理卡片点击进入详情视图 (布局对齐)
    const imageWrapper = target.closest('.card-image-wrapper');
    if (imageWrapper) {
      const card = target.closest('.image-card');
      const index = Array.from(listContainer.querySelectorAll('.image-card')).indexOf(card);
      // 获取当前显示的过滤后的图片
      const filteredImages = getFilteredImages();
      const imgData = filteredImages[index];
      
      if (imgData) {
        SparkzeUtils.logger.log('Card clicked, showing detailed view:', imgData);
        renderAnalysis({
          stage: 'success',
          imageUrl: imgData.imageUrl,
          pageUrl: imgData.pageUrl,
          data: imgData, // imgData 结构与 status.data 兼容
          isSavedView: true // 标记这是查看已收藏的图片
        });
      }
      return;
    }

    // 2. 处理重置按钮
    if (target.classList.contains('reset-filters-btn')) {
      resetAllFilters();
      return;
    }

    // 3. 处理标签点击过滤
    const tagEl = target.closest('.card-tag');
    if (tagEl) {
      e.stopPropagation();
      const tagValue = tagEl.dataset.value;
      if (tagValue) setFilter('tag', tagValue);
      return;
    }

    // 4. 处理复制按钮
    const copyBtn = target.closest('.tag-copy-btn, .copy-btn-inline');
    if (copyBtn) {
      e.stopPropagation();
      const textToCopy = copyBtn.dataset.copy;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalTitle = copyBtn.title;
          copyBtn.title = '已复制！';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.title = originalTitle;
            copyBtn.classList.remove('copied');
          }, 1500);
        });
      }
      return;
    }

    // 5. 处理艺术家点击过滤
    const masterEl = target.closest('.card-master-tag');
    if (masterEl) {
      e.stopPropagation();
      const artistName = masterEl.dataset.value;
      if (artistName) setFilter('artist', artistName);
      return;
    }

    // 6. 处理删除事件
    const deleteBtn = target.closest('.card-btn-delete');
    if (deleteBtn) {
      e.stopPropagation();
      if (confirm('确定要删除这条收藏吗？')) {
        const index = parseInt(deleteBtn.dataset.index);
        if (!isNaN(index)) {
          allSavedImages.splice(index, 1);
          chrome.storage.local.set({ savedImages: allSavedImages });
          // renderUI() 会被 storage.onChanged 触发
        }
      }
      return;
    }
  });

  // 监听来自 background 的分析更新
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'analysis_update') {
      renderAnalysis(message.status);
    }
    if (message.action === 'analysis_cancelled') {
      showMainView();
    }
    if (message.action === 'quick_save_start') {
      currentQuickSaveDraft = message.draft || null;
      quickSaveTags = [];
      renderQuickSave(currentQuickSaveDraft);
    }
  });

  // 处理分析视图中的交互 (事件委托)
  // 我们使用 document 级别的事件委托，因为 analysis-view 可能在某些情况下被替换或重新渲染
  document.addEventListener('click', (e) => {
    const target = e.target;
    
    // 检查点击是否发生在 analysis-view 内
    const analysisView = document.getElementById('analysis-view');
    if (!analysisView || !analysisView.contains(target)) return;

    SparkzeUtils.logger.log('Analysis view click detected:', target);
    
    if (target.id === 'back-to-main' || target.closest('#back-to-main')) {
      showMainView();
      return;
    }

    if (target.id === 'save-analysis' || target.closest('#save-analysis')) {
      saveCurrentAnalysis();
      return;
    }

    if (target.id === 'cancel-analysis-btn' || target.closest('#cancel-analysis-btn')) {
      cancelAnalysis();
      return;
    }

    // 处理摘要和 Prompt 的一键复制
    const inlineCopyBtn = target.closest('.copy-btn-inline');
    if (inlineCopyBtn) {
      const textToCopy = inlineCopyBtn.dataset.copy;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalTitle = inlineCopyBtn.title;
          inlineCopyBtn.title = '已复制！';
          inlineCopyBtn.classList.add('copied');
          setTimeout(() => {
            inlineCopyBtn.title = originalTitle;
            inlineCopyBtn.classList.remove('copied');
          }, 1500);
        });
      }
      return;
    }

    if (target.id === 'quick-save-confirm' || target.closest('#quick-save-confirm')) {
      saveQuickSave();
      return;
    }

    // 处理 Pinterest 建议点击
    const chip = target.closest('.picker-search-chip');
    if (chip) {
      const searchUrl = chip.href;
      SparkzeUtils.logger.log(`发起 Pinterest 建议搜索: "${searchUrl}"`);
      chrome.tabs.create({ url: searchUrl });
      e.preventDefault();
      return;
    }

    if (target.id === 'quick-add-tag-btn' || target.closest('#quick-add-tag-btn')) {
      const zhInput = document.getElementById('quick-tag-zh-input');
      const enInput = document.getElementById('quick-tag-en-input');

      const zh = zhInput?.value.trim();
      if (!zh) {
        zhInput?.focus();
        return;
      }

      quickSaveTags.push({ zh, en: enInput?.value.trim() || '' });
      if (zhInput) zhInput.value = '';
      if (enInput) enInput.value = '';
      refreshQuickTags();
      return;
    }

    // 处理添加标签按钮
    if (target.id === 'add-tag-btn' || target.closest('#add-tag-btn')) {
      const zhInput = document.getElementById('tag-zh-input');
      const enInput = document.getElementById('tag-en-input');

      const zh = zhInput.value.trim();
      if (!zh) {
        zhInput.focus();
        return;
      }

      // 添加标签
      manualTags.push({ zh, en: enInput.value.trim(), isManual: true });

      // 清空输入框
      zhInput.value = '';
      enInput.value = '';

      // 重新渲染标签区域
      refreshTags();
      return;
    }

    // 处理删除标签
    const deleteBtn = target.closest('.tag-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      if (deleteBtn.dataset.quickIndex != null) {
        const index = parseInt(deleteBtn.dataset.quickIndex);
        if (!isNaN(index) && index >= 0 && index < quickSaveTags.length) {
          quickSaveTags.splice(index, 1);
          refreshQuickTags();
        }
      } else {
        const index = parseInt(deleteBtn.dataset.manualIndex);
        if (!isNaN(index) && index >= 0 && index < manualTags.length) {
          manualTags.splice(index, 1);
          refreshTags();
        }
      }
      return;
    }

    const tagLink = target.closest('a.analysis-tag');
    if (tagLink) {
      e.preventDefault();
      const tagZh = tagLink.querySelector('.tag-zh')?.innerText;
      const tagEn = tagLink.querySelector('.tag-en')?.innerText;
      const query = (tagEn || tagZh || tagLink.innerText || "").trim();
      if (!query) return;
      const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
      chrome.tabs.create({ url: searchUrl, active: true });
      return;
    }
  });

  // 处理图标加载失败 (CSP 合规)
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.classList.contains('source-favicon')) {
      e.target.style.display = 'none';
    }
  }, true);
}

function cancelAnalysis() {
  stopAnalysisTimer();
  chrome.runtime.sendMessage({ action: 'cancel_analysis' });
  showMainView();
}

// 计时器相关函数
function startAnalysisTimer() {
  analysisElapsedSeconds = 0;
  analysisTimeoutWarningShown = false;
  updateTimerDisplay();

  if (analysisTimer) clearInterval(analysisTimer);

  analysisTimer = setInterval(() => {
    analysisElapsedSeconds++;
    updateTimerDisplay();
    checkTimeoutWarning();
  }, 1000);
}

function stopAnalysisTimer() {
  if (analysisTimer) {
    clearInterval(analysisTimer);
    analysisTimer = null;
  }
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const timerEl = document.querySelector('.analysis-loading-container .analysis-timer');
  if (timerEl) {
    timerEl.innerText = formatTimer(analysisElapsedSeconds);
  }
}

function checkTimeoutWarning() {
  // 40秒后显示超时警告
  if (analysisElapsedSeconds >= 40 && !analysisTimeoutWarningShown) {
    analysisTimeoutWarningShown = true;
    const warningEl = document.querySelector('.analysis-loading-container .timeout-warning');
    if (warningEl) {
      warningEl.style.display = 'block';
    }
  }
}

async function checkCurrentAnalysis() {
  const { currentAnalysis } = await chrome.storage.local.get('currentAnalysis');
  // 如果分析是在 5 分钟内发起的，则显示它
  if (currentAnalysis && Date.now() - currentAnalysis.timestamp < 5 * 60 * 1000) {
    renderAnalysis(currentAnalysis);
  }
}

async function checkCurrentQuickSave() {
  const { currentQuickSave } = await chrome.storage.local.get('currentQuickSave');
  if (currentQuickSave && Date.now() - currentQuickSave.timestamp < 5 * 60 * 1000) {
    currentQuickSaveDraft = currentQuickSave;
    quickSaveTags = [];
    renderQuickSave(currentQuickSave);
  }
}

function showMainView() {
  stopAnalysisTimer();
  document.getElementById('main-view').style.display = 'flex';
  document.getElementById('analysis-view').style.display = 'none';
  const wikiView = document.getElementById('wiki-view');
  if (wikiView) wikiView.style.display = 'none';
  
  chrome.storage.local.remove('currentAnalysis');
  chrome.storage.local.remove('currentQuickSave');
  manualTags = []; // 清空手动标签
  currentAnalysisData = null; // 清空缓存数据
  currentQuickSaveDraft = null;
  quickSaveTags = [];
}

function showAnalysisView() {
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('analysis-view').style.display = 'flex';
  const wikiView = document.getElementById('wiki-view');
  if (wikiView) wikiView.style.display = 'none';
}

function showWikiView() {
  stopAnalysisTimer();
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('analysis-view').style.display = 'none';
  const wikiView = document.getElementById('wiki-view');
  if (wikiView) {
    wikiView.style.display = 'block';
    renderWikiView();
  }
}

function renderWikiView() {
  const wikiView = document.getElementById('wiki-view');
  if (!wikiView) return;

  // 收集所有 Tag
  const tagMap = new Map();
  allSavedImages.forEach(img => {
    if (img.tags && Array.isArray(img.tags)) {
      img.tags.forEach(tag => {
        const key = tag.zh; // 以中文名为 key 去重
        if (!tagMap.has(key)) {
          tagMap.set(key, tag);
        }
      });
    }
  });
  
  const tags = Array.from(tagMap.values());
  
  if (tags.length === 0) {
    wikiView.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: #94a3b8;">暂无标签数据</div>';
    return;
  }

  wikiView.innerHTML = `
    <div class="wiki-container" style="padding: 16px;">
        <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #cbd5e1;">全量标签库 (${tags.length})</h3>
        <div class="tags-grid" style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${tags.map(t => `
                <a href="https://www.pinterest.com/search/pins/?q=${encodeURIComponent(t.en || t.zh)}" 
                   class="analysis-tag" 
                   target="_blank"
                   title="${t.wiki || '点击在 Pinterest 搜索'}"
                   style="text-decoration: none;">
                    <span class="tag-zh">${t.zh}</span>
                    <span class="tag-en">${t.en || ''}</span>
                </a>
            `).join('')}
        </div>
    </div>
  `;
}

// 刷新标签显示
function refreshTags() {
  const tagsContainer = document.getElementById('tags-container');
  if (!tagsContainer) return;

  // 获取当前 AI 分析的标签 (从内存缓存获取)
  const aiTags = currentAnalysisData?.tags || [];

  // 渲染 AI 标签
  const aiTagsHtml = aiTags.map(t => `
    <a href="https://www.pinterest.com/search/pins/?q=${encodeURIComponent(t.en || t.zh)}"
       class="analysis-tag"
       title="${t.wiki || ''}"
       target="_blank">
      <span class="tag-zh">${t.zh}</span>
      <span class="tag-en">${t.en || ''}</span>
    </a>
  `).join('');

  // 渲染手动标签
  const manualTagsHtml = manualTags.map((tag, index) => `
    <span class="analysis-tag manual-tag" data-manual-index="${index}">
      <span class="tag-zh">${tag.zh}</span>
      <span class="tag-en">${tag.en || ''}</span>
      <button class="tag-delete-btn" data-manual-index="${index}" title="删除标签">&times;</button>
    </span>
  `).join('');

  tagsContainer.innerHTML = aiTagsHtml + manualTagsHtml;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function refreshQuickTags() {
  const container = document.getElementById('quick-tags-container');
  if (!container) return;
  container.innerHTML = quickSaveTags.map((tag, index) => `
    <span class="analysis-tag manual-tag" data-no-search="1">
      <span class="tag-zh">${escapeHtml(tag.zh)}</span>
      <span class="tag-en">${escapeHtml(tag.en || '')}</span>
      <button class="tag-delete-btn" data-quick-index="${index}" title="删除标签">&times;</button>
    </span>
  `).join('');
}

function renderQuickSave(draft) {
  if (!draft || !draft.imageUrl) return;
  stopAnalysisTimer();
  showAnalysisView();

  const container = document.getElementById('analysis-view');
  container.innerHTML = `
    <div class="analysis-result-container">
      <div class="analysis-header">
        <button id="back-to-main" class="back-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"></path>
          </svg>
        </button>
        <span>快速收藏</span>
        <button id="quick-save-confirm" class="save-btn">保存到灵感库</button>
      </div>
      <div class="analysis-scroll-content">
        <div class="analysis-preview-img">
          <img src="${draft.imageUrl}" alt="Preview">
          <span class="class-badge">快速收藏</span>
        </div>

        <div class="analysis-section">
          <div class="section-header">
            <span class="section-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
            </span>
            <h3>分类</h3>
          </div>
          <div class="add-tag-form">
            <input type="text" class="add-tag-input" id="quick-category-input" placeholder="输入分类（可选）" value="${escapeHtml(draft.category || '')}">
          </div>
        </div>

        <div class="analysis-section">
          <div class="section-header">
            <span class="section-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 12H4"></path>
                <path d="M12 20V4"></path>
              </svg>
            </span>
            <h3>标签</h3>
          </div>
          <div class="tags-grid" id="quick-tags-container"></div>
          <div class="add-tag-form">
            <input type="text" class="add-tag-input" id="quick-tag-zh-input" placeholder="中文标签名">
            <input type="text" class="add-tag-input" id="quick-tag-en-input" placeholder="英文标签名 (可选)">
            <button class="add-tag-btn" id="quick-add-tag-btn">添加</button>
          </div>
        </div>
      </div>
    </div>
  `;
  refreshQuickTags();
}

function renderAnalysis(status) {
  SparkzeUtils.logger.log('Rendering analysis view, stage:', status.stage);
  showAnalysisView();
  const container = document.getElementById('analysis-view');

  if (status.stage === 'loading') {
    // 检查是否已经存在 loading 容器，如果是，只更新文字、进度条和流式内容，避免图片闪烁
    let loadingContainer = container.querySelector('.analysis-loading-container');
    if (loadingContainer) {
      const statusMain = loadingContainer.querySelector('.picker-status-text');
      const statusDetail = loadingContainer.querySelector('.picker-detail-text');
      const progressBar = loadingContainer.querySelector('.picker-progress-bar');
      const timerEl = loadingContainer.querySelector('.analysis-timer');
      const marqueeContent = loadingContainer.querySelector('.streaming-marquee-content');

      if (statusMain) statusMain.innerText = status.statusText;
      if (statusDetail) statusDetail.innerText = status.detailText;
      if (progressBar) progressBar.style.width = `${status.progress}%`;
      if (timerEl) timerEl.innerText = formatTimer(analysisElapsedSeconds);

      if (marqueeContent && typeof status.streamingContent === 'string') {
        const text = status.streamingContent.trim();
        marqueeContent.classList.toggle('has-content', text.length > 0);

        if (text.length > 0) {
          marqueeContent.textContent = status.streamingContent;
          marqueeContent.scrollTop = marqueeContent.scrollHeight;

          marqueeContent.classList.remove('scrolling');
          marqueeContent.classList.remove('paused');

          marqueeContent.classList.remove('updated');
          marqueeContent.offsetHeight;
          marqueeContent.classList.add('updated');

          clearTimeout(marqueeContent._updatedTimer);
          marqueeContent._updatedTimer = setTimeout(() => {
            marqueeContent.classList.remove('updated');
          }, 260);
        }
      }

      // 检查超时警告
      checkTimeoutWarning();
      return;
    }

    // 首次进入 loading 状态，启动计时器
    startAnalysisTimer();

    container.innerHTML = `
      <div class="analysis-loading-container">
        <div class="analysis-header">
          <button id="back-to-main" class="back-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          <span>AI 视觉分析中</span>
        </div>
        <div class="analysis-preview-img">
          <img src="${status.imageUrl}" alt="Preview">
        </div>
        <div class="analysis-status-card" style="text-align: center; padding: 30px 20px;">
          <div class="picker-loading-icon">
            <div class="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="picker-status-text">${status.statusText}</div>
          <div class="picker-detail-text">${status.detailText}</div>
          <div class="picker-progress-container">
            <div class="picker-progress-bar" style="width: ${status.progress}%"></div>
          </div>
          <!-- 流式内容滚动区域 -->
          <div class="streaming-marquee-container">
            <div class="streaming-marquee-label">AI 正在思考</div>
            <div class="streaming-marquee-content">
              <span class="streaming-placeholder">等待模型响应...</span>
            </div>
          </div>
          <div class="loading-info-row">
            <span class="analysis-timer">0:00</span>
            <span class="loading-estimate">预计等待约 40 秒</span>
          </div>
          <div class="loading-tips">深度视觉解构中，请稍候...</div>
          <div class="timeout-warning" style="display: none;">⚠️ 分析时间较长，请耐心等待</div>
          <button id="cancel-analysis-btn" class="cancel-analysis-btn">取消分析</button>
        </div>
      </div>
    `;
  } else if (status.stage === 'success') {
    // 分析成功，停止计时器
    stopAnalysisTimer();
    const data = status.data;
    // 更新缓存数据
    currentAnalysisData = data;
    
    // 确保 storage 中的数据也是最新的，防止刷新丢失
    chrome.storage.local.set({ 
      currentAnalysis: { 
        ...status, 
        timestamp: Date.now() 
      }
    });
    
    const classMap = {
      'COMMERCIAL_FASHION': '商业时尚', 'PORTRAIT': '人物肖像', 'PRODUCT': '静物产品',
      'LANDSCAPE': '自然风光', 'CONCEPT_CROWD': '创意/人群', 'ARCHITECTURE': '建筑空间',
      'ART': '艺术插画', 'DESIGN': '平面设计'
    };
    const displayClass = classMap[data.determined_class] || data.determined_class;

    // 如果是新分析视图，清空手动标签
    if (!status.isSavedView) {
      manualTags = [];
    }

    // 自动为旧图片生成建议关键词 (降级逻辑)
    let displayChips = data.pinterest_search_chips || [];
    if (displayChips.length === 0 && data.tags && data.tags.length > 0) {
      displayChips = data.tags.slice(0, 3).map(t => ({
        label: t.zh,
        query: t.en || t.zh
      }));
    }

    container.innerHTML = `
      <div class="analysis-result-container">
        <div class="analysis-header">
          <button id="back-to-main" class="back-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          <span>${status.isSavedView ? '灵感详情' : '分析结果'}</span>
          ${status.isSavedView ? '' : '<button id="save-analysis" class="save-btn">收藏灵感</button>'}
        </div>
        <div class="analysis-scroll-content">
          <div class="analysis-preview-img">
            <img src="${status.imageUrl}" alt="Preview">
            <span class="class-badge">${displayClass}</span>
          </div>

          <!-- 核心摘要 -->
          <div class="analysis-section summary-section">
            <div class="section-header">
              <span class="section-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </span>
              <h3>核心摘要</h3>
            </div>
            <div class="summary-text-wrapper">
              <p class="summary-text">${data.analysis_summary.replace(/\d\./g, '<br>$&')}</p>
              <button class="copy-btn-inline" data-copy="${data.analysis_summary.replace(/"/g, '&quot;')}" title="复制摘要">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="analysis-section">
            <div class="section-header">
              <span class="section-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
              </span>
              <h3>视觉标签</h3>
            </div>
            <div class="tags-grid" id="tags-container">
              ${data.tags.map(t => `
                <a href="https://www.pinterest.com/search/pins/?q=${encodeURIComponent(t.en || t.zh)}"
                   class="analysis-tag${t.isManual ? ' manual-tag' : ''}"
                   title="${t.wiki || ''}"
                   target="_blank">
                  <span class="tag-zh">${t.zh}</span>
                  <span class="tag-en">${t.en || ''}</span>
                </a>
              `).join('')}
              ${manualTags.map((tag, index) => `
                <span class="analysis-tag manual-tag" data-manual-index="${index}">
                  <span class="tag-zh">${tag.zh}</span>
                  <span class="tag-en">${tag.en || ''}</span>
                  <button class="tag-delete-btn" data-manual-index="${index}" title="删除标签">&times;</button>
                </span>
              `).join('')}
            </div>
            <div class="add-tag-form">
              <input type="text" class="add-tag-input" id="tag-zh-input" placeholder="中文标签名">
              <input type="text" class="add-tag-input" id="tag-en-input" placeholder="英文标签名 (可选)">
              <button class="add-tag-btn" id="add-tag-btn">添加</button>
            </div>
          </div>

          <div class="analysis-section">
            <div class="section-header">
              <span class="section-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="6"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                </svg>
              </span>
              <h3>风格溯源</h3>
            </div>
            ${data.style_masters.map(m => `
              <div class="master-card">
                <div class="master-name">${m.name}</div>
                <div class="master-reason">${m.reason}</div>
              </div>
            `).join('')}
          </div>

          ${displayChips.length > 0 ? `
          <div class="analysis-section">
            <div class="section-header">
              <span class="section-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <h3>Pinterest 搜索建议</h3>
            </div>
            <div class="picker-search-chips">
              ${displayChips.map(chip => `
                <a href="https://www.pinterest.com/search/pins/?q=${encodeURIComponent(chip.query)}" class="picker-search-chip" target="_blank">
                  <img src="https://www.pinterest.com/favicon.ico" alt="P">
                  <span>${chip.label}</span>
                </a>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- 提示词建议 -->
          <div class="analysis-section prompt-section">
            <div class="section-header">
              <span class="section-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </span>
              <h3>AI 提示词</h3>
            </div>
            <div class="prompt-box-wrapper">
              <div class="prompt-box">${data.ai_drawing_prompt}</div>
              <button class="copy-btn-inline" data-copy="${data.ai_drawing_prompt.replace(/"/g, '&quot;')}" title="复制提示词">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (status.stage === 'error') {
    stopAnalysisTimer();
    container.innerHTML = `
      <div class="analysis-error-container">
        <div class="analysis-header">
          <button id="back-to-main" class="back-btn">返回</button>
          <span>分析出错</span>
        </div>
        <div class="error-card">
          <div class="error-icon">⚠️</div>
          <div class="error-text">${status.detailText}</div>
          <button id="retry-analysis" class="retry-btn" onclick="window.location.reload()">重试</button>
        </div>
      </div>
    `;
  }
}

async function saveCurrentAnalysis() {
  const { currentAnalysis } = await chrome.storage.local.get('currentAnalysis');
  if (!currentAnalysis || currentAnalysis.stage !== 'success') return;

  const saveBtn = document.getElementById('save-analysis');
  saveBtn.innerText = '正在保存...';
  saveBtn.disabled = true;

  // 合并 AI 标签和手动标签
  const aiTags = currentAnalysis.data.tags || [];
  const allTags = [...aiTags, ...manualTags];

  const imageData = {
    imageUrl: currentAnalysis.imageUrl,
    pageUrl: currentAnalysis.pageUrl,
    ...currentAnalysis.data,
    tags: allTags, // 使用合并后的标签
    timestamp: Date.now()
  };

  chrome.runtime.sendMessage({ action: 'save_image', imageData }, (response) => {
    if (response && response.success) {
      saveBtn.innerText = '已收藏';
      setTimeout(() => {
        showMainView();
        loadAndRender();
      }, 1000);
    } else {
      saveBtn.innerText = '保存失败';
      saveBtn.disabled = false;
    }
  });
}

async function saveQuickSave() {
  const { currentQuickSave } = await chrome.storage.local.get('currentQuickSave');
  const draft = currentQuickSaveDraft || currentQuickSave;
  if (!draft || !draft.imageUrl) return;

  const saveBtn = document.getElementById('quick-save-confirm');
  if (saveBtn) {
    saveBtn.innerText = '正在保存...';
    saveBtn.disabled = true;
  }

  const categoryValue = document.getElementById('quick-category-input')?.value.trim() || '';
  const tags = quickSaveTags.map(t => ({
    zh: (t.zh || '').trim(),
    en: (t.en || '').trim(),
    wiki: ''
  })).filter(t => t.zh);

  const imageData = {
    imageUrl: draft.imageUrl,
    pageUrl: draft.pageUrl,
    determined_class: 'QUICK_SAVE',
    analysis_summary: '（快速收藏：未进行 AI 分析）',
    tags,
    style_masters: [],
    pinterest_search_chips: [],
    ai_drawing_prompt: '',
    category: categoryValue,
    isQuickSave: true,
    timestamp: Date.now()
  };

  chrome.runtime.sendMessage({ action: 'save_image', imageData }, (response) => {
    if (response && response.success) {
      if (saveBtn) saveBtn.innerText = '已保存';
      setTimeout(() => {
        showMainView();
        loadAndRender();
      }, 600);
    } else {
      if (saveBtn) {
        saveBtn.innerText = '保存失败';
        saveBtn.disabled = false;
      }
    }
  });
}

async function loadAndRender() {
  const { savedImages = [] } = await chrome.storage.local.get('savedImages');
  allSavedImages = savedImages;
  renderUI();
}

function getFilteredImages() {
  return allSavedImages.filter(img => {
    const tags = Array.isArray(img.tags) ? img.tags : [];
    const masters = Array.isArray(img.style_masters) ? img.style_masters : [];
    // 1. 标签/艺术家 过滤
    if (currentFilter.type === 'tag') {
      if (!tags.some(t => t.zh === currentFilter.value || t.en === currentFilter.value)) return false;
    } else if (currentFilter.type === 'artist') {
      if (!masters.some(m => m.name === currentFilter.value)) return false;
    }

    // 2. 搜索过滤
    if (currentSearchTerm) {
      const searchMatch = 
        (img.analysis_summary && img.analysis_summary.toLowerCase().includes(currentSearchTerm)) ||
        tags.some(t => (t.zh || '').toLowerCase().includes(currentSearchTerm) || (t.en || '').toLowerCase().includes(currentSearchTerm)) ||
        masters.some(m => (m.name || '').toLowerCase().includes(currentSearchTerm)) ||
        (img.determined_class && img.determined_class.toLowerCase().includes(currentSearchTerm));
      
      if (!searchMatch) return false;
    }

    return true;
  });
}

function renderUI() {
  const listContainer = document.getElementById('image-list');
  
  if (allSavedImages.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📸</div>
        <p>暂无收藏灵感</p>
        <p style="font-size: 12px; margin-top: 8px;">在网页上对图片点击「分析并收藏」即可显示在这里</p>
      </div>
    `;
    return;
  }

  const filteredImages = getFilteredImages();

  if (filteredImages.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>未找到匹配的结果</p>
        <button class="picker-btn-close reset-filters-btn">清除所有搜索</button>
      </div>
    `;
    return;
  }

  // 映射大类名称为中文
  const classMap = {
    'COMMERCIAL_FASHION': '商业时尚',
    'PORTRAIT': '人物肖像',
    'PRODUCT': '静物产品',
    'LANDSCAPE': '自然风光',
    'CONCEPT_CROWD': '创意/人群',
    'ARCHITECTURE': '建筑空间',
    'ART': '艺术插画',
    'DESIGN': '平面设计',
    'QUICK_SAVE': '快速收藏'
  };

  listContainer.innerHTML = filteredImages.map((img, index) => {
    const displayClass = classMap[img.determined_class] || img.determined_class;
    // 找到在原始数组中的索引，以便正确删除
    const originalIndex = allSavedImages.indexOf(img);
    
    // 自动为旧图片生成建议关键词 (降级逻辑)
    let displayChips = img.pinterest_search_chips || [];
    if (displayChips.length === 0 && img.tags && img.tags.length > 0) {
      // 取前 3 个标签作为搜索建议
      displayChips = img.tags.slice(0, 3).map(t => ({
        label: t.zh,
        query: t.en || t.zh
      }));
    }
    
    // 解析域名
    let domainName = '';
    let faviconUrl = '';
    if (img.pageUrl) {
      try {
        const url = new URL(img.pageUrl);
        domainName = url.hostname.replace('www.', '');
        faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
      } catch (e) {
        domainName = '未知来源';
      }
    }

    return `
      <div class="image-card">
        <div class="card-image-wrapper">
          <img src="${img.imageUrl}" alt="inspiration">
          <span class="card-class-badge">${displayClass}</span>
        </div>
        <div class="card-content">
          <div class="card-meta-row">
            ${img.pageUrl ? `
              <a href="${img.pageUrl}" target="_blank" class="card-source-link" title="${img.pageUrl}">
                <img src="${faviconUrl}" class="source-favicon">
                <span>${domainName}</span>
              </a>
            ` : ''}
            ${img.category ? `<span class="card-category">${escapeHtml(img.category)}</span>` : ''}
            <span class="card-date">${new Date(img.timestamp).toLocaleDateString()}</span>
          </div>

          <div class="card-section">
            <div class="card-tags">
              ${(Array.isArray(img.tags) ? img.tags : []).map(tag => `
                <div class="card-tag-wrapper">
                  <span class="card-tag" data-value="${tag.zh}" title="点击筛选: ${tag.zh}">
                    ${tag.zh} <span class="tag-en-inline">${tag.en}</span>
                  </span>
                  <button class="tag-copy-btn" data-copy="${tag.en}" title="复制英文名: ${tag.en}">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          ${Array.isArray(img.style_masters) && img.style_masters.length > 0 ? `
            <div class="card-section">
              <div class="card-masters">
                ${img.style_masters.map(m => `<span class="card-master-tag" data-value="${m.name}">👤 ${m.name}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${displayChips && displayChips.length > 0 ? `
            <div class="card-section">
              <div class="card-pinterest-chips">
                ${displayChips.map(chip => `
                  <a href="https://www.pinterest.com/search/pins/?q=${encodeURIComponent(chip.query)}" class="card-pinterest-chip" target="_blank">
                    <img src="https://www.pinterest.com/favicon.ico" alt="P">
                    <span>${chip.label}</span>
                  </a>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="card-actions-mini">
            <button class="card-btn-delete" data-index="${originalIndex}" title="删除收藏">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setFilter(type, value) {
  currentFilter = { type, value };
  const indicator = document.getElementById('filter-indicator');
  const text = document.getElementById('active-filter-text');
  
  indicator.style.display = 'flex';
  text.innerText = (type === 'artist' ? '👤 ' : '# ') + value;
  
  renderUI();
  // 滚动到顶部查看结果
  document.getElementById('image-list').scrollTop = 0;
}

window.resetAllFilters = function() {
  currentSearchTerm = '';
  currentFilter = { type: null, value: null };
  document.getElementById('sidepanel-search').value = '';
  document.getElementById('clear-search').style.display = 'none';
  document.getElementById('filter-indicator').style.display = 'none';
  renderUI();
};

// 监听存储变化以实时更新
chrome.storage.onChanged.addListener((changes) => {
  if (changes.savedImages) {
    allSavedImages = changes.savedImages.newValue || [];
    renderUI();
  }
  if (changes.currentQuickSave) {
    const next = changes.currentQuickSave.newValue;
    if (next && Date.now() - next.timestamp < 5 * 60 * 1000) {
      currentQuickSaveDraft = next;
      quickSaveTags = [];
      renderQuickSave(next);
    }
  }
});
