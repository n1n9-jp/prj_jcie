# CLAUDE.md

このファイルは、このリポジトリ内のコードを操作する際に Claude Code (claude.ai/code) にガイダンスを提供します。

## Project Overview

これは、JCIE（日本国際交流センター）のために作成された、HIV/AIDSに関する日本語のインタラクティブなスクロールテリングウェブアプリケーションです。このアプリケーションは、インタラクティブなチャートと没入型世界地図を通して、HIV/AIDSに関する歴史的データと個人のストーリーを紹介します。

## Architecture

### Core Components

- **Scroll Controller** (`main.js`): Central orchestrator that manages scroll-triggered animations, data loading, state management, and component coordination using Scrollama.js and PubSub pattern. 単一チャートコンテナ構造に最適化済み
- **Chart System** (`chart-manager.js`): D3.js-based visualization engine supporting line charts, pie charts, and dual charts with responsive design and unified legend system. 単一SVGコンテナ管理とスムーズ遷移機能を実装
- **Map System** (`map.js`): Interactive world map using D3.js and geographic projections with zoom/pan capabilities and smooth transition effects
- **Modal Manager** (`map-modal.js`): Overlay modal system for displaying country-specific episodes with content management and error handling
- **CSS Configuration** (`tailwind.config.js`): Tailwind CSS configuration for responsive typography and mobile optimization
- **HTML Structure** (`index.html`): Single-page application with scrollable sections using data-step attributes (1z-5f) to trigger different visualizations. 単一チャートコンテナ構造に最適化済み
- **PubSub System** (`lib/pubsub.js`): Event-driven communication between components

### Current Status (Latest)

#### Chart Display System
- **Architecture**: Fully optimized single-container chart system
- **Reliability**: Comprehensive error handling with graceful degradation
- **Performance**: Memory-efficient with proper resource cleanup
- **Debugging**: Extensive console logging for issue identification
- **Compatibility**: Resolved CSS conflicts and display issues

#### Known Issues Resolved
- ✅ Promise resolution in multi-element transitions
- ✅ State management during error conditions  
- ✅ CSS conflicts between Tailwind and custom styles
- ✅ SVG sizing and container detection
- ✅ Initialization sequence and dependency loading

### HTML構成要素

#### 入れ子構造（最適化後）
```
body
├── #mapBgContainer (全画面固定地図背景)
├── main (メインコンテンツ領域)
│   ├── header
│   │   └── nav (固定ナビゲーションバー)
│   ├── #intro (イントロセクション)
│   ├── #scrolly (スクロールテリングセクション)
│   │   ├── article (テキストコンテンツ)
│   │   │   └── .step[data-step] (スクロールトリガー要素群)
│   │   └── #smallFigure.chart-container (統一チャートコンテナ)
│   └── footer
│       └── #outro (アウトロセクション)
└── #modalCountry (国別エピソードモーダル)
    └── モーダル内容要素 (タイトル、画像、説明文、リンク)
```

#### 基本レイアウト
- **ナビゲーションバー** (`header > nav`): 固定ヘッダーでJCIEブランドとコンテンツ切り替え（エイズ・結核・マラリア）を提供
- **メインコンテンツ** (`main`): 相対配置でスクロール可能なコンテンツ領域
- **イントロセクション** (`#intro`): 上部余白を提供するための導入部

#### 可視化コンテナ（最適化後）
- **地図背景コンテナ** (`#mapBgContainer`): 全画面固定位置で世界地図を描画するための背景領域
- **統一チャートコンテナ** (`#smallFigure.chart-container`): 単一のレスポンシブチャート表示領域。CSSでモバイル・デスクトップ対応、スムーズ遷移機能付き

#### スクロールテリング構造
- **スクロールセクション** (`#scrolly`): Flexboxレイアウトでテキストとチャートを並列配置
- **テキスト記事** (`article`): 左側（モバイルでは上部）に配置されたスクロール可能なストーリー領域
- **ステップ要素** (`.step`): 各data-step属性（1z-5f）を持つスクロールトリガー要素群
  - 見出しステップ（1z, 2z, 3z, 4z, 5z）: 各章の導入
  - 内容ステップ（1a-1c, 2a-2e, 3a-3, 4a-4d, 5a-5f）: 詳細なストーリーコンテンツ
  - 特殊ステップ（3）: 地図エピソード表示用の大型スクロール領域

