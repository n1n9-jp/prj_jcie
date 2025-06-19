# 統合設定システム

## 概要

このアプリケーションでは、アニメーション時間、色設定、レイアウト値などを外部JSONファイルで管理する統合設定システムを実装しています。この仕組みにより、コードを変更することなく、デザインやアニメーションの調整が可能になります。

## 設定ファイル構成

### 1. `/config/animation.config.json`
アニメーション時間とイージング設定

```json
{
  "durations": {
    "instant": 0,
    "fast": 150,
    "default": 500,
    "slow": 1200
  },
  "easings": {
    "linear": "linear",
    "easeInOut": "ease-in-out"
  },
  "presets": {
    "default": {
      "duration": "default",
      "easing": "quadInOut"
    }
  }
}
```

### 2. `/config/theme.config.json`
色設定とテーマ

```json
{
  "colors": {
    "primary": {
      "blue": "#2563eb"
    },
    "text": {
      "primary": "#1f2937"
    },
    "regions": {
      "アジア・太平洋地域": "#1f78b4"
    }
  }
}
```

### 3. `/config/app.config.json`
アプリケーション設定とレイアウト値

```json
{
  "layout": {
    "header": {
      "height": 60
    }
  },
  "breakpoints": {
    "mobile": 480,
    "tablet": 768
  }
}
```

## 使用方法

### JavaScriptでの設定値取得

```javascript
// 設定読み込み完了を待つ
await window.ConfigLoader.loadAll();

// アニメーション時間取得
const duration = window.ConfigLoader.getAnimationDuration('default'); // 500

// 色取得
const primaryColor = window.ConfigLoader.getColor('primary.blue'); // "#2563eb"

// 一般的な設定値取得
const headerHeight = window.ConfigLoader.get('app.layout.header.height'); // 60

// ブレークポイント取得
const mobileBreakpoint = window.ConfigLoader.getBreakpoint('mobile'); // 480
```

### CSSでの設定値使用

CSS変数として自動的に設定されるため、CSSで直接使用できます：

```css
.my-element {
  /* アニメーション */
  transition: transform var(--animation-default) var(--easing-ease-in-out);
  
  /* 色 */
  background-color: var(--color-primary-blue);
  color: var(--color-text-primary);
  
  /* レイアウト */
  height: var(--header-height);
  padding: var(--spacing-lg);
  
  /* 影 */
  box-shadow: var(--shadow-md);
}
```

### 既存クラスでの統合使用

#### AnimationConfig
```javascript
// 外部設定を考慮したプリセット取得
const presets = AnimationConfig.getPresets();
AnimationConfig.apply(selection, 'default');

// 外部設定からの速度取得
const speed = AnimationConfig.getSpeed('FAST'); // 外部設定優先
```

#### ColorScheme
```javascript
// 外部設定を考慮した地域色取得
const regionColor = window.ColorScheme.getColorForRegion('アジア・太平洋地域');
```

## フォールバック機能

設定ファイルが読み込めない場合や設定値が存在しない場合、以下のフォールバック処理が動作します：

1. **CSS変数**: デフォルト値が`:root`で事前定義済み
2. **JavaScript**: 各クラスでハードコードされたデフォルト値を使用
3. **自動復旧**: 設定読み込みが後から成功した場合、自動的に外部設定に切り替わり

## 設定のカスタマイズ

### 新しい色の追加
`theme.config.json`に新しい色を追加：

```json
{
  "colors": {
    "custom": {
      "brandPrimary": "#ff6b6b",
      "brandSecondary": "#4ecdc4"
    }
  }
}
```

JavaScript/CSSで使用：
```javascript
const brandColor = window.ConfigLoader.getColor('custom.brandPrimary');
```

```css
.brand-element {
  background-color: var(--color-custom-brand-primary);
}
```

### アニメーション時間の調整
`animation.config.json`で時間を変更：

```json
{
  "durations": {
    "default": 300  // 500ms から 300ms に短縮
  }
}
```

すべてのアニメーションが自動的に新しい時間で動作します。

## デバッグとテスト

### 設定テストページ
`config-test.html`で設定システムの動作確認が可能：

```bash
# ローカルサーバーで開く
cd 01_aids
python -m http.server 8000
# http://localhost:8000/config-test.html にアクセス
```

### ブラウザ開発者ツールでの確認

```javascript
// 設定読み込み状況確認
console.log('Config loaded:', window.ConfigLoader.loaded);

// 全設定確認
console.log('All configs:', window.ConfigLoader.configs);

// CSS変数確認
console.log('Header height:', getComputedStyle(document.documentElement).getPropertyValue('--header-height'));
```

## パフォーマンス考慮事項

1. **設定読み込み**: アプリケーション起動時に一度だけ実行
2. **CSS変数**: ブラウザネイティブで高速
3. **フォールバック**: 設定読み込み失敗時もアプリケーションは正常動作
4. **キャッシュ**: ブラウザの通常のキャッシュ機能を活用

## 移行ガイド

既存のハードコードされた値から設定システムへの移行：

### Before (ハードコード)
```javascript
const duration = 500;
element.style.transition = `transform ${duration}ms ease-in-out`;
```

### After (設定システム)
```javascript
const duration = window.ConfigLoader.getAnimationDuration('default');
element.style.transition = `transform ${duration}ms var(--easing-ease-in-out)`;
```

または

```css
.element {
  transition: transform var(--animation-default) var(--easing-ease-in-out);
}
```

このシステムにより、メンテナンス性と拡張性が大幅に向上し、デザイナーでも簡単に外観の調整が可能になります。