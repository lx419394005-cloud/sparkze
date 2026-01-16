const CLASS_MAP = {
  'COMMERCIAL_FASHION': '商业时尚',
  'PORTRAIT': '人物肖像',
  'PRODUCT': '静物产品',
  'LANDSCAPE': '自然风光',
  'CONCEPT_CROWD': '创意/人群',
  'ARCHITECTURE': '建筑空间',
  'ART': '艺术插画',
  'DESIGN': '平面设计'
};

let allImages = [];
let currentFilters = {
  search: '',
  category: 'all',
  tags: [], // 改为数组支持多选
  artist: null
};
let currentWikiTab = 'active'; // 'active', 'tags', 'artists'
let currentWikiViewTab = 'tag'; // 'tag', 'artist' for the full Wiki View

// Bulk Management State
let isBulkMode = false;
let selectedIndices = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  initSidebarNavigation();
  initWikiView();
  renderFilters();
  renderGallery();
});

function updateTotalCount() {
  const totalCount = document.getElementById('total-count');
  if (totalCount) totalCount.innerText = `${allImages.length} 项收藏`;
}

async function loadData() {
  const data = await chrome.storage.local.get('savedImages');
  allImages = (data.savedImages || []).sort((a, b) => b.timestamp - a.timestamp);
  updateTotalCount();
}

