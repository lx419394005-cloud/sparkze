// 导入工具库
try {
  importScripts('utils.js');
} catch (e) {
  console.warn('[Sparkze] Failed to import utils.js, using console directly');
}

const SYSTEM_PROMPT = `# Role
You are a Senior Vision Analyst & AI Art Strategist. Your goal is to deconstruct images into professional metadata for a high-end design inspiration library.

# Step 1: Scenario Classification (Category Routing)
- [COMMERCIAL_FASHION]: Hybrid of Human + Product. (Priority Mode)
- [PORTRAIT]: Real biological subjects (Human/Animal).
- [PRODUCT]: Static industrial or lifestyle objects.
- [LANDSCAPE]: Natural or wide urban environments.
- [CONCEPT_CROWD]: Large groups, rhythmic patterns, or narrative scenes.
- [ARCHITECTURE]: Buildings and interior spaces.
- [ART]: Illustrations, 3D renders, and non-photographic media.
- [DESIGN]: Graphic layouts, posters, and typography.

# Step 2: Analysis Dimensions
- [NON-ART/DESIGN CATEGORIES]: For all categories EXCEPT [ART] and [DESIGN], you MUST include a "Color Style/Film Grade" (色彩风格/胶片色) tag in the "tags" array. Use professional naming conventions (e.g., "Kodak Portra 400", "Fujifilm Superia", "Teal & Orange", "Muted Cinematic", "Kodak 5020", etc.) to describe the aesthetic.
- [COMMERCIAL_FASHION]: DUAL-TRACK (Subject: Pose, Anatomy, Skin) + (Product: Fabric, Fit, Finish).
- [LANDSCAPE]: Terrain, Weather/Time, Space Depth.
- [CONCEPT_CROWD]: Formation, Narrative Theme, Visual Rhythm.
- [PORTRAIT/PRODUCT/ARCH./ART/DESIGN]: Apply standard professional dimensions (Angle, Lighting, Style, Medium, Material, Layout).

# Step 3: Analysis Summary (The Soul of the Metadata)
Provide a 3-sentence "analysis_summary" for EVERY image:
1. Describe the relationship between the subject and the environment.
2. Reveal the technical methods used (lighting, composition, or brushwork).
3. Summarize the overall atmosphere and professional application.
4. Output the analysis_summary in Chinese.

# Step 4: Artist Archetypes
Identify 1-2 Master Artists/Photographers whose style matches the image. Explain the specific stylistic connection.

# Step 5: Search & Drawing Optimization
- Pinterest Search Suggestions: Provide 3-5 optimized search queries. Each query should be an object with "label" (a short, catchy Chinese name for the search) and "query" (the actual English search terms). For men's fashion, always prefix queries with "Men's".
- AI Drawing Prompt: Synthesized MJ/SD keywords including the artist's name.

# Output Format (Strict JSON)
{
  "determined_class": "CLASS_NAME",
  "analysis_summary": "使用中文输出...",
  "tags": [
    {"en": "Term", "zh": "名称", "wiki": "简短科普"}
  ],
  "style_masters": [
    {"name": "Artist Name", "reason": "联想该图像的专业风格"}
  ],
  "pinterest_search_chips": [
    {"label": "中文标签", "query": "English search terms"}
  ],
  "ai_drawing_prompt": "..."
}

Respond ONLY with the JSON.`;

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

