// Tab 切换
document.querySelectorAll('.sidepanel-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    if (tabName === 'gallery') {
      window.location.href = 'sidepanel.html';
    }
  });
});

// 返回图库按钮
document.getElementById('back-to-gallery')?.addEventListener('click', () => {
  window.location.href = 'sidepanel.html';
});

// 模型配置
const MODEL_CONFIG = {
  '4-0': 'doubao-seedream-4-0-250828',
  '4-5': 'doubao-seedream-4-5-251128'
};

// DOM 元素
const generateBtn = document.getElementById('generate-btn');
const promptInput = document.getElementById('prompt-input');
const resultSection = document.getElementById('draw-result');
const loadingSection = document.getElementById('draw-loading');
const errorSection = document.getElementById('draw-error');
const resultImagesContainer = document.getElementById('result-images');
const saveBtn = document.getElementById('save-btn');
const downloadBtn = document.getElementById('download-btn');
const retryBtn = document.getElementById('retry-btn');
const sequentialToggle = document.getElementById('sequential-toggle');
const errorText = errorSection.querySelector('.draw-error-text');

let currentResultImages = [];

// 根据模型显示/隐藏组图选项
document.querySelectorAll('input[name="model"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const model = e.target.value;
    const sequentialGroup = document.querySelector('.sequential-group');
    if (model.includes('4-0') || model.includes('4-5')) {
      sequentialGroup.style.display = 'flex';
    } else {
      sequentialGroup.style.display = 'none';
      sequentialToggle.checked = false;
    }
  });
});

// 生成按钮点击事件
generateBtn.addEventListener('click', generateImage);

// 重试按钮
retryBtn.addEventListener('click', () => {
  errorSection.style.display = 'none';
  generateImage();
});

// 保存按钮
saveBtn.addEventListener('click', async () => {
  if (!currentResultImages.length) return;

  try {
    const now = Date.now();
    const { savedImages = [] } = await chrome.storage.local.get(['savedImages']);
    const prompt = promptInput.value;
    const items = currentResultImages.map((url, i) => ({
      imageUrl: url,
      pageUrl: 'AI生成',
      determined_class: 'AI_GENERATED',
      analysis_summary: prompt ? prompt.substring(0, 100) : '使用即梦 AI 生成的图片',
      tags: [{ en: 'AI Generated', zh: 'AI 生成', wiki: '' }],
      style_masters: [],
      pinterest_search_chips: [],
      ai_drawing_prompt: prompt,
      timestamp: now + i
    }));

    savedImages.unshift(...items);
    await chrome.storage.local.set({ savedImages });

    showToast('已保存到收藏');
  } catch (error) {
    showToast('保存失败: ' + error.message);
  }
});

// 下载按钮
downloadBtn.addEventListener('click', () => {
  if (!currentResultImages.length) return;
  currentResultImages.forEach((url, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `jimeng_${Date.now()}_${i + 1}.png`;
      a.click();
    }, i * 200);
  });
});

// 显示 Toast
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// 生成图片
async function generateImage() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showError('请输入提示词');
    return;
  }

  // 获取配置
  const config = await chrome.storage.local.get(['provider', 'apiKey', 'model', 'volcengineApiKey']);
  
  // 兼容旧配置
  const apiKey = config.apiKey || config.volcengineApiKey;
  const provider = config.provider || 'volcengine';
  
  if (!apiKey) {
    showError('请先在设置中配置 API Key');
    return;
  }

  // 隐藏其他区域，显示加载
  resultSection.style.display = 'none';
  errorSection.style.display = 'none';
  loadingSection.style.display = 'block';
  generateBtn.disabled = true;

  // 获取参数
  const modelKey = document.querySelector('input[name="model"]:checked').value;
  const model = MODEL_CONFIG[modelKey];
  const size = document.querySelector('input[name="size"]:checked').value;
  const watermark = document.querySelector('input[name="watermark"]:checked').value === 'true';
  const sequential = sequentialToggle.checked ? 'auto' : undefined;

  // 构建请求体
  const body = {
    model: model,
    prompt: prompt,
    size: size,
    watermark: watermark,
    stream: false,
    response_format: 'url'
  };

  if (sequential) {
    body.sequential_image_generation = sequential;
  }

  // Log 请求信息
  SparkzeUtils.logger.log('[Jimeng] === Request Info ===');
  SparkzeUtils.logger.log('[Jimeng] URL:', 'https://ark.cn-beijing.volces.com/api/v3/images/generations');
  SparkzeUtils.logger.log('[Jimeng] Method: POST');
  SparkzeUtils.logger.log('[Jimeng] Headers:', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer [HIDDEN]'
  });
  SparkzeUtils.logger.log('[Jimeng] Body:', JSON.stringify(body, null, 2));
  SparkzeUtils.logger.log('[Jimeng] ===================');

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.volcengineApiKey}`
      },
      body: JSON.stringify(body)
    });

    // Log 响应信息
    SparkzeUtils.logger.log('[Jimeng] === Response Info ===');
    SparkzeUtils.logger.log('[Jimeng] Status:', response.status, response.statusText);
    SparkzeUtils.logger.log('[Jimeng] Headers:', Object.fromEntries([...response.headers]));
    const responseText = await response.text();
    SparkzeUtils.logger.log('[Jimeng] Raw Response:', responseText);
    SparkzeUtils.logger.log('[Jimeng] ===================');

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

    const imageUrls = (data.data || [])
      .map(item => item?.url)
      .filter(Boolean);

    if (imageUrls.length === 0) {
      throw new Error('未获取到生成的图片');
    }

    currentResultImages = imageUrls;
    if (resultImagesContainer) {
      resultImagesContainer.innerHTML = imageUrls
        .map(url => `<img src="${url}" alt="AI 生成的图片" class="draw-result-image">`)
        .join('');
    }
    resultSection.style.display = 'block';
  } catch (error) {
    console.error('[Jimeng] Error:', error);
    showError(error.message);
  } finally {
    loadingSection.style.display = 'none';
    generateBtn.disabled = false;
  }
}

// 显示错误
function showError(message) {
  errorText.textContent = message;
  errorSection.style.display = 'flex';
}