function setupEventListeners() {
  const searchInput = document.getElementById('gallery-search');
  const clearBtn = document.getElementById('clear-search');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const expandSidebarBtn = document.getElementById('expand-sidebar');
  const closeDetailPanelBtn = document.getElementById('close-detail-panel');
  const sidebar = document.getElementById('gallery-sidebar');
  const detailPanel = document.getElementById('gallery-detail-panel');

  // 1. Sidebar Toggle
  if (toggleSidebarBtn && sidebar && expandSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      expandSidebarBtn.style.display = 'flex';
    });
    
    expandSidebarBtn.addEventListener('click', () => {
      sidebar.classList.remove('collapsed');
      expandSidebarBtn.style.display = 'none';
    });
  }

  // 2. Sidebar Section Toggle
  document.querySelectorAll('.sidebar-section.collapsible').forEach(section => {
    const header = section.querySelector('.section-header');
    if (header) {
      header.addEventListener('click', (e) => {
        // 如果点击的是 Wiki 按钮，不要触发折叠
        if (e.target.closest('.view-all-wiki')) return;
        section.classList.toggle('collapsed');
      });
    }
  });

  // 3. Wiki Tab & Sidebar Wiki View Logic
  document.querySelectorAll('.view-all-wiki').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = btn.dataset.wikiTarget;
      currentWikiTab = target;
      renderTagWikis();
    });
  });

  const wikiContainer = document.getElementById('tag-wiki-container');
  if (wikiContainer) {
    wikiContainer.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.wiki-tab');
      if (tabBtn) {
        currentWikiTab = tabBtn.dataset.wikiTab;
        renderTagWikis();
        return;
      }

      const hideBtn = e.target.closest('#hide-wiki-btn');
      if (hideBtn) {
        wikiContainer.style.display = 'none';
        return;
      }
    });
  }

  // 4. Detail Panel Toggle
  const expandDetailPanelBtn = document.getElementById('expand-detail-panel');
  if (closeDetailPanelBtn && detailPanel && expandDetailPanelBtn) {
    closeDetailPanelBtn.addEventListener('click', () => {
      detailPanel.classList.add('collapsed');
      expandDetailPanelBtn.style.display = 'flex';
    });
    
    expandDetailPanelBtn.addEventListener('click', () => {
      detailPanel.classList.remove('collapsed');
      expandDetailPanelBtn.style.display = 'none';
    });
  }

  // 5. Bulk Management
  const toggleBulkBtn = document.getElementById('toggle-bulk-mode');
  const cancelBulkBtn = document.getElementById('cancel-bulk-mode');
  const bulkActionBar = document.getElementById('bulk-action-bar');
  const bulkSelectAllBtn = document.getElementById('bulk-select-all');
  const bulkDownloadBtn = document.getElementById('bulk-download');
  const galleryGrid = document.getElementById('gallery-grid');

  if (toggleBulkBtn) {
    toggleBulkBtn.addEventListener('click', () => {
      isBulkMode = !isBulkMode;
      if (isBulkMode) {
        enterBulkMode();
      } else {
        exitBulkMode();
      }
    });
  }

  if (cancelBulkBtn) {
    cancelBulkBtn.addEventListener('click', () => {
      exitBulkMode();
    });
  }

  if (bulkSelectAllBtn) {
    bulkSelectAllBtn.addEventListener('click', () => {
      const allCards = document.querySelectorAll('.gallery-card');
      const filteredImages = getFilteredImages();
      
      if (selectedIndices.size === filteredImages.length) {
        // Unselect all
        selectedIndices.clear();
      } else {
        // Select all currently visible
        filteredImages.forEach(img => {
          const originalIndex = img.originalIndex;
          if (typeof originalIndex === 'number' && !Number.isNaN(originalIndex)) {
            selectedIndices.add(originalIndex);
          }
        });
      }
      updateBulkUI();
    });
  }

  if (bulkDownloadBtn) {
    bulkDownloadBtn.addEventListener('click', async () => {
      if (selectedIndices.size === 0) {
        showToast('请先选择要下载的图片');
        return;
      }
      await downloadSelectedImages();
    });
  }

  // Handle gallery grid click for selection
  if (galleryGrid) {
    galleryGrid.addEventListener('click', (e) => {
      if (!isBulkMode) return;
      
      const card = e.target.closest('.gallery-card');
      if (card) {
        e.preventDefault();
        e.stopPropagation();
        
        const index = parseInt(card.dataset.index);
        if (selectedIndices.has(index)) {
          selectedIndices.delete(index);
        } else {
          selectedIndices.add(index);
        }
        updateBulkUI();
      }
    }, true); // Use capture to intercept click before detail panel
  }

  // 4. Image Preview Modal Logic
  const previewModal = document.getElementById('image-preview-modal');
  const previewImage = document.getElementById('preview-image');
  const closePreviewBtn = document.getElementById('close-preview');
  const deletePreviewBtn = document.getElementById('delete-preview');
  let currentPreviewIndex = null;

  if (previewModal && previewImage) {
    const closePreview = () => {
      previewModal.classList.remove('active');
      previewImage.src = '';
      currentPreviewIndex = null;
    };

    closePreviewBtn?.addEventListener('click', closePreview);
    
    deletePreviewBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (currentPreviewIndex !== null) {
        if (confirm('确定要删除这条收藏吗？')) {
          const index = currentPreviewIndex;
          closePreview();
          await deleteItem(index);
        }
      }
    });

    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal || e.target === previewImage) {
        closePreview();
      }
    });

    // ESC 键关闭预览
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && previewModal.classList.contains('active')) {
        closePreview();
      }
    });
  }

  const debouncedGallerySearch = SparkzeUtils.debounce((value) => {
    currentFilters.search = value.toLowerCase();
    renderGallery();
  }, 300);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (clearBtn) clearBtn.classList.toggle('visible', !!value);
      debouncedGallerySearch(value);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentFilters.search = '';
      clearBtn.classList.remove('visible');
      renderGallery();
    });
  }

  // 过滤器委托 (包含侧边栏标签/艺术家和内容区分类)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;

    // 检查是否在过滤器区域内
    if (!btn.closest('#tag-filters') && !btn.closest('#artist-filters') && !btn.closest('#category-filters')) return;

    const type = btn.dataset.type || (btn.dataset.filter === 'all' ? 'category' : null);
    const value = btn.dataset.value || (btn.dataset.filter === 'all' ? 'all' : null);

    if (type && value) {
      setFilter(type, value);
    }
  });

  // 画廊网格事件委托
  const grid = document.getElementById('gallery-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const target = e.target;
      
      // 1. 复制 Prompt
      const copyPromptBtn = target.closest('.picker-copy-prompt');
      if (copyPromptBtn) {
        e.preventDefault();
        e.stopPropagation();
        const text = copyPromptBtn.dataset.prompt;
        if (text) copyText(copyPromptBtn, text);
        return;
      }

      // 2. 点击图片或详情按钮打开右侧详情面板
      const detailTrigger = target.closest('.card-image-wrapper') || target.closest('.card-btn-detail');
      if (detailTrigger) {
        const index =
          detailTrigger.closest('.gallery-card')?.dataset.index ??
          detailTrigger.dataset.index;
        if (index !== undefined) showDetailPanel(parseInt(index));
        return;
      }

      // 3. 点击标签筛选
      const tagBtn = target.closest('.card-tag');
      if (tagBtn) {
        e.stopPropagation();
        const tag = tagBtn.dataset.value;
        if (tag) setFilter('tag', tag);
        return;
      }

      // 4. 复制标签英文
      const copyTagBtn = target.closest('.tag-copy-btn');
      if (copyTagBtn) {
        e.stopPropagation();
        const text = copyTagBtn.dataset.en;
        if (text) copyTagText(copyTagBtn, text);
        return;
      }

      // 5. 点击艺术家筛选
      const artistBtn = target.closest('.card-master-tag');
      if (artistBtn) {
        e.stopPropagation();
        const artist = artistBtn.dataset.value;
        if (artist) setFilter('artist', artist);
        return;
      }

      // 6. 删除项
      const deleteBtn = target.closest('.card-btn-delete');
      if (deleteBtn) {
        e.stopPropagation();
        const index = deleteBtn.dataset.index;
        if (index !== undefined) deleteItem(parseInt(index));
        return;
      }

      // 7. 阻止来源链接冒泡
      if (target.closest('.card-source-link')) {
        e.stopPropagation();
      }
    });

    // 双击预览大图
    grid.addEventListener('dblclick', (e) => {
      const target = e.target;
      if (target.closest('.picker-copy-prompt')) return;
      const card = target.closest('.gallery-card');
      if (card) {
        const index = card.dataset.index;
        if (index !== undefined) {
          const img = allImages[index];
          if (img && img.imageUrl) {
            const previewModal = document.getElementById('image-preview-modal');
            const previewImage = document.getElementById('preview-image');
            if (previewModal && previewImage) {
              previewImage.src = img.imageUrl;
              currentPreviewIndex = parseInt(index);
              if (deletePreviewBtn) deletePreviewBtn.style.display = 'flex';
              previewModal.classList.add('active');
            }
          }
        }
      }
    });
  }

  // 右侧详情面板事件委托
  const panelContent = document.getElementById('detail-panel-content');
  if (panelContent) {
    panelContent.addEventListener('click', (e) => {
      const target = e.target;

      // 复制 Prompt
      const copyPromptBtn = target.closest('.picker-copy-prompt');
      if (copyPromptBtn) {
        const text = copyPromptBtn.dataset.prompt;
        if (text) copyText(copyPromptBtn, text);
        return;
      }

      // 点击标签显示 wiki
      const tagWikiBtn = target.closest('.tag-wiki-trigger');
      if (tagWikiBtn) {
        e.preventDefault();
        const tagName = tagWikiBtn.dataset.tag;
        const wikiText = tagWikiBtn.dataset.wiki;
        if (tagName && wikiText) {
          showTagWikiPopup(tagName, wikiText);
        } else if (tagName) {
          // 没有 wiki 内容，显示提示
          showTagWikiPopup(tagName, '暂无该标签的百科信息');
        }
        return;
      }

      // 关闭 wiki popup
      const closeWikiPopup = target.closest('.wiki-popup-close');
      if (closeWikiPopup || target.closest('.wiki-popup-overlay')) {
        const popup = document.querySelector('.wiki-popup-overlay');
        if (popup) popup.remove();
        return;
      }

      // 复制标签
      const copyTagBtn = target.closest('.tag-copy-btn');
      if (copyTagBtn) {
        e.stopPropagation();
        const text = copyTagBtn.dataset.en;
        if (text) copyTagText(copyTagBtn, text);
        return;
      }

      // 删除项
      const deleteBtn = target.closest('.card-btn-delete');
      if (deleteBtn) {
        e.stopPropagation();
        const index = deleteBtn.dataset.index;
        if (index !== undefined) deleteItem(parseInt(index));
        return;
      }
    });

    // 双击详情页图片预览大图
    panelContent.addEventListener('dblclick', (e) => {
      const target = e.target;
      if (target.tagName === 'IMG' && target.closest('.detail-panel-image-wrapper')) {
        const previewModal = document.getElementById('image-preview-modal');
        const previewImage = document.getElementById('preview-image');
        if (previewModal && previewImage) {
          previewImage.src = target.src;
          previewModal.classList.add('active');
        }
      }
    });
  }

  // Chat Area Double Click to Zoom
  const chatMessagesArea = document.getElementById('chat-messages-area');
  if (chatMessagesArea) {
    chatMessagesArea.addEventListener('dblclick', (e) => {
      const target = e.target;
      if (target.classList.contains('chat-bubble-image')) {
        const previewModal = document.getElementById('image-preview-modal');
        const previewImage = document.getElementById('preview-image');
        
        if (previewModal && previewImage) {
          previewImage.src = target.src;
          currentPreviewIndex = null;
          if (deletePreviewBtn) deletePreviewBtn.style.display = 'none';
          previewModal.classList.add('active');
        }
      }
    });
  }

  // 处理图标加载失败 (CSP 合规)
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.classList.contains('source-favicon')) {
      e.target.style.display = 'none';
    }
  }, true);
}