let activeAnalysisController = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze_image') {
    handleAnalysis(request.imageUrl)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'start_sidepanel_analysis') {
    const { imageUrl, pageUrl } = request;
    
    // 检查是否有分析正在进行
    chrome.storage.local.get(['currentAnalysis'], ({ currentAnalysis }) => {
      if (currentAnalysis?.stage === 'loading') {
        sendResponse({ success: false, error: 'analysis_in_progress' });
        return;
      }

      const tryOpen = async (tabId) => {
        try {
          await chrome.sidePanel.open({ tabId });
          chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true }).catch(err => SparkzeUtils.logger.warn('setOptions failed:', err));
          runSidepanelAnalysis(imageUrl, pageUrl);
          sendResponse({ success: true });
        } catch (e) {
          console.error('[Sparkze] Failed to open sidepanel:', e);
          sendResponse({ success: false, error: e?.message || 'open_sidepanel_failed' });
        }
      };

      const tabId = sender.tab?.id;
      if (tabId) {
        tryOpen(tabId);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTabId = tabs?.[0]?.id;
          if (!activeTabId) {
            sendResponse({ success: false, error: 'missing_tab_id' });
            return;
          }
          tryOpen(activeTabId);
        });
      }
    });
    return true;
  }

  if (request.action === 'start_sidepanel_quick_save') {
    const { imageUrl, pageUrl } = request;
    const draft = { stage: 'draft', imageUrl, pageUrl, timestamp: Date.now() };

    const tryOpen = async (tabId) => {
      try {
        // 尝试打开侧栏 - 优先执行以捕获用户手势
        // 注意：在 Chrome Extension 中，sendMessage 的接收端通常被认为是在用户手势上下文中，
        // 但 await 异步操作可能会导致手势丢失。因此先尝试打开。
        await chrome.sidePanel.open({ tabId });
        
        // 确保 sidepanel 配置正确
        // 我们不 await 这个操作，以免阻塞后续流程
        chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true }).catch(err => SparkzeUtils.logger.warn('setOptions failed:', err));

        // 异步保存草稿状态
        await chrome.storage.local.set({ currentQuickSave: draft });
        
        // 发送消息通知 sidepanel 更新
        chrome.runtime.sendMessage({ action: 'quick_save_start', draft }).catch(() => {});
        sendResponse({ success: true });
      } catch (e) {
        console.error('[Sparkze] Quick save sidepanel open failed:', e);
        // 如果 open 失败，可能是因为某些特殊的上下文问题，我们尝试 fallback
        sendResponse({ success: false, error: e?.message || 'quick_save_failed' });
      }
    };

    const tabId = sender.tab?.id;
    if (tabId) {
      tryOpen(tabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTabId = tabs?.[0]?.id;
        if (!activeTabId) {
          sendResponse({ success: false, error: 'missing_tab_id' });
          return;
        }
        tryOpen(activeTabId);
      });
    }
    return true;
  }

  if (request.action === 'cancel_analysis') {
    if (activeAnalysisController) {
      activeAnalysisController.abort();
      activeAnalysisController = null;
      SparkzeUtils.logger.log('分析已由用户手动取消');
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'save_image') {
    saveImage(request.imageData)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

async function handleAnalysis(imageUrl) {
  SparkzeUtils.logger.log('--- 开始图片分析流程 ---');
  const config = await chrome.storage.local.get(['geminiApiKey', 'volcengineApiKey', 'models', 'activeModelId']);
  SparkzeUtils.logger.log('当前配置:', { activeModelId: config.activeModelId });

  // 根据激活模型的 provider 获取对应的 API Key
  const models = config.models || [];
  const activeModelId = config.activeModelId;
  const activeModel = models.find(m => m.id === activeModelId);

  if (!activeModel) {
    throw new Error('请先在插件设置中激活一个模型');
  }

  const { provider, modelId } = activeModel;
  const apiKey = provider === 'gemini' ? config.geminiApiKey : config.volcengineApiKey;

  if (!apiKey) {
    console.error('[Sparkze] 错误: 未配置 API Key', { provider });
    throw new Error(`请先在插件设置中配置 ${provider === 'gemini' ? 'Google Gemini' : '火山引擎'} 的 API Key`);
  }

  SparkzeUtils.logger.log('使用模型:', activeModel.name, `(${provider} - ${modelId})`);
  SparkzeUtils.logger.log('API Key 已加载:', provider);

  SparkzeUtils.logger.log('正在获取并转换图片数据 (Base64)...');
  const imageData = await fetchImageAsBase64(imageUrl);
  SparkzeUtils.logger.log('图片转换成功, MIME:', imageData.mimeType);
  SparkzeUtils.logger.log('完整 Base64 编码:', `data:${imageData.mimeType};base64,${imageData.base64}`);

  if (provider === 'volcengine') {
    SparkzeUtils.logger.log('使用火山引擎模型:', modelId);
    return callVolcengine(imageData, { ...config, apiKey }, modelId);
  } else {
    SparkzeUtils.logger.log('使用 Gemini 模型:', modelId);
    return callGemini(imageData, { ...config, apiKey }, modelId);
  }
}

async function fetchImageAsBase64(imageUrl) {
  SparkzeUtils.logger.log('正在抓取图片链接:', imageUrl);
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('loadend', () => resolve({
      base64: reader.result.split(',')[1],
      mimeType: blob.type
    }));
    reader.readAsDataURL(blob);
  });
}

