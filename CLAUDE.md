# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sparkze - Chrome Extension

AI-powered visual analysis tool for design inspiration collection. Analyzes images using Google Gemini or Volcengine Doubao Vision, extracts tags, color styles, artist references, and Pinterest search suggestions.

## Project Type

**Chrome Extension (Manifest V3)** - Pure vanilla JavaScript, no build system required. Load directly in Chrome.

## Development Workflow

1. **Load extension**: Open `chrome://extensions/` → Enable Developer mode → Load unpacked → Select project directory
2. **Reload changes**: Click refresh icon on extension card, or use "立即重载插件" button in options page
3. **Debug**: Filter console logs by `[Sparkze]` prefix

## Architecture

```
User hovers image → content.js detects → click → background.js calls AI API
→ sidepanel.js shows result → user saves → chrome.storage.local persists
```

### Component Responsibilities

| File | Role |
|------|------|
| `manifest.json` | Extension configuration (V3) |
| `background.js` | Service worker - API calls, message routing |
| `content.js` | Image detection on web pages (hover/click) |
| `sidepanel.js/html` | Analysis results side panel |
| `gallery.js/html` | Full gallery view with filtering |
| `options.js/html` | API configuration settings |
| `styles.css` | Single stylesheet with CSS variables |

## Tech Stack

- Vanilla JavaScript (ES6+)
- Chrome Extension APIs (Manifest V3)
- AI: Google Gemini or Volcengine Doubao Vision
- Storage: `chrome.storage.local`

## Key Patterns

- **Message passing**: `content.js` ↔ `background.js` ↔ `sidepanel.js` via `chrome.runtime.onMessage`
- **CSS variables**: Theme defined in `:root` (colors, gradients, border-radius)
- **Image optimization**: Parses `srcset` for highest quality; special handling for Pinterest/Behance/Instagram URLs

## API Configuration

Settings stored in `chrome.storage.local`:
- `provider`: "google" or "volcengine"
- `model`: Model ID (e.g., `gemini-1.5-flash`, `doubao-vision-pro`)
- `apiKey`: Provider API key
- `customModelId`: Optional custom model ID for Volcengine
