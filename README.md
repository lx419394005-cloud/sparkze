# Sparkze ✨

> AI-powered visual analysis and design inspiration collection tool

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🎯 Features

- **🔍 AI Visual Analysis** - Analyze images using Google Gemini or Volcengine Doubao Vision
- **🎨 Smart Tagging** - Auto-extract tags, color styles, and artist references
- **📌 Quick Collection** - Hover over any image and save with one click
- **🖼️ Gallery View** - Organize and search your inspiration library
- **🎭 Wiki View** - Browse by tags and artists
- **✏️ AI Drawing** - Generate images with Volcengine Jimeng models
- **⚡ Performance Optimized** - Debounced search, efficient rendering

## 📸 Screenshots

![Badge](docs/badge-demo.png)
![Analysis](docs/analysis-demo.png)
![Gallery](docs/gallery-demo.png)

## 🚀 Quick Start

### Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder

### Configuration

1. Click the Sparkze icon in the toolbar
2. Go to Settings
3. Choose your AI provider (Google Gemini or Volcengine)
4. Enter your API key
5. Save settings

## 🎨 Usage

### Analyze Images

1. Visit any website with images
2. Hover over an image
3. Click the analysis badge
4. View AI-generated insights in the side panel

### Save Inspiration

- **Quick Save**: Click the bookmark icon on the badge
- **After Analysis**: Click "Save" in the analysis panel
- **Add Tags**: Manually add custom tags

### Browse Gallery

- Click "Open Gallery" to view all saved images
- Search by keywords, tags, or artists
- Filter by categories
- Bulk download selected images

### AI Drawing

1. Open the side panel
2. Switch to "Drawing" tab
3. Enter your prompt
4. Select model and parameters
5. Generate images

## 🛠️ Tech Stack

- **Vanilla JavaScript** - No frameworks, pure ES6+
- **Chrome Extension API** - Manifest V3
- **AI Services**:
  - Google Gemini Vision API
  - Volcengine ARK Platform (Doubao Vision & Jimeng)
- **Storage**: Chrome Local Storage

## 📁 Project Structure

```
sparkze/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content.js             # Content script (badge injection)
├── sidepanel.html/js      # Side panel UI
├── gallery.html/js        # Full gallery view
├── draw.html/js           # AI drawing interface
├── options.html/js        # Settings page
├── styles.css             # Unified styles
├── utils.js               # Utility functions
└── icons/                 # Extension icons
```

## ⚡ Performance Optimizations

- **Debounced Search** - 300ms delay for search inputs
- **Throttled Events** - 50ms throttle for mouse movements
- **DOM Caching** - Cached element queries
- **Lazy Loading** - On-demand content loading
- **Optimized Logging** - Toggle-able debug logs

## 🎓 Development

### Prerequisites

- Node.js (for syntax checking)
- Chrome Browser

### Testing

```bash
# Check syntax
./verify-optimization.sh

# Run performance tests
# Open browser console and run:
PinkerPerformanceTest.runAll()
```

### Building

No build process required! Load directly in Chrome.

## 📝 Configuration

### API Keys

Get your API keys:
- **Google Gemini**: [AI Studio](https://aistudio.google.com/app/apikey)
- **Volcengine ARK**: [ARK Console](https://console.volcengine.com/ark)

Configure your preferred AI provider and model in the extension settings.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Google Gemini API
- Volcengine ARK Platform
- Chrome Extension Documentation

## 📮 Contact

- Issues: [GitHub Issues](https://github.com/yourusername/sparkze/issues)
- Email: your.email@example.com

---

Made with ✨ by [Your Name]