function renderFilters() {
  // 1. Categories (limited to 6)
  const categoryContainer = document.getElementById('category-filters');
  const categories = [...new Set(allImages.map(img => img.determined_class))].filter(Boolean).slice(0, 6);
  
  // 清理并重新创建
  categoryContainer.innerHTML = '<button class="filter-chip active" data-filter="all">全部作品</button>';

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.dataset.type = 'category';
    btn.dataset.value = cat;
    btn.innerText = CLASS_MAP[cat] || cat;
    categoryContainer.appendChild(btn);
  });

  // 2. Popular Tags
  const tagContainer = document.getElementById('tag-filters');
  const tagCounts = {};
  allImages.forEach(img => {
    img.tags.forEach(tag => {
      tagCounts[tag.zh] = (tagCounts[tag.zh] || 0) + 1;
    });
  });

  const popularTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  tagContainer.innerHTML = popularTags.map(([tag, count]) => `
    <button class="filter-chip" data-type="tag" data-value="${tag}">
      ${tag} <small style="opacity:0.5; margin-left:2px">${count}</small>
    </button>
  `).join('');

  // 3. Artists
  const artistContainer = document.getElementById('artist-filters');
  const artistCounts = {};
  allImages.forEach(img => {
    img.style_masters.forEach(m => {
      artistCounts[m.name] = (artistCounts[m.name] || 0) + 1;
    });
  });

  const popularArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  artistContainer.innerHTML = popularArtists.map(([name, count]) => `
    <button class="filter-chip" data-type="artist" data-value="${name}">
      👤 ${name} <small style="opacity:0.5; margin-left:2px">${count}</small>
    </button>
  `).join('');
}

function setFilter(type, value) {
  if (type === 'category') {
    currentFilters.category = value;
    currentFilters.tags = [];
    currentFilters.artist = null;
    currentWikiTab = 'active';
    renderTagWikis();
  } else if (type === 'tag') {
    const index = currentFilters.tags.indexOf(value);
    if (index > -1) {
      currentFilters.tags.splice(index, 1);
    } else {
      currentFilters.tags.push(value);
      currentFilters.category = 'all';
      currentFilters.artist = null;
      currentWikiTab = 'active';
    }
    renderTagWikis();
  } else if (type === 'artist') {
    currentFilters.artist = value;
    currentFilters.category = 'all';
    currentFilters.tags = [];
    currentWikiTab = 'active';
    renderTagWikis();
  }

  updateActiveState();
  renderGallery();
}

function renderTagWikis() {
  const wikiContainer = document.getElementById('tag-wiki-container');
  const wikiList = document.getElementById('wiki-cards-list');
  if (!wikiContainer || !wikiList) return;

  // 更新 Tab 激活状态
  wikiContainer.querySelectorAll('.wiki-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.wikiTab === currentWikiTab);
  });

  let wikiCardsHtml = '';

  if (currentWikiTab === 'active') {
    if (currentFilters.tags.length === 0) {
      wikiContainer.style.display = 'none';
      return;
    }
    wikiCardsHtml = currentFilters.tags.map(tagName => {
      let wikiText = '';
      for (const img of allImages) {
        const tagObj = img.tags.find(t => t.zh === tagName);
        if (tagObj && tagObj.wiki) {
          wikiText = tagObj.wiki;
          break;
        }
      }
      if (!wikiText) return '';
      return createWikiCard(tagName, wikiText, true);
    }).filter(Boolean).join('');
  } 
  else if (currentWikiTab === 'tags') {
    // 获取所有具有 wiki 的标签
    const allWikis = {};
    allImages.forEach(img => {
      img.tags.forEach(t => {
        if (t.wiki && !allWikis[t.zh]) {
          allWikis[t.zh] = t.wiki;
        }
      });
    });
    wikiCardsHtml = Object.entries(allWikis).map(([name, wiki]) => {
      const isActive = currentFilters.tags.includes(name);
      return createWikiCard(name, wiki, false, 'tag', isActive);
    }).join('');
  } 
  else if (currentWikiTab === 'artists') {
    // 获取所有艺术家及其推荐理由
    const allArtists = {};
    allImages.forEach(img => {
      img.style_masters.forEach(m => {
        if (m.reason && !allArtists[m.name]) {
          allArtists[m.name] = m.reason;
        }
      });
    });
    wikiCardsHtml = Object.entries(allArtists).map(([name, reason]) => {
      const isActive = currentFilters.artist === name;
      return createWikiCard(name, reason, false, 'artist', isActive);
    }).join('');
  }

  if (wikiCardsHtml) {
    wikiList.innerHTML = wikiCardsHtml;
    wikiContainer.style.display = 'flex';
    
    // 绑定关闭/移除筛选按钮事件
    wikiList.querySelectorAll('.close-wiki-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止触发卡片点击
        const tagToRemove = btn.dataset.tag;
        const type = btn.dataset.type || 'tag';
        if (currentWikiTab === 'active') {
          setFilter(type, tagToRemove);
        } else {
          if (type === 'tag' && currentFilters.tags.includes(tagToRemove)) {
            setFilter('tag', tagToRemove);
          } else if (type === 'artist' && currentFilters.artist === tagToRemove) {
            setFilter('artist', null);
          }
        }
      });
    });

    // 绑定卡片点击筛选事件
    wikiList.querySelectorAll('.tag-wiki-card').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.name;
        const type = card.dataset.type;
        if (name && type) {
          // 如果是 active 模式，点击可能是为了跳转或其他（目前暂无定义，保持现状）
          // 如果是 tags/artists 模式，点击则是为了筛选
          if (currentWikiTab !== 'active') {
             setFilter(type, name);
             // 滚动到图片区域
             document.getElementById('gallery-grid')?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  } else {
    wikiList.innerHTML = '<div style="padding: 20px; color: #94a3b8; font-size: 13px;">暂无百科信息</div>';
    wikiContainer.style.display = 'flex';
  }
}

function createWikiCard(name, content, showClose = true, type = 'tag') {
  return `
    <div class="tag-wiki-card ${!showClose ? 'clickable-wiki-card' : ''}" data-name="${name}" data-type="${type}" style="${!showClose ? 'cursor: pointer;' : ''}">
      <div class="tag-wiki-header">
        <h2>${type === 'artist' ? '👤 ' : ''}${name}</h2>
        ${showClose ? `<button class="close-wiki-btn" data-tag="${name}" data-type="${type}" title="移除筛选">&times;</button>` : ''}
      </div>
      <p title="${content}">${content}</p>
    </div>
  `;
}

function hideTagWiki() {
  currentFilters.tags = [];
  renderTagWikis();
  updateActiveState();
  renderGallery();
}