#### モーダルシステム
- **国別エピソードモーダル** (`#modalCountry`): オーバーレイ形式で国別ストーリーを表示
- **モーダル内容要素**: タイトル、画像、説明文、外部リンクを含む構造化されたコンテンツ

#### フッター
- **アウトロセクション** (`#outro`): 終了メッセージを表示する終了部

### Data Flow

1. **Episode Data** (`data/episode.json`): Contains country stories with titles, descriptions, thumbnails, and URLs
2. **Chart Data** (`data/*.csv`): Time-series data for HIV/AIDS statistics across different regions
3. **Geographic Data** (`data/countries-110m.json`): TopoJSON world map data for country visualization

### Key Features

- **Scroll-triggered Visualization**: Different data-step values trigger specific charts or map interactions
- **Optimized Chart System**: Single container architecture with smooth transitions and improved performance
- **Responsive Design**: Charts use viewBox for scalability with CSS-controlled responsive sizing, map adapts to screen size
- **Modal System**: Country episodes display in overlay modals with external links
- **Progressive Episode Display**: Map episodes advance based on scroll progress within step 3

## Development

### Running the Application

This is a static HTML application. Serve locally using any HTTP server:
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

### File Structure

- `assets/js/`: All JavaScript modules
- `assets/css/`: Styling (uses Tailwind CSS via CDN)
- `data/`: CSV and JSON data files
- `assets/thumb/`: Episode thumbnail images

### Key Technical Details

- Uses D3.js v7 for visualizations
- Tailwind CSS for styling with custom responsive chart container classes
- Scrollama.js for scroll-based interactions
- Single SVG container architecture for improved performance
- Smooth chart transitions with fade effects
- No build process required - runs directly in browser
- Japanese language content throughout
- Responsive design supporting mobile and desktop

### Recent Optimizations (2024)

#### Chart System Improvements
- **Single Container Architecture**: Eliminated dual container complexity (#largeFigure removed)
- **Smooth Transitions**: Added fade-in/fade-out effects between chart changes with proper Promise handling
- **Performance Optimization**: Reduced memory usage and improved ResizeObserver efficiency
- **Unified State Management**: Centralized chart state with transition locking and error recovery
- **CSS-based Responsiveness**: Moved sizing logic from JavaScript to CSS for better performance
- **Robust SVG Sizing**: Added initial size fallbacks and proper container detection

#### Code Structure Enhancements
- **Simplified Logic**: Reduced main.js complexity by eliminating container switching
- **Comprehensive Error Handling**: Full try-catch-finally blocks with transition state recovery
- **Cleaner APIs**: Updated method signatures to remove unnecessary parameters
- **Future-proof Design**: Architecture supports easy addition of new chart types
- **Debug Support**: Added extensive console logging for troubleshooting

#### Bug Fixes and Stability
- **Promise Resolution**: Fixed multi-element transition completion tracking
- **State Recovery**: Ensured `isTransitioning` flag reset on errors
- **CSS Conflicts**: Resolved Tailwind class conflicts with custom styles
- **Display Management**: Fixed container visibility logic
- **Initialization Flow**: Corrected PubSub event publishing sequence

#### Performance & Reliability
- **Error-resistant**: Application continues functioning even with chart rendering errors
- **Memory Efficient**: Single SVG container prevents memory leaks
- **Responsive**: Proper sizing across all device sizes
- **Debuggable**: Comprehensive logging for issue identification

### Troubleshooting Guide

#### Chart Display Issues
If charts are not displaying, check the browser console for:
1. **Initialization**: Look for "ChartManager: Initializing charts" and "SVG container created"
2. **Container Detection**: Verify "Container found" log for #smallFigure
3. **Data Loading**: Check for successful CSV data loading
4. **Draw Operations**: Look for "Drawing chart for step: [stepId]" messages
5. **Errors**: Any JavaScript errors will be logged with full stack traces

#### Common Console Messages
- `ChartManager: Looking for container: smallFigure` - Normal initialization
- `ChartManager: SVG created with initial size: [width]x[height]` - Successful setup
- `Drawing chart for step: [stepId]` - Chart rendering triggered
- `ChartManager: Line chart drawn successfully` - Successful chart creation

#### File Dependencies
Ensure all required files are present and accessible:
- D3.js v7 (CDN)
- Scrollama.js (local: assets/js/lib/scrollama.min.js)
- Data files (data/*.csv, data/episode.json)
- Map data (data/countries-110m.json)