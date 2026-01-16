document.addEventListener('DOMContentLoaded', async () => {
  const providerSelect = document.getElementById('provider');
  const apiKeyInput = document.getElementById('api-key');
  const apiKeyHint = document.getElementById('api-key-hint');
  const apiDocLink = document.getElementById('api-doc-link');
  const saveBtn = document.getElementById('save-settings');
  const statusMsg = document.getElementById('status-msg');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');

  // 模型管理相关元素
  const newModelName = document.getElementById('new-model-name');
  const newModelId = document.getElementById('new-model-id');
  const addModelBtn = document.getElementById('add-model-btn');
  const modelsList = document.getElementById('models-list');
  const noModelsTip = document.getElementById('no-models');

  // 服务商文档链接配置
  const DOC_LINKS = {
    volcengine: { url: 'https://console.volcengine.com/ark', hint: '火山引擎 API 密钥', text: '🔗 获取火山引擎 API Key' },
    gemini: { url: 'https://aistudio.google.com/app/apikey', hint: 'Google Gemini API Key', text: '🔗 获取 Gemini API Key' }
  };

  // 侧边栏导航切换
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = item.getAttribute('data-section');

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `section-${sectionId}`) {
          section.classList.add('active');
        }
      });
    });
  });

  // 服务商切换时更新 UI
  providerSelect.addEventListener('change', () => {
    const provider = providerSelect.value;
    const docInfo = DOC_LINKS[provider];
    apiKeyHint.textContent = docInfo.hint;
    apiDocLink.innerHTML = `<a href="${docInfo.url}" target="_blank">${docInfo.text}</a>`;
  });

  // 密码显示/隐藏切换
  togglePasswordBtn.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🔒';
  });

  // 开发者工具：重载插件
  const reloadBtn = document.getElementById('reload-extension');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      reloadBtn.textContent = '正在重载...';
      setTimeout(() => {
        chrome.runtime.reload();
      }, 500);
    });
  }

  // 加载已保存的配置
  const config = await chrome.storage.local.get(['provider', 'geminiApiKey', 'volcengineApiKey', 'models', 'activeModelId']);

  if (config.provider) providerSelect.value = config.provider;
  // 按服务商加载对应的 API Key
  const currentProvider = config.provider || 'volcengine';
  if (currentProvider === 'gemini' && config.geminiApiKey) {
    apiKeyInput.value = config.geminiApiKey;
  } else if (config.volcengineApiKey) {
    apiKeyInput.value = config.volcengineApiKey;
  }

  // 更新服务商相关的 UI
  const docInfo = DOC_LINKS[config.provider || 'volcengine'];
  apiKeyHint.textContent = docInfo.hint;
  apiDocLink.innerHTML = `<a href="${docInfo.url}" target="_blank">${docInfo.text}</a>`;

  // 加载模型列表
  let savedModels = config.models || [];
  let activeModelId = config.activeModelId;

  renderModelsList(savedModels, activeModelId);

  // 添加模型
  addModelBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const name = newModelName.value.trim();
    const modelId = newModelId.value.trim();

    if (!name) {
      showStatus('请输入显示名称', 'error');
      return;
    }
    if (!modelId) {
      showStatus('请输入模型 ID', 'error');
      return;
    }

    // 检查是否已存在相同模型 ID
    if (savedModels.some(m => m.modelId === modelId && m.provider === provider)) {
      showStatus('该模型 ID 已存在', 'error');
      return;
    }

    const newModel = {
      id: Date.now().toString(),
      name,
      provider,
      modelId,
      createdAt: Date.now()
    };

    savedModels.push(newModel);

    // 如果是第一个模型，自动激活
    if (savedModels.length === 1) {
      activeModelId = newModel.id;
    }

    await saveModelsAndActiveModel(savedModels, activeModelId || newModel.id);

    // 清空表单
    newModelName.value = '';
    newModelId.value = '';

    renderModelsList(savedModels, activeModelId || newModel.id);
    showStatus('模型添加成功', 'success');
  });

  // 删除模型
  window.deleteModel = async (modelId) => {
    const model = savedModels.find(m => m.id === modelId);
    if (!model) return;

    if (!confirm(`确定要删除模型 "${model.name}" 吗？`)) return;

    savedModels = savedModels.filter(m => m.id !== modelId);

    // 如果删除的是当前激活的模型，激活第一个模型或清空
    let newActiveId = activeModelId;
    if (activeModelId === modelId) {
      newActiveId = savedModels.length > 0 ? savedModels[0].id : null;
    }

    await saveModelsAndActiveModel(savedModels, newActiveId);
    renderModelsList(savedModels, newActiveId);
    showStatus('模型已删除', 'success');
  };

  // 激活模型
  window.activateModel = async (modelId) => {
    await chrome.storage.local.set({ activeModelId: modelId });
    renderModelsList(savedModels, modelId);
    showStatus('模型已激活', 'success');
  };

  // 渲染模型列表
  function renderModelsList(models, activeId) {
    if (models.length === 0) {
      modelsList.innerHTML = '';
      noModelsTip.style.display = 'block';
      return;
    }

    noModelsTip.style.display = 'none';
    modelsList.innerHTML = models.map(model => `
      <div class="model-card ${model.id === activeId ? 'active' : ''}" data-id="${model.id}">
        <div class="model-card-header">
          <span class="model-name">${escapeHtml(model.name)}</span>
          <span class="model-provider-badge ${model.provider}">${model.provider === 'gemini' ? '🔷 Gemini' : '🌋 火山'}</span>
        </div>
        <div class="model-id">${escapeHtml(model.modelId)}</div>
        <div class="model-card-actions">
          ${model.id === activeId
            ? '<span class="active-badge">✓ 已激活</span>'
            : `<button class="activate-btn" data-action="activate" data-id="${model.id}">激活</button>`
          }
          <button class="delete-btn" data-action="delete" data-id="${model.id}">删除</button>
        </div>
      </div>
    `).join('');

    // 事件委托处理按钮点击
    modelsList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const modelId = e.currentTarget.dataset.id;
        if (action === 'activate') {
          activateModel(modelId);
        } else if (action === 'delete') {
          deleteModel(modelId);
        }
      });
    });
  }

  // 保存模型列表和激活状态
  async function saveModelsAndActiveModel(models, activeId) {
    await chrome.storage.local.set({
      models,
      activeModelId: activeId
    });
  }

  // 保存配置
  saveBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('请输入 API Key', 'error');
      return;
    }

    // 检查是否有激活的模型
    const { activeModelId: currentActiveId } = await chrome.storage.local.get('activeModelId');
    if (!currentActiveId || !savedModels.find(m => m.id === currentActiveId)) {
      showStatus('请先添加并激活一个模型', 'error');
      return;
    }

    // 按服务商分别存储 API Key
    const saveData = { provider };
    if (provider === 'gemini') {
      saveData.geminiApiKey = apiKey;
    } else {
      saveData.volcengineApiKey = apiKey;
    }

    await chrome.storage.local.set(saveData);

    showStatus('配置已保存', 'success');
  });

  function showStatus(msg, type) {
    statusMsg.innerText = msg;
    statusMsg.className = type;
    setTimeout(() => {
      statusMsg.innerText = '';
      statusMsg.className = '';
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