function updateActiveState() {
  document.querySelectorAll('.filter-chip').forEach(btn => {
    const { type, value } = btn.dataset;
    let isActive = false;
    
    if (type === 'category' || btn.dataset.filter === 'all') {
      isActive = currentFilters.category === (value || 'all');
    } else if (type === 'tag') {
      isActive = currentFilters.tags.includes(value);
    } else if (type === 'artist') {
      isActive = currentFilters.artist === value;
    }
    
    btn.classList.toggle('active', isActive);
  });
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  
  const filtered = allImages.map((img, index) => ({ ...img, originalIndex: index }))
    .filter(img => {
      // 1. Search filter
      if (currentFilters.search) {
        const searchStr = [
          img.analysis_summary,
          ...img.tags.map(t => t.zh + t.en),
          ...img.style_masters.map(m => m.name),
          img.ai_drawing_prompt || ''
        ].join(' ').toLowerCase();
        if (!searchStr.includes(currentFilters.search)) return false;
      }
      
      // 2. Category filter
      if (currentFilters.category !== 'all' && img.determined_class !== currentFilters.category) return false;
      
      // 3. Tag filter (multi-selection)
      if (currentFilters.tags.length > 0) {
        // 必须包含所有选中的标签 (AND 逻辑)
        const hasAllTags = currentFilters.tags.every(selectedTag => 
          img.tags.some(t => t.zh === selectedTag)
        );
        if (!hasAllTags) return false;
      }
      
      // 4. Artist filter
      if (currentFilters.artist && !img.style_masters.some(m => m.name === currentFilters.artist)) return false;
      
      return true;
    });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 100px; text-align: center; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
        <p>没有找到符合条件的灵感，换个搜索词试试吧</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((img) => {
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
      <div class="card-image-wrapper gallery-card" data-index="${img.originalIndex}">
        <img src="${img.imageUrl}" alt="inspiration">
        <span class="card-class-badge">${CLASS_MAP[img.determined_class] || img.determined_class}</span>
        
        ${img.ai_drawing_prompt ? `
          <div class="card-prompt-overlay">
            <div class="overlay-prompt-text">${img.ai_drawing_prompt}</div>
            <button class="picker-copy-prompt" data-prompt="${img.ai_drawing_prompt.replace(/"/g, '&quot;')}">复制 Prompt</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function showDetailPanel(index) {
  const img = allImages[index];
  const panel = document.getElementById('gallery-detail-panel');
  const content = document.getElementById('detail-panel-content');
  const expandBtn = document.getElementById('expand-detail-panel');
  const deleteBtnHeader = document.getElementById('delete-current-item');
  
  if (!img || !panel || !content) return;

  panel.classList.remove('collapsed');
  if (expandBtn) expandBtn.style.display = 'none';

  // 显示顶部删除按钮并绑定事件
  if (deleteBtnHeader) {
    deleteBtnHeader.style.display = 'flex';
    deleteBtnHeader.onclick = () => deleteItem(index);
  }

  const formattedSummary = img.analysis_summary
    .replace(/([1-3])\.\s/g, '<br>$1. ')
    .replace(/^<br>/, '');

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

  content.innerHTML = `
    <div class="detail-panel-image-wrapper">
      <img src="${img.imageUrl}" alt="detail">
    </div>
    <div class="detail-panel-info-section">
      <div class="panel-header-row">
        <h2>视觉分析</h2>
        <span class="picker-class-badge">${CLASS_MAP[img.determined_class] || img.determined_class}</span>
      </div>
      
      <div class="panel-summary">
        ${formattedSummary}
      </div>
      
      <div class="picker-section">
        <h4 class="panel-section-title">全量标签库 <small style="font-weight:normal;color:#94a3b8;font-size:12px">(点击标签查看百科)</small></h4>
        <div class="panel-tag-cloud">
          ${img.tags.map(t => `
            <div class="card-tag-wrapper${t.isManual ? ' manual-tag' : ''}">
              <span class="card-tag tag-wiki-trigger${t.isManual ? ' manual-tag' : ''}" data-tag="${t.zh}" data-wiki="${t.wiki || ''}">
                ${t.zh} <small class="tag-en-inline">${t.en || ''}</small>
                ${t.wiki ? '<svg class="tag-wiki-icon" viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' : ''}
              </span>
              <button class="tag-copy-btn" data-en="${t.en || ''}" title="复制英文名: ${t.en || ''}">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="picker-section">
        <h4 class="panel-section-title">风格大师解析</h4>
        <div class="card-masters-simple">
          ${img.style_masters.map(m => `
            <span class="card-master-tag" data-value="${m.name}">👤 ${m.name}</span>
          `).join('')}
        </div>
      </div>

      ${img.ai_drawing_prompt ? `
        <div class="picker-section">
          <h4 class="panel-section-title">AI 绘画 Prompt</h4>
          <div class="picker-prompt-box">
            ${img.ai_drawing_prompt}
          </div>
          <div class="panel-action-row">
            <button class="picker-copy-prompt" data-prompt="${img.ai_drawing_prompt.replace(/"/g, '&quot;')}">
              复制 Prompt
            </button>
          </div>
        </div>
      ` : ''}

      <div class="picker-section">
        <h4 class="panel-section-title">来源与操作</h4>
        <div class="panel-action-row">
          ${img.pageUrl ? `
            <a href="${img.pageUrl}" target="_blank" class="card-source-link" style="max-width: none; flex: 1;">
              <img src="${faviconUrl}" class="source-favicon">
              <span>打开原网页 (${domainName})</span>
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

async function deleteItem(index) {
  if (confirm('确定要删除这条收藏吗？')) {
    allImages.splice(index, 1);
    await chrome.storage.local.set({ savedImages: allImages });
    loadData();
    renderFilters();
    renderGallery();
  }
}

function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerText;
    btn.innerText = '已复制！';
    btn.style.color = '#10b981';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.color = '';
    }, 2000);
  });
}

function copyTagText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    const originalTitle = btn.title;
    btn.title = '已复制！';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.title = originalTitle;
    }, 1500);
  });
}

// 显示标签 Wiki 弹窗
function showTagWikiPopup(tagName, wikiText) {
  // 移除已存在的弹窗
  const existingPopup = document.querySelector('.wiki-popup-overlay');
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement('div');
  popup.className = 'wiki-popup-overlay';
  popup.innerHTML = `
    <div class="wiki-popup-card">
      <div class="wiki-popup-header">
        <h3>${tagName}</h3>
        <button class="wiki-popup-close">&times;</button>
      </div>
      <div class="wiki-popup-content">
        ${wikiText}
      </div>
    </div>
  `;
  document.body.appendChild(popup);

  // 动画
  requestAnimationFrame(() => {
    popup.classList.add('active');
  });
}

