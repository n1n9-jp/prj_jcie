# 論理名ステップ管理システム

## 概要

スクロールテリングアプリケーションにおいて、ステップを数値インデックス（step0, step1...）ではなく論理名（opening, intro, footer...）で管理するシステムです。これにより、ステップの追加・削除時の整合性維持が自動化され、保守性が大幅に向上します。

## 背景と課題

### 従来の問題点
- **数値インデックス依存**: ステップ番号がHTML・設定ファイル・JavaScriptに散在
- **手動同期の必要性**: ステップ追加・削除時に複数ファイルの修正が必要
- **エラーの頻発**: インデックス不整合による表示エラー
- **メンテナンス困難**: 中間ステップの削除が特に困難

### 解決アプローチ
論理名ベースのステップ管理により、ステップの意味的な役割を明確化し、自動的なインデックス計算でファイル間の整合性を保証。

## システム構成

### 1. ステップ定義システム（step-definitions.js）

```javascript
window.STEP_DEFINITIONS = {
  'opening': { 
    type: 'fixed', 
    description: 'オープニング画面',
    contentType: 'title-screen'
  },
  'intro': { 
    type: 'fixed', 
    description: 'イントロダクション',
    contentType: 'text'
  },
  'city-episodes': { 
    type: 'dynamic', 
    description: '都市別エピソード',
    contentType: 'mixed',
    dataSource: 'cities-timeline.json'
  },
  'footer': { 
    type: 'fixed', 
    description: 'フッター・クレジット',
    contentType: 'footer'
  }
};
```

### 2. ステップマッパー（step-mapper.js）

論理名とインデックス番号の相互変換を自動処理：

```javascript
// 論理名からインデックス取得
const footerIndex = StepMapper.getIndex('footer'); // 23

// インデックスから論理名取得
const stepName = StepMapper.getName(23); // 'footer'

// 都市エピソードの範囲取得
const cityRange = StepMapper.getCityStepsRange();
// { start: 11, end: 17, count: 7 }
```

### 3. 感染症別設定（disease-step-config）

```javascript
window.DISEASE_STEP_CONFIG = {
  'aids': {
    'city-episodes': {
      expectedCityCount: 7, // step11-17
      startStepHint: 11,
      endStepHint: 17
    }
  },
  'tuberculosis': {
    'city-episodes': {
      expectedCityCount: 5,
      startStepHint: 11,
      endStepHint: 15
    }
  }
};
```

## 実装詳細

### HTMLの論理名対応

```html
<!-- 従来（数値インデックス） -->
<div class="step" data-step="0">
<div class="step" data-step="23">

<!-- 現在（論理名） -->
<div class="step" data-step="opening">
<div class="step" data-step="footer">
```

### 設定ファイルの論理名対応

```json
{
  "steps": [
    {
      "id": "opening",
      "text": { "content": "", "visible": false },
      "image": {
        "src": "assets/images/Firefly_A.jpg",
        "visible": true,
        "config": { "specialMode": "opening-background" }
      }
    },
    {
      "id": "footer",
      "footer": { "visible": true }
    }
  ]
}
```

### JavaScript処理の論理名対応

```javascript
// main.js - 論理名ベースのステップ処理
handleStepEnter(response) {
    const stepLogicalName = response.element.getAttribute('data-step');
    const stepConfig = this.config?.steps?.find(step => step.id === stepLogicalName);
    
    if (!stepConfig) {
        console.warn(`No config found for step ${stepLogicalName}`);
        return;
    }
    
    // 処理継続...
}

// フッター描画の論理名対応
renderFooter(footerConfig) {
    const stepElement = document.querySelector(`[data-step="footer"]`);
    // 処理継続...
}
```

## 動的ステップ生成

### 都市エピソードの自動生成

```javascript
// 都市データから動的にステップ生成
const cityStepsStart = StepMapper.getIndex('city-episodes-start'); // 11

citiesData.forEach((city, index) => {
    const stepId = `city-episodes-${index}`;
    const stepIndex = cityStepsStart + index;
    
    const cityStepConfig = {
        id: stepId,
        text: { content: city.story },
        map: { center: city.coordinates, zoom: 10 },
        image: { src: city.image }
    };
    
    // ステップ設定を追加
    this.config.steps.push(cityStepConfig);
});
```

## 利点

### 1. 自動整合性保証
- **インデックス計算の自動化**: StepMapperによる一元管理
- **ファイル間同期**: 論理名による統一参照
- **エラー削減**: 手動番号管理の排除

### 2. 保守性向上
- **意味的な明確さ**: ステップの役割が名前で分かる
- **安全な追加・削除**: 中間ステップの変更が容易
- **コード可読性**: 論理名による直感的な理解

### 3. 拡張性
- **新ステップ追加**: STEP_DEFINITIONSに追加するだけ
- **感染症対応**: DISEASE_STEP_CONFIGでの個別調整
- **動的ステップ**: データ駆動での自動生成

## 使用方法

### 新しいステップの追加

1. **STEP_DEFINITIONSに定義追加**
```javascript
'new-section': { 
  type: 'fixed', 
  description: '新しいセクション',
  contentType: 'chart'
}
```

2. **HTMLに要素追加**
```html
<div class="step" data-step="new-section">
  <!-- コンテンツ -->
</div>
```

3. **設定ファイルに設定追加**
```json
{
  "id": "new-section",
  "chart": { "visible": true, "type": "bar" }
}
```

### ステップの削除

1. **STEP_DEFINITIONSから削除**
2. **HTMLから要素削除**
3. **設定ファイルから設定削除**

→ StepMapperが自動的にインデックスを再計算

## トラブルシューティング

### よくある問題

1. **ステップが見つからない**
```javascript
// デバッグ: 利用可能なステップを確認
StepMapper.debugPrintMappings();
```

2. **フッター位置の不整合**
```javascript
// フッターインデックスの確認
console.log('Footer index:', StepMapper.getFooterStepIndex());
```

3. **都市エピソードの範囲エラー**
```javascript
// 都市ステップ範囲の確認
console.log('City range:', StepMapper.getCityStepsRange());
```

### 設定検証

```javascript
// 設定の妥当性チェック
const isValid = StepMapper.validateConfiguration();
if (!isValid) {
    console.error('StepMapper configuration is invalid');
}
```

## 実装履歴

### Phase 1: 基盤構築 ✅
- STEP_DEFINITIONSとStepMapperの作成
- 論理名ベースのステップ管理設計

### Phase 2: AIDSコンテンツ移行 ✅
- config/content.json の論理名変換
- index.html の data-step 属性更新
- main.js の論理名対応

### Phase 3: システム修正・完全動作確認 ✅
- StepMapperのフッター計算修正（39→23）
- renderFooter()の論理名対応
- 画像表示問題の解決

## 今後の展開

### 他感染症への適用
- 結核・マラリアコンテンツでの論理名システム適用
- 感染症横断での統一ステップ構造

### システム拡張
- ステップ間の依存関係管理
- 条件付きステップ表示
- ユーザー進行状況の論理名ベース管理

---

このシステムにより、スクロールテリングアプリケーションのステップ管理が大幅に効率化され、開発・保守作業の生産性が向上します。