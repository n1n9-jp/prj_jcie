# ChartManager アーキテクチャ

## 概要

新しくストリームライン化されたChartManagerは、チャート機能を直接実装するのではなく、専門化されたチャートレンダラーを管理する調整役（コーディネーター）クラスです。このアーキテクチャにより、関心の分離、保守性、拡張性が向上しています。

## アーキテクチャ

### コアコンポーネント

```
ChartManager (調整役)
├── LineChartRenderer（折れ線グラフ）
├── BarChartRenderer（棒グラフ）
├── PieChartRenderer（円グラフ）
└── GridChartRenderer（グリッドレイアウト）
```

### 基底クラス
- **BaseManager**: 共通機能（表示/非表示、リサイズ、状態管理）
- **ChartTransitions**: 統一されたアニメーションとトランジション管理

## 新しいChartManagerの機能

### 1. コーディネーションパターン
新しいChartManagerは、チャートロジックを実装するのではなく、**ファクトリーおよびコーディネーター**として機能します：

```javascript
// 旧アプローチ（モノリシック）
chartManager.renderLineChart(data, config);

// 新アプローチ（コーディネーション）
chartManager.updateChart({
    type: 'line',
    data: data,
    config: config,
    visible: true
});
```

### 2. 専門化されたレンダラー
各チャートタイプには専用のレンダラーがあります：

- **LineChartRenderer**: 折れ線グラフとトランジションを処理
- **BarChartRenderer**: アニメーション付き棒グラフを処理
- **PieChartRenderer**: アークアニメーション付き円グラフを処理
- **GridChartRenderer**: 複雑なグリッドレイアウトを処理

### 3. レイアウト管理
複数のレイアウトタイプをサポート：

```javascript
// 単一チャート
chartManager.updateChart({
    type: 'line',
    data: data,
    config: config
});

// デュアルレイアウト（2つ並び）
chartManager.updateChart({
    layout: 'dual',
    charts: [chart1Config, chart2Config]
});

// トリプルレイアウト（3つ並び）
chartManager.updateChart({
    layout: 'triple', 
    charts: [chart1, chart2, chart3]
});

// グリッドレイアウト
chartManager.updateChart({
    layout: 'grid',
    config: gridConfig
});
```

### 4. 統一されたトランジション
すべてのアニメーションはChartTransitionsを通じて調整されます：

```javascript
// 自動トランジション調整
chartManager.coordinateTransition('line', 'bar', {
    fadeOutDuration: 300,
    fadeInDuration: 600
});
```

## パブリックAPI

### コアメソッド

#### `updateChart(chartData)`
チャートを更新するメインメソッド。`type`または`layout`に基づいて適切なレンダラーに自動的にルーティングします。

**パラメータ:**
```javascript
{
    type: 'line' | 'bar' | 'pie',           // 単一チャートの場合
    layout: 'dual' | 'triple' | 'grid',    // 複数チャートレイアウトの場合
    data: Array,                            // チャートデータ
    config: Object,                         // チャート設定
    visible: Boolean,                       // 表示状態
    updateMode: 'transition' | 'redraw',    // 更新方法
    direction: 'up' | 'down'                // スクロール方向
}
```

#### `show(options)` / `hide(options)`
トランジションオプション付きで表示状態を制御します。

#### `resize()`
アクティブなレンダラーに委譲してレスポンシブなリサイズを処理します。

### レンダラー管理

#### `getRenderer(type)`
特定のレンダラーインスタンスを取得します。

#### `hideInactiveRenderers(activeType)`
指定されたタイプ以外のすべてのレンダラーを非表示にします。

#### `coordinateTransition(fromType, toType, options)`
チャートタイプ間のスムーズなトランジションを管理します。

## レンダラーインターフェース

各レンダラーは一貫したインターフェースを実装します：

### 必須メソッド
- `updateChart(chartData)` - チャートを更新
- `show(options)` - トランジション付きで表示
- `hide(options)` - トランジション付きで非表示
- `resize()` - リサイズイベントを処理

### レイアウトサポート用
- `renderLineChartInGroup(g, data, config)` - 特定のSVGグループ内に描画
- `renderBarChartInGroup(g, data, config)` - 特定のSVGグループ内に描画
- `renderPieChartInGroup(g, data, config)` - 特定のSVGグループ内に描画

## 移行ガイド

### レガシーChartManagerからの移行

#### 移行前（レガシー）
```javascript
const chartManager = new ChartManager('#chart');
chartManager.renderChart('line', data, config);
```