function setMainView(view, options = {}) {
  const galleryView = document.getElementById('gallery-view');
  const drawView = document.getElementById('draw-view');
  const wikiView = document.getElementById('wiki-view');

  if (galleryView) galleryView.style.display = view === 'gallery' ? 'block' : 'none';
  if (drawView) drawView.style.display = view === 'draw' ? 'block' : 'none';
  if (wikiView) wikiView.style.display = view === 'wiki' ? 'block' : 'none';

  if (view === 'wiki') {
    if (options.wikiType && (options.wikiType === 'tag' || options.wikiType === 'artist')) {
      currentWikiType = options.wikiType;
      document.querySelectorAll('.wiki-filter-tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`.wiki-filter-tab[data-type="${currentWikiType}"]`)?.classList.add('active');
    }
    renderWikiGrid();
  }
}

function setSidebarActive(clicked) {
  document.querySelectorAll('.sidebar-nav-item, .sidebar-nav-subitem, .sidebar-tab').forEach(el => {
    el.classList.remove('active');
  });
  clicked.classList.add('active');
}

function initSidebarNavigation() {
  const handleClick = (btn) => {
    const view = btn.dataset.view;
    if (!view) return;

    setSidebarActive(btn);

    if (view === 'wiki') {
      setMainView('wiki', { wikiType: btn.dataset.wikiType });
      return;
    }

    setMainView(view);
  };

  document.querySelectorAll('.sidebar-nav-item, .sidebar-nav-subitem').forEach(btn => {
    btn.addEventListener('click', () => handleClick(btn));
  });

  document.querySelectorAll('.sidebar-tab').forEach(btn => {
    btn.addEventListener('click', () => handleClick(btn));
  });

  const defaultBtn =
    document.querySelector('.sidebar-nav-item.active') ||
    document.querySelector('.sidebar-tab.active') ||
    document.querySelector('.sidebar-nav-item[data-view="gallery"]') ||
    document.querySelector('.sidebar-tab[data-view="gallery"]');

  if (defaultBtn) {
    const view = defaultBtn.dataset.view;
    if (view) setMainView(view);
  }
}

// ==================== Pagination ====================
const ITEMS_PER_PAGE = 20;
let currentPage = 1;

function renderPagination() {
  const container = document.getElementById('page-numbers');
  const prevBtn = document.getElementById('page-prev');
  const nextBtn = document.getElementById('page-next');

  // Get filtered count
  const filtered = getFilteredImages();
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  // Update buttons
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;

  // Bind click events (only once to avoid duplicate listeners)
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderGallery();
      renderPagination();
      document.getElementById('gallery-grid').scrollIntoView({ behavior: 'smooth' });
    }
  };

  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderGallery();
      renderPagination();
      document.getElementById('gallery-grid').scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Generate page numbers
  let html = '';
  if (totalPages <= 7) {
    // Show all pages
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
  } else {
    // Show with ellipsis
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) {
        html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
      }
      html += `<span class="page-ellipsis">...</span>`;
      html += `<button class="page-number" data-page="${totalPages}">${totalPages}</button>`;
    } else if (currentPage >= totalPages - 3) {
      html += `<button class="page-number" data-page="1">1</button>`;
      html += `<span class="page-ellipsis">...</span>`;
      for (let i = totalPages - 4; i <= totalPages; i++) {
        html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
      }
    } else {
      html += `<button class="page-number" data-page="1">1</button>`;
      html += `<span class="page-ellipsis">...</span>`;
      html += `<button class="page-number" data-page="${currentPage - 1}">${currentPage - 1}</button>`;
      html += `<button class="page-number active" data-page="${currentPage}">${currentPage}</button>`;
      html += `<button class="page-number" data-page="${currentPage + 1}">${currentPage + 1}</button>`;
      html += `<span class="page-ellipsis">...</span>`;
      html += `<button class="page-number" data-page="${totalPages}">${totalPages}</button>`;
    }
  }

  container.innerHTML = html;

  // Bind click events
  container.querySelectorAll('.page-number').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderGallery();
      renderPagination();
      document.getElementById('gallery-grid').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// Update renderGallery to use pagination
function getFilteredImages() {
  return allImages.map((img, index) => ({ ...img, originalIndex: index }))
    .filter(img => {
      if (currentFilters.search) {
        const searchStr = [
          img.analysis_summary,
          ...img.tags.map(t => t.zh + t.en),
          ...img.style_masters.map(m => m.name),
          img.ai_drawing_prompt || ''
        ].join(' ').toLowerCase();
        if (!searchStr.includes(currentFilters.search)) return false;
      }
      if (currentFilters.category !== 'all' && img.determined_class !== currentFilters.category) return false;
      if (currentFilters.tags.length > 0) {
        const hasAllTags = currentFilters.tags.every(selectedTag =>
          img.tags.some(t => t.zh === selectedTag)
        );
        if (!hasAllTags) return false;
      }
      if (currentFilters.artist && !img.style_masters.some(m => m.name === currentFilters.artist)) return false;
      return true;
    });
}

const originalRenderGallery = renderGallery;
renderGallery = function() {
  const grid = document.getElementById('gallery-grid');
  const filtered = getFilteredImages();

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 100px; text-align: center; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
        <p>没有找到符合条件的灵感，换个搜索词试试吧</p>
      </div>
    `;
    document.getElementById('gallery-pagination').style.display = 'none';
    return;
  }

  document.getElementById('gallery-pagination').style.display = 'flex';

  // Paginate
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  grid.innerHTML = paginatedItems.map((img) => {
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
      <div class="card-image-wrapper gallery-card" data-index="${img.originalIndex}">
        <img src="${img.imageUrl}" alt="inspiration">
        <span class="card-class-badge">${CLASS_MAP[img.determined_class] || img.determined_class}</span>

        ${img.ai_drawing_prompt ? `
          <div class="card-prompt-overlay">
            <div class="overlay-prompt-text">${img.ai_drawing_prompt}</div>
            <button class="picker-copy-prompt" data-prompt="${img.ai_drawing_prompt.replace(/"/g, '&quot;')}">复制 Prompt</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  renderPagination();
};

// Override loadData to reset pagination
const originalLoadData = loadData;
loadData = async function() {
  await originalLoadData();
  currentPage = 1;
};

// ==================== Drawing Functionality (Chat Style) ====================
const MODEL_CONFIG = {
  '4-0': 'doubao-seedream-4-0-250828',
  '4-5': 'doubao-seedream-4-5-251128'
};

let galleryCurrentResultImage = null;
let galleryCurrentPrompt = '';
let chatHistory = [];

// Settings toggle
document.getElementById('chat-settings-toggle')?.addEventListener('click', () => {
  const content = document.getElementById('chat-settings-content');
  const toggle = document.getElementById('chat-settings-toggle');
  content.classList.toggle('expanded');
  toggle.classList.toggle('active');
});

// Suggestion buttons
document.querySelectorAll('.chat-suggestion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const promptInput = document.getElementById('gallery-prompt-input');
    promptInput.value = btn.dataset.prompt;
    promptInput.focus();
    updateSendButtonState();
  });
});