async function callGemini(imageData, config, modelId, signal, updateStatus) {
  // 启用 SSE 流式响应
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?alt=sse`;
  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.base64
          }
        }
      ]
    }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  SparkzeUtils.logger.log(`Gemini Request URL: ${url}`);
  SparkzeUtils.logger.log('Gemini API Key:', config.apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey
    },
    body: JSON.stringify(body),
    signal: signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `Gemini API Error: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorMsg;
    } catch (e) {}
    console.error('[Sparkze] Gemini Error Response:', errorText);
    throw new Error(errorMsg);
  }

  // 流式读取响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let lastUpdateTime = Date.now();

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      throw new Error('Aborted');
    }

    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let appended = false;
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const textDelta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textDelta) {
            fullContent += textDelta;
            appended = true;
          }
        } catch (e) {}
      }
    }

    const now = Date.now();
    if (updateStatus && appended && now - lastUpdateTime > 100) {
      lastUpdateTime = now;

      const cleanContent = fullContent
        .replace(/```json\n?/g, '')
        .replace(/```/g, '')
        .replace(/\n/g, ' ')
        .trim();

      const estimatedProgress = Math.min(35 + (cleanContent.length / 3000) * 60, 95);

      await updateStatus({
        stage: 'loading',
        progress: Math.floor(estimatedProgress),
        statusText: 'AI 分析中',
        detailText: '正在解读图片内容...',
        streamingContent: cleanContent.slice(-200)
      });
    }
  }

  // SparkzeUtils.logger.log('Gemini Stream Response Received');

  try {
    const jsonStr = fullContent.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[Sparkze] Gemini JSON 解析失败，原始返回:', fullContent.substring(0, 500));
    throw new Error('模型返回格式错误，无法解析分析结果');
  }
}