#### 移行後（新）
```javascript
const chartManager = new ChartManager('#chart');
chartManager.updateChart({
    type: 'line',
    data: data,
    config: config,
    visible: true
});
```

### 後方互換性
- レガシーChartManagerは`LegacyChartManager`として利用可能
- 新しいChartManagerが読み込まれていない場合は自動フォールバック
- 既存のコードは変更なしで動作継続

## エラーハンドリング

### グレースフルデグレデーション
- レンダラーが見つからない場合はフォールバック表示をトリガー
- エラーメッセージが必要なスクリプトの読み込みをガイド
- バリデーションによりクラッシュを防止

### エラーコンテキスト
```javascript
// コンテキスト付き自動エラー報告
if (window.ErrorHandler) {
    ErrorHandler.handle(error, 'ChartManager.updateChart', {
        type: ErrorHandler.ERROR_TYPES.RENDER,
        severity: ErrorHandler.SEVERITY.HIGH,
        context: chartData
    });
}
```

## パフォーマンスの利点

### メモリ使用量の削減
- アクティブなレンダラーのみが初期化される
- 非アクティブなレンダラーは破棄されずに非表示
- 専門機能の遅延読み込み

### 最適化されたトランジション
- ChartTransitionsがハードウェアアクセラレーションアニメーションを提供
- 調整されたタイミングにより視覚的な競合を防止
- デバイス性能に基づく適応的な持続時間

### より良いキャッシング
- レンダラーが独自の状態を維持
- 更新間でトランジションデータが保持される
- DOM操作とリフローの削減

## デバッグ

### デバッグ情報
```javascript
// 包括的なデバッグ情報を取得
const debugInfo = chartManager.getDebugInfo();
console.log(debugInfo);

// 戻り値:
{
    className: 'ChartManager',
    isVisible: true,
    currentState: {...},
    activeRenderer: 'LineChartRenderer',
    currentLayout: 'single',
    rendererStates: {
        line: { available: true, visible: true },
        bar: { available: true, visible: false },
        pie: { available: true, visible: false },
        grid: { available: true, visible: false }
    },
    transitionManagerAvailable: true
}
```

### レンダラー状態
```javascript
// 個別のレンダラー状態を確認
const states = chartManager.getRendererStates();
```

## 統合例

### 基本的な折れ線グラフ
```javascript
chartManager.updateChart({
    type: 'line',
    data: timeSeriesData,
    config: {
        xField: 'year',
        yField: 'value',
        multiSeries: true,
        colors: ['#2563eb', '#dc2626']
    },
    visible: true
});
```

### デュアルレイアウト
```javascript
chartManager.updateChart({
    layout: 'dual',
    charts: [
        {
            title: 'トレンドA',
            data: dataA,
            config: { type: 'line', xField: 'year', yField: 'value' }
        },
        {
            title: 'トレンドB', 
            data: dataB,
            config: { type: 'line', xField: 'year', yField: 'value' }
        }
    ],
    visible: true
});
```

### タイプ間のトランジション
```javascript
// 折れ線グラフから棒グラフへスムーズにトランジション
chartManager.updateChart({
    type: 'bar',
    data: categoricalData,
    config: { xField: 'category', yField: 'value' },
    updateMode: 'transition',
    visible: true
});
```

## 将来の拡張

### 計画中の機能
- **アニメーションシーケンス**: 複雑な多段階アニメーション
- **インタラクティブな調整**: レンダラー間の同期インタラクション
- **テーマ統合**: 全チャートタイプで統一されたテーマ設定
- **プラグインアーキテクチャ**: サードパーティレンダラーの登録

### 拡張ポイント
- カスタムレンダラー統合
- レイアウトパターン拡張
- トランジション効果プラグイン
- データ変換パイプライン

## ファイル

- `ChartManager.js` - 新しいストリームライン化されたコーディネータークラス
- `chart-manager.js` - レガシー実装（後方互換性）
- `LineChartRenderer.js` - 折れ線グラフ専門化
- `BarChartRenderer.js` - 棒グラフ専門化  
- `PieChartRenderer.js` - 円グラフ専門化
- `GridChartRenderer.js` - グリッドレイアウト専門化
- `utils/ChartTransitions.js` - 統一トランジション管理
- `utils/base-manager.js` - 共通基底機能

新しいアーキテクチャは、既存のすべての機能を保持し、スムーズな移行パスを確保しながら、チャート管理のためのクリーンで保守可能な基盤を提供します。