// Input auto-resize and send button state
const promptInput = document.getElementById('gallery-prompt-input');
if (promptInput) {
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
    updateSendButtonState();
  });

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!document.getElementById('gallery-generate-btn').disabled) {
        galleryGenerateImage();
      }
    }
  });
}

function updateSendButtonState() {
  const btn = document.getElementById('gallery-generate-btn');
  if (btn) {
    btn.disabled = !promptInput?.value.trim();
  }
}

// Generate button
document.getElementById('gallery-generate-btn')?.addEventListener('click', galleryGenerateImage);

// Retry button (in chat error message)
document.getElementById('chat-retry-btn')?.addEventListener('click', () => {
  document.getElementById('chat-error-message').style.display = 'none';
  galleryGenerateImage();
});

// Auto-save and action handlers for chat messages
function addChatActions(imageUrls, prompt) {
  const actionsContainer = document.querySelector('.chat-ai-bubble .chat-bubble-actions');
  if (actionsContainer) {
    // Save button
    const saveBtn = actionsContainer.querySelector('.save-action');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        for (const url of imageUrls) {
          await saveToGallery(url, prompt);
        }
      };
    }

    // Download button
    const downloadBtn = actionsContainer.querySelector('.download-action');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        imageUrls.forEach((url, i) => {
          setTimeout(() => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `jimeng_${Date.now()}_${i + 1}.png`;
            a.click();
          }, i * 200);
        });
      };
    }

    // Regenerate button
    const regenerateBtn = actionsContainer.querySelector('.regenerate-action');
    if (regenerateBtn) {
      regenerateBtn.onclick = () => {
        document.getElementById('chat-error-message').style.display = 'none';
        galleryGenerateImage();
      };
    }
  }
}

// Save to gallery function
async function saveToGallery(imageUrl, prompt) {
  const imageData = {
    imageUrl: imageUrl,
    pageUrl: 'AI生成',
    determined_class: 'AI_GENERATED',
    analysis_summary: prompt ? prompt.substring(0, 100) : '使用即梦 AI 生成的图片',
    tags: [{ en: 'AI Generated', zh: 'AI 生成', wiki: '' }],
    style_masters: [],
    pinterest_search_chips: [],
    ai_drawing_prompt: prompt || '',
    timestamp: Date.now()
  };

  allImages.unshift(imageData);
  await chrome.storage.local.set({ savedImages: allImages });

  showToast('已保存到灵感画廊');
  updateTotalCount();
  renderFilters();

  // Switch to gallery view
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.sidebar-tab[data-view="gallery"]')?.classList.add('active');
  document.getElementById('gallery-view').style.display = 'block';
  document.getElementById('draw-view').style.display = 'none';
  renderGallery();
}

// Render user message
function renderUserMessage(prompt) {
  const history = document.getElementById('chat-history');
  const welcome = document.getElementById('chat-welcome-message');

  if (welcome) welcome.style.display = 'none';
  if (history) history.style.display = 'block';

  const userMsg = document.createElement('div');
  userMsg.className = 'chat-message chat-message-user';
  userMsg.innerHTML = `
    <div class="chat-avatar user-avatar">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
    <div class="chat-bubble">
      <div class="chat-user-bubble">${prompt}</div>
    </div>
  `;
  history?.appendChild(userMsg);
  scrollToBottom();
}

// Render AI message with image
function renderAIMessage(imageUrls, prompt) {
  const history = document.getElementById('chat-history');
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls].filter(Boolean);

  const aiMsg = document.createElement('div');
  aiMsg.className = 'chat-message chat-message-ai';
  aiMsg.innerHTML = `
    <div class="chat-avatar ai-avatar">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    </div>
    <div class="chat-bubble">
      <div class="chat-ai-bubble">
        <div class="chat-bubble-images">
          ${urls.map(url => `<img src="${url}" alt="AI 生成的图片" class="chat-bubble-image">`).join('')}
        </div>
        <div class="chat-bubble-actions">
          <button class="chat-bubble-action-btn primary save-action">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            保存全部
          </button>
          <button class="chat-bubble-action-btn download-action">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            下载全部
          </button>
          <button class="chat-bubble-action-btn regenerate-action">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            再次生成
          </button>
        </div>
      </div>
    </div>
  `;
  history?.appendChild(aiMsg);

  // Add action handlers
  addChatActions(urls, prompt);
  scrollToBottom();
}

// Render error message
function renderErrorMessage(error) {
  const errorMsg = document.getElementById('chat-error-message');
  if (errorMsg) {
    errorMsg.querySelector('.chat-error-text').textContent = error;
    errorMsg.style.display = 'flex';
    scrollToBottom();
  }
}

// Show loading
function showLoading() {
  document.getElementById('chat-welcome-message')?.style.setProperty('display', 'none', 'important');
  document.getElementById('chat-history')?.style.setProperty('display', 'block', 'important');
  document.getElementById('chat-loading-message')?.style.setProperty('display', 'flex', 'important');
  document.getElementById('chat-error-message')?.style.setProperty('display', 'none', 'important');
  scrollToBottom();
}

// Hide loading
function hideLoading() {
  document.getElementById('chat-loading-message')?.style.setProperty('display', 'none', 'important');
}

// Scroll to bottom
function scrollToBottom() {
  const area = document.getElementById('chat-messages-area');
  if (area) {
    area.scrollTop = area.scrollHeight;
  }
}

// Clear input
function clearInput() {
  if (promptInput) {
    promptInput.value = '';
    promptInput.style.height = 'auto';
  }
  updateSendButtonState();
}