async function callVolcengine(imageData, config, modelId, signal, updateStatus) {
  const url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  const body = {
    model: modelId,
    max_completion_tokens: 4096,
    reasoning_effort: "minimal",
    stream: true,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        'role': 'user',
        'content': [
          {
            'type': 'image_url',
            'image_url': {
              'url': `data:${imageData.mimeType};base64,${imageData.base64}`
            }
          },
          {
            'type': 'text',
            'text': '请根据 system prompt 的要求，对这张图片进行深度分析并输出 JSON 结果。'
          }
        ]
      }
    ]
  };

  SparkzeUtils.logger.log(`Volcengine Chat Request URL: ${url}`);
  SparkzeUtils.logger.log('Volcengine Request Body:', JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body),
    signal: signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Sparkze] Volcengine Error Response:', errorText);
    let errorMsg = `火山大模型 API Error: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  // 流式读取响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalLength = 0;
  let lastUpdateTime = Date.now();
  let streamingContent = ''; // 用于累积流式内容

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      throw new Error('Aborted');
    }

    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    totalLength += chunk.length;

    // 提取内容增量
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) streamingContent += delta;
        } catch (e) {}
      }
    }

    // 每 100ms 更新一次进度和流式内容
    const now = Date.now();
    if (now - lastUpdateTime > 100) {
      lastUpdateTime = now;
      // 估算进度：假设完整响应约 3000 字符
      const estimatedProgress = Math.min(35 + (totalLength / 3000) * 60, 95);

      // 清理流式内容，移除 markdown 代码块标记
      const cleanContent = streamingContent
        .replace(/```json\n?/g, '')
        .replace(/```/g, '')
        .replace(/\n/g, ' ')
        .trim();

      await updateStatus({
        stage: 'loading',
        progress: Math.floor(estimatedProgress),
        statusText: 'AI 分析中',
        detailText: '正在解读图片内容...',
        streamingContent: cleanContent.slice(-200) // 只保留最后 200 字符用于预览
      });
    }
  }

  // SparkzeUtils.logger.log('Volcengine Stream Response Received');

  // 流结束后提取 content
  const lines = buffer.split('\n');
  let fullContent = '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) fullContent += delta;
      } catch (e) {}
    }
  }

  // 如果没有 delta 模式，尝试直接获取 message
  if (!fullContent && lines.length > 0) {
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          const content = parsed.choices?.[0]?.message?.content;
          if (content) fullContent = content;
        } catch (e) {}
      }
    }
  }

  try {
    const jsonStr = fullContent.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[Sparkze] JSON 解析失败，原始返回:', fullContent.substring(0, 500));
    throw new Error('模型返回格式错误，无法解析分析结果');
  }
}

async function saveImage(imageData) {
  const { savedImages = [] } = await chrome.storage.local.get('savedImages');
  const newImages = [imageData, ...savedImages];
  await chrome.storage.local.set({ savedImages: newImages });
}

// --- Sidepanel Analysis Workflow ---

async function runSidepanelAnalysis(imageUrl, pageUrl) {
  const updateStatus = async (status) => {
    SparkzeUtils.logger.log('Analysis Update:', status.stage, status.detailText);
    await chrome.storage.local.get(['currentAnalysis']).then(async (result) => {
      const current = result.currentAnalysis || {};
      // 如果已经处于 success 或 error 状态，不再更新（除非是重置）
      if (current.stage === 'success' || current.stage === 'error') {
        if (status.stage === 'loading') { /* 允许重置为 loading */ }
        else return;
      }
      
      const newStatus = { ...status, imageUrl, pageUrl, timestamp: Date.now() };
      await chrome.storage.local.set({ currentAnalysis: newStatus });
      chrome.runtime.sendMessage({ action: 'analysis_update', status: newStatus }).catch(() => {});
    });
  };

  // 创建新的控制器
  if (activeAnalysisController) activeAnalysisController.abort();
  activeAnalysisController = new AbortController();
  const signal = activeAnalysisController.signal;

  // 设置 90s 超时
  const timeoutId = setTimeout(() => {
    if (activeAnalysisController) {
      activeAnalysisController.abort('timeout');
      SparkzeUtils.logger.warn('分析任务请求超时 (90s)');
    }
  }, 90000);

  try {
    await updateStatus({ stage: 'loading', progress: 5, statusText: '正在初始化...', detailText: '正在准备视觉分析引擎' });

    const config = await chrome.storage.local.get(['geminiApiKey', 'volcengineApiKey', 'models', 'activeModelId']);

    // 获取激活的模型
    const models = config.models || [];
    const activeModelId = config.activeModelId;
    const activeModel = models.find(m => m.id === activeModelId);

    if (!activeModel) {
      throw new Error('请先在插件设置中激活一个模型');
    }

    const { provider, modelId, name } = activeModel;
    const apiKey = provider === 'gemini' ? config.geminiApiKey : config.volcengineApiKey;

    if (!apiKey) {
      throw new Error(`请先在插件设置中配置 ${provider === 'gemini' ? 'Google Gemini' : '火山引擎'} 的 API Key`);
    }

    await updateStatus({ stage: 'loading', progress: 15, statusText: '正在下载图片...', detailText: '正在从目标页面获取高清图像' });
    const imageData = await fetchImageAsBase64(imageUrl);

    if (signal.aborted) return;

    await updateStatus({ stage: 'loading', progress: 25, statusText: '图片预处理...', detailText: '正在进行 Base64 编码与格式优化' });

    await new Promise(r => setTimeout(r, 300)); // 短暂延迟让用户看到进度

    if (signal.aborted) return;

    await updateStatus({ stage: 'loading', progress: 35, statusText: '准备请求...', detailText: '正在构建 AI 分析请求' });

    await new Promise(r => setTimeout(r, 200));

    if (signal.aborted) return;

    await updateStatus({ stage: 'loading', progress: 45, statusText: '连接 AI 模型...', detailText: '正在与云端 AI 建立安全连接' });

    let analysisResult;
    const apiConfig = { ...config, apiKey };
    if (provider === 'volcengine') {
      await updateStatus({ stage: 'loading', progress: 55, statusText: '正在分析图像...', detailText: `AI 正在解读 ${name} (${modelId})` });
      analysisResult = await callVolcengine(imageData, apiConfig, modelId, signal, updateStatus);
    } else {
      await updateStatus({ stage: 'loading', progress: 55, statusText: '正在分析图像...', detailText: `AI 正在解读 ${name} (${modelId})` });
      analysisResult = await callGemini(imageData, apiConfig, modelId, signal, updateStatus);
    }

    if (signal.aborted) return;

    await updateStatus({ stage: 'loading', progress: 75, statusText: '理解内容...', detailText: 'AI 正在理解图像语义与风格特征' });

    await new Promise(r => setTimeout(r, 300));

    await updateStatus({ stage: 'loading', progress: 85, statusText: '生成标签...', detailText: '正在提取视觉标签与风格溯源' });

    await new Promise(r => setTimeout(r, 200));

    await updateStatus({ stage: 'loading', progress: 92, statusText: '整理结果...', detailText: '正在格式化分析报告' });

    await updateStatus({
      stage: 'success',
      progress: 100,
      statusText: '分析完成',
      detailText: '视觉报告已生成',
      data: analysisResult
    });
  } catch (error) {
    if (error.name === 'AbortError' || signal.aborted) {
      const isTimeout = error === 'timeout' || signal.reason === 'timeout';
      await updateStatus({ 
        stage: 'error', 
        progress: 0, 
        statusText: isTimeout ? '分析超时' : '分析已取消', 
        detailText: isTimeout ? '请求超过 90 秒未响应，请重试或检查网络' : '您已取消了本次图片分析'
      });
    } else {
      console.error('[Sparkze] Sidepanel Analysis Error:', error);
      await updateStatus({ 
        stage: 'error', 
        progress: 0, 
        statusText: '分析失败', 
        detailText: error.message 
      });
    }
  } finally {
    clearTimeout(timeoutId);
    activeAnalysisController = null;
  }
}