async function galleryGenerateImage() {
  const prompt = promptInput?.value.trim();
  if (!prompt) {
    showToast('请输入提示词');
    return;
  }

  const config = await chrome.storage.local.get(['volcengineApiKey']);
  if (!config.volcengineApiKey) {
    showToast('请先在设置中配置火山引擎 API Key');
    return;
  }

  // UI states
  renderUserMessage(prompt);
  showLoading();
  clearInput();
  document.getElementById('gallery-generate-btn').disabled = true;

  const modelKey = document.querySelector('input[name="gallery-model"]:checked')?.value;
  const model = MODEL_CONFIG[modelKey];
  const size = document.querySelector('input[name="gallery-size"]:checked')?.value || '2K';
  const watermark = document.querySelector('input[name="gallery-watermark"]:checked')?.value === 'true';
  const sequential = document.getElementById('gallery-sequential-toggle')?.checked ? 'auto' : undefined;

  const body = {
    model: model,
    prompt: prompt,
    size: size,
    watermark: watermark,
    stream: false,
    response_format: 'url'
  };

  if (sequential) body.sequential_image_generation = sequential;

  SparkzeUtils.logger.log('[Jimeng] === Request Info ===');
  SparkzeUtils.logger.log('[Jimeng] URL:', 'https://ark.cn-beijing.volces.com/api/v3/images/generations');
  SparkzeUtils.logger.log('[Jimeng] Body:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.volcengineApiKey}`
      },
      body: JSON.stringify(body)
    });

    SparkzeUtils.logger.log('[Jimeng] Status:', response.status, response.statusText);
    const responseText = await response.text();
    SparkzeUtils.logger.log('[Jimeng] Raw Response:', responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error?.message || `API 错误: ${response.status}`);
      } catch (e) {
        throw new Error(`API 错误: ${response.status}`);
      }
    }

    const data = JSON.parse(responseText);
    SparkzeUtils.logger.log('[Jimeng] Parsed Response:', data);

    const imageUrls = (data.data || []).map(item => item?.url).filter(Boolean);
    if (imageUrls.length === 0) throw new Error('未获取到生成的图片');

    galleryCurrentResultImage = imageUrls[0];
    galleryCurrentPrompt = prompt;

    hideLoading();
    renderAIMessage(imageUrls, prompt);

  } catch (error) {
    console.error('[Jimeng] Error:', error);
    hideLoading();
    renderErrorMessage(error.message);
  } finally {
    document.getElementById('gallery-generate-btn').disabled = false;
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Add toast styles
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  .toast-message {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    color: white;
    padding: 14px 28px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 500;
    z-index: 100000;
    animation: toast-in 0.3s ease;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`;
document.head.appendChild(toastStyle);

// ==================== Wiki View Logic ====================
let currentWikiType = 'tag'; // 'tag' or 'artist'
let currentWikiSearch = '';
let currentWikiSort = 'count'; // 'count' or 'name'

function initWikiView() {
  // Wiki Tab Switching
  document.querySelectorAll('.wiki-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wiki-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentWikiType = tab.dataset.type;
      renderWikiGrid();
    });
  });

  // Wiki Search
  const debouncedWikiSearch = SparkzeUtils.debounce((value) => {
    currentWikiSearch = value.toLowerCase().trim();
    renderWikiGrid();
  }, 300);

  const wikiSearchInput = document.getElementById('wiki-search-input');
  const clearWikiSearchBtn = document.getElementById('clear-wiki-search');
  if (wikiSearchInput) {
    wikiSearchInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (clearWikiSearchBtn) {
        clearWikiSearchBtn.style.display = value.trim() ? 'flex' : 'none';
      }
      debouncedWikiSearch(value);
    });
  }

  if (clearWikiSearchBtn) {
    clearWikiSearchBtn.addEventListener('click', () => {
      if (wikiSearchInput) {
        wikiSearchInput.value = '';
        currentWikiSearch = '';
        clearWikiSearchBtn.style.display = 'none';
        renderWikiGrid();
      }
    });
  }

  // Wiki Sort
  const wikiSortSelect = document.getElementById('wiki-sort-select');
  if (wikiSortSelect) {
    wikiSortSelect.addEventListener('change', (e) => {
      currentWikiSort = e.target.value;
      renderWikiGrid();
    });
  }
}

function createWikiCard(item, type) {
    const title = item.zh || item.name;
    const subtitle = type === 'tag' ? (item.en || '标签') : '艺术家';
    const desc = item.wiki || item.reason || (type === 'tag' ? `查看所有带有 "${title}" 标签的灵感作品。` : `查看艺术家 "${title}" 创作的相关风格作品。`);
    
    return `
      <div class="wiki-card" data-value="${title}" data-type="${type}">
        <div class="wiki-card-header">
          <div class="wiki-card-title-group">
            <h3 class="wiki-card-title">${title}</h3>
            <span class="wiki-card-subtitle">${subtitle}</span>
          </div>
          <div class="wiki-card-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </div>
        </div>
        <div class="wiki-card-body">
          <p>${desc}</p>
        </div>
        <div class="wiki-card-footer">
          <span class="wiki-count-badge">${item.count} 个灵感</span>
          <div class="wiki-explore-hint">
            <span>浏览作品</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </div>
        </div>
      </div>
    `;
}

function showWikiResults(value, clickedCard) {
    // Remove existing results row if any
    const existingRow = document.querySelector('.wiki-results-row');
    const container = document.getElementById('wiki-grid-container');
    
    // If clicking the same card that is already open, just close it
    if (existingRow && clickedCard.classList.contains('active')) {
        existingRow.remove();
        clickedCard.classList.remove('active');
        return;
    }
    
    // Remove active class from all cards and existing results row
    if (existingRow) existingRow.remove();
    document.querySelectorAll('.wiki-card').forEach(c => c.classList.remove('active'));
    
    // Set active card
    clickedCard.classList.add('active');
    
    // Filter images
    const filtered = allImages.filter(img => {
        if (currentWikiType === 'tag') {
            return img.tags && img.tags.some(t => t.zh === value);
        } else {
            return img.style_masters && img.style_masters.some(m => m.name === value);
        }
    });
    
    // Create the results row
    const resultsRow = document.createElement('div');
    resultsRow.className = 'wiki-results-row';
    
    // Calculate arrow position based on clicked card
    const cardRect = clickedCard.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const arrowLeft = (cardRect.left + cardRect.width / 2) - containerRect.left;
    resultsRow.style.setProperty('--arrow-left', `${arrowLeft}px`);
    
    const countText = filtered.length > 0 ? `${filtered.length} 个相关灵感` : '暂无相关灵感';
    
    resultsRow.innerHTML = `
      <div class="wiki-results-header">
        <div class="wiki-results-title">
          <h3>${value}</h3>
          <div class="dot"></div>
          <span class="count">${countText}</span>
        </div>
        <button class="wiki-results-close" title="关闭">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="wiki-results-grid">
        ${filtered.length > 0 ? filtered.map((img) => {
            const originalIndex = allImages.indexOf(img);
            return `
              <div class="card-image-wrapper gallery-card" data-index="${originalIndex}">
                <img src="${img.imageUrl}" alt="inspiration">
                <span class="card-class-badge">${CLASS_MAP[img.determined_class] || img.determined_class}</span>
              </div>
            `;
        }).join('') : '<div style="padding: 20px; color: #94a3b8; grid-column: 1/-1; text-align: center;">未找到相关图片</div>'}
      </div>
    `;
    
    // Insert after the clicked card
    clickedCard.after(resultsRow);
    
    // Event listener for closing
    resultsRow.querySelector('.wiki-results-close').addEventListener('click', () => {
        resultsRow.remove();
        clickedCard.classList.remove('active');
    });
    
    // Event listener for result image clicks
    resultsRow.querySelector('.wiki-results-grid').addEventListener('click', (e) => {
        const wrapper = e.target.closest('.card-image-wrapper');
        if (wrapper) {
            const index = parseInt(wrapper.dataset.index);
            if (!isNaN(index)) {
                showDetailPanel(index);
            }
        }
    });
    
    // Scroll to row
    setTimeout(() => {
        resultsRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function renderWikiGrid() {
  const container = document.getElementById('wiki-grid-container');
  if (!container) return;
  
  let items = [];
  
  if (currentWikiType === 'tag') {
    const tagMap = new Map();
    allImages.forEach(img => {
      if (img.tags) {
          img.tags.forEach(tag => {
            const key = tag.zh;
            if (!tagMap.has(key)) {
              tagMap.set(key, { ...tag, count: 0 });
            }
            tagMap.get(key).count++;
          });
      }
    });
    items = Array.from(tagMap.values());
  } else {
    const artistMap = new Map();
    allImages.forEach(img => {
      if (img.style_masters) {
          img.style_masters.forEach(master => {
            const key = master.name;
            if (!artistMap.has(key)) {
              artistMap.set(key, { name: key, reason: master.reason, count: 0 });
            }
            artistMap.get(key).count++;
          });
      }
    });
    items = Array.from(artistMap.values());
  }

  // Filter by search
  if (currentWikiSearch) {
    items = items.filter(item => {
      const name = (item.zh || item.name || '').toLowerCase();
      const en = (item.en || '').toLowerCase();
      const wiki = (item.wiki || item.reason || '').toLowerCase();
      return name.includes(currentWikiSearch) || 
             en.includes(currentWikiSearch) || 
             wiki.includes(currentWikiSearch);
    });
  }

  // Sort
  if (currentWikiSort === 'count') {
    items.sort((a, b) => b.count - a.count);
  } else if (currentWikiSort === 'name') {
    items.sort((a, b) => {
      const nameA = a.zh || a.name || '';
      const nameB = b.zh || b.name || '';
      return nameA.localeCompare(nameB, 'zh-Hans-CN');
    });
  }
  
  if (items.length === 0) {
    container.innerHTML = `
      <div class="wiki-empty-state" style="grid-column: 1 / -1; padding: 60px 0; text-align: center; color: #94a3b8;">
        <div style="font-size: 40px; margin-bottom: 16px;">🔍</div>
        <p>未找到匹配的${currentWikiType === 'tag' ? '标签' : '艺术家'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = items.map(item => createWikiCard(item, currentWikiType)).join('');
  
  // Add click listeners
  container.querySelectorAll('.wiki-card').forEach(card => {
    card.addEventListener('click', () => {
        const value = card.dataset.value;
        showWikiResults(value, card);
    });
  });
}

// ==================== Bulk Management Functions ====================
function enterBulkMode() {
  isBulkMode = true;
  selectedIndices.clear();
  
  const toggleBulkBtn = document.getElementById('toggle-bulk-mode');
  const bulkActionBar = document.getElementById('bulk-action-bar');
  const galleryGrid = document.getElementById('gallery-grid');
  
  if (toggleBulkBtn) toggleBulkBtn.classList.add('active');
  if (bulkActionBar) bulkActionBar.style.display = 'flex';
  if (galleryGrid) galleryGrid.classList.add('bulk-mode');
  
  updateBulkUI();
}

function exitBulkMode() {
  isBulkMode = false;
  selectedIndices.clear();
  
  const toggleBulkBtn = document.getElementById('toggle-bulk-mode');
  const bulkActionBar = document.getElementById('bulk-action-bar');
  const galleryGrid = document.getElementById('gallery-grid');
  
  if (toggleBulkBtn) toggleBulkBtn.classList.remove('active');
  if (bulkActionBar) bulkActionBar.style.display = 'none';
  if (galleryGrid) {
    galleryGrid.classList.remove('bulk-mode');
    // Remove selected class from all cards
    galleryGrid.querySelectorAll('.gallery-card').forEach(card => {
      card.classList.remove('selected');
    });
  }
}

function updateBulkUI() {
  const selectedCount = document.getElementById('selected-count');
  const bulkSelectAllBtn = document.getElementById('bulk-select-all');
  const filteredImages = getFilteredImages();
  
  if (selectedCount) {
    selectedCount.innerText = `已选择 ${selectedIndices.size} 项`;
  }
  
  if (bulkSelectAllBtn) {
    bulkSelectAllBtn.innerText = selectedIndices.size === filteredImages.length && filteredImages.length > 0 ? '取消全选' : '全选';
  }
  
  // Update visual state of cards
  document.querySelectorAll('.gallery-card').forEach(card => {
    const index = parseInt(card.dataset.index);
    if (selectedIndices.has(index)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

function getFilteredImages() {
  return allImages.map((img, index) => ({ ...img, originalIndex: index })).filter(img => {
    // 1. Search filter
    if (currentFilters.search) {
      const searchStr = [
        img.analysis_summary || '',
        ...(img.tags || []).map(t => (t.zh || '') + (t.en || '')),
        ...(img.style_masters || []).map(m => m.name || ''),
        img.ai_drawing_prompt || ''
      ].join(' ').toLowerCase();
      if (!searchStr.includes(currentFilters.search.toLowerCase())) return false;
    }
    
    // 2. Category filter
    if (currentFilters.category !== 'all' && img.determined_class !== currentFilters.category) return false;
    
    // 3. Tag filter (multi-selection) - AND logic
    if (currentFilters.tags.length > 0) {
      const hasAllTags = currentFilters.tags.every(selectedTag => 
        (img.tags || []).some(t => t.zh === selectedTag)
      );
      if (!hasAllTags) return false;
    }
    
    // 4. Artist filter
    if (currentFilters.artist && !(img.style_masters || []).some(m => m.name === currentFilters.artist)) return false;
    
    return true;
  });
}

async function downloadSelectedImages() {
  const indices = Array.from(selectedIndices);
  if (indices.length === 0) return;
  
  showToast(`正在准备下载 ${indices.length} 张图片...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const index of indices) {
    const img = allImages[index];
    if (!img || !img.imageUrl) {
      failCount++;
      continue;
    }
    
    try {
      // Use chrome.downloads API if available
      if (typeof chrome !== 'undefined' && chrome.downloads) {
        const filename = `sparkze_${img.timestamp || Date.now()}_${successCount}.png`;
        await new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: img.imageUrl,
            filename: filename,
            saveAs: false
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(downloadId);
            }
          });
        });
        successCount++;
      } else {
        // Fallback for non-extension environment or missing API
        const link = document.createElement('a');
        link.href = img.imageUrl;
        link.download = `sparkze_${img.timestamp || Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        successCount++;
        // Small delay to avoid browser blocking multiple downloads
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.error('Download failed:', err);
      failCount++;
    }
  }
  
  showToast(`下载完成: 成功 ${successCount} 张${failCount > 0 ? `, 失败 ${failCount} 张` : ''}`);
  
  if (successCount > 0) {
    exitBulkMode();
  }
}
