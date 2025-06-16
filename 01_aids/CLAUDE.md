# Scrollytelling コンテンツ要件定義


## 原則
- 日本語で応答すること。
- 作業者の許可なく、コンテンツ内容を書き換えてはいけない。
- 作業者の許可なく、git commitやgit pushした内容を取り消してはいけない。

## 概要
スクロールに応じてテキスト、チャート、地図が連動して表示・変化するWebコンテンツを作成する。汎用的な実装とし、テーマ特有の機能は含まない。

## 技術仕様

### 利用ライブラリ・スクリプト
- **pubsub.js**: イベント管理
- **d3.js**: データ可視化・チャート描画
- **scrollama.js**: スクロールトリガー制御
- **Tailwind CSS**: スタイリング
- **Vanilla JavaScript**: フレームワーク不使用

### 対応環境
- モダンブラウザのみ対応（IE非対応）
- レスポンシブレイアウト対応

## 機能要件

### レイアウト
- **オーバーレイ方式**: チャート・地図の上にテキストを重ねて表示
- **HTML1ファイル完結**: 外部ファイル依存を最小化
- **レスポンシブ対応**: 各デバイスサイズに対応

### データ形式
- **CSV形式**: チャートデータ
- **JSON形式**: 設定ファイル、地図データ
- **設定ファイル**: 各段落とデータの対応関係をJSONで管理

### 表示コンテンツ

#### テキスト
- **段落数**: 5〜10段落を想定
- **表示制御**: スクロール位置に応じた表示・非表示
- **位置**: 柔軟に指定可能

#### チャート
- **種類**: 折れ線グラフ、円グラフ、棒グラフ
- **表示制御**: d3.jsのtransition機能を使用
- **サイズ**: 縦・横・アスペクト比を柔軟に指定可能
- **要素**: 色、配置場所の変更対応

#### 地図
- **対象**: 世界地図および各都市フォーカス
- **アニメーション**: 画面中心の緯度経度とズームレベル変更
- **表示制御**: スムーズなトランジション

### アニメーション・トランジション
- **一定の設定**: トランジション時間・種類は統一
- **スムーズな表示切替**: チャート・地図の表示・非表示
- **d3.js活用**: transition機能によるアニメーション実装

## 設定管理
- **JSON設定ファイル**: 段落とデータの対応関係
- **柔軟な指定**: 表示位置、サイズ、色などの設定
- **データバインディング**: 各段落に対応するチャート・地図状態の定義

## 設定ファイル構造

### 基本構造（config.json）
```json
{
  "steps": [
    {
      "id": "step1",
      "text": "段落のテキスト内容",
      "chart": {
        "type": "line",
        "data": "data/chart1.csv",
        "visible": true,
        "size": { "width": 600, "height": 400 }
      },
      "map": {
        "center": [35.6762, 139.6503],
        "zoom": 10,
        "visible": false
      }
    }
  ],
  "settings": {
    "transition": { "duration": 500, "ease": "cubic-in-out" },
    "layout": { "textPosition": "left", "chartPosition": "right" }
  }
}
```

### データファイル構造
- **CSVファイル**: チャートデータ（ヘッダー行必須）
- **GeoJSONファイル**: 地図データ（標準GeoJSON形式）

## エラーハンドリング

### データ読み込み
- **Promise.all()**: 複数ファイルの並列読み込み
- **d3.csv(), d3.json()**: d3.jsの標準読み込み関数を使用
- **フォールバック**: 読み込み失敗時のデフォルト表示

### 実装例
```javascript
Promise.all([
  d3.json('config.json'),
  d3.csv('data/chart1.csv'),
  d3.json('data/world-map.json')
]).then(([config, chartData, mapData]) => {
  // 正常処理
}).catch(error => {
  console.error('データ読み込みエラー:', error);
  // エラー表示またはデフォルト状態
});
```

## 実装済み機能
- **横並びチャート**: 複数チャートの並列表示
- **複数系列折れ線グラフ**: 複数データ系列の同時表示
- **地図の都市フォーカス**: 複数都市への自動遷移とズーム
- **画像表示機能**: レスポンシブ対応の画像表示
- **地理的距離機能**: 地図上の距離計算
- **データフィルタリング機能**: 同一データセットの部分表示・全表示切り替え

### データフィルタリング機能の詳細
- **範囲フィルタ**: 年度や数値の範囲指定（例: 2010-2015年のみ表示）
- **値フィルタ**: 特定の値のみ表示または除外
- **系列フィルタ**: 複数系列データの特定系列のみ表示
- **動的切り替え**: step間での同一チャートの表示範囲変更
- **スムーズトランジション**: D3.jsのtransition機能による滑らかな表示切り替え

#### インプレース更新機能
- **updateMode: "transition"**: チャートを再描画せずにD3.jsトランジションで更新
- **軸の動的調整**: X軸・Y軸のスケールをアニメーションで変更
- **データポイント管理**: 既存ポイント更新・新規追加・不要削除を自動処理
- **複数系列対応**: 単一系列・複数系列の両方でトランジション対応
- **双方向スクロール対応**: 順方向・逆方向両方でスムーズなトランジション
- **自動判定**: 逆スクロール時は次stepの設定から自動的にトランジションモードを判定
- **正確な方向制御**: step1a→step1、step13a→step13で確実にトランジション動作

#### Object Constancy実装
- **一意キー追跡**: `${系列名}-${年度}`で各データポイントを一意に識別
- **Enter/Update/Exitパターン**: D3.jsの標準パターンで一貫性のあるアニメーション
- **系列レベル追跡**: 系列の追加・削除時もスムーズなライン描画アニメーション
- **完全同期アニメーション**: 軸・線・点が統一されたトランジションで同期
- **自然なイージング**: `easeQuadInOut`で滑らかで直感的な動作
- **最適化された削除**: `duration * 0.4`の高速削除で自然な切り替え
- **データソース統一**: 線と点で`newSeries`から同一のフィルタリング済みデータを使用
- **描画整合性**: stepを超えてデータが増減しても線と点が完全に一致
- **差分ベース更新**: 複雑な段階的処理を削除し、シンプルな差分計算による更新
- **setTimeout段階処理**: 1データポイントずつsetTimeoutで追加・削除する自然な更新
- **右から左削除**: データ削除時は右端（新しい年度）から左端（古い年度）への順序
- **全系列同時更新**: 複数系列チャートでも全系列が同期して段階的に更新
- **リアルタイム軸調整**: 各データ変更時に軸も同時に再スケール・更新

#### 設定例
```json
{
  "updateMode": "transition",
  "config": {
    "filter": {
      "type": "range",
      "field": "year", 
      "range": [2010, 2015]
    },
    "transitionDuration": 1000
  }
}
```

### チャートサイズのパーセンテージ指定
ブラウザのビューポートサイズに対してパーセンテージでチャートサイズを指定可能。

#### 設定オプション
- **widthPercent**: ブラウザ幅に対するパーセンテージ（例: 100 = ブラウザ幅の100%）
- **heightPercent**: ブラウザ高さに対するパーセンテージ（例: 50 = ブラウザ高さの50%）

#### 使用例
```json
{
  "chart": {
    "type": "line",
    "dataFile": "data/trend_new_infections.csv",
    "visible": true,
    "config": {
      "widthPercent": 100,    // ブラウザ幅の100%
      "height": 400,          // 高さは固定値
      "title": "新規感染者数の推移"
    }
  }
}

// または両方をパーセンテージ指定
{
  "chart": {
    "type": "bar",
    "dataFile": "data/sample.csv",
    "visible": true,
    "config": {
      "widthPercent": 50,     // ブラウザ幅の50%
      "heightPercent": 40,    // ブラウザ高さの40%
      "title": "サンプルチャート"
    }
  }
}
```

#### 注意事項
- パーセンテージ指定時も最小・最大サイズの制約（minWidth/maxWidth等）が適用される
- アスペクト比は`widthPercent`のみ指定時に有効（heightが自動計算される）
- レスポンシブ対応のため、ウィンドウリサイズ時に自動的に再計算される

### レスポンシブSVG実装
[Responsive D3.js](https://visualizing.jp/responsive-d3/)のベストプラクティスに基づく実装。

#### 実装方針
- **viewBox属性**: SVGの座標系を定義（例: `viewBox="0 0 800 600"`）
- **preserveAspectRatio**: 中央配置とアスペクト比維持（`xMidYMid meet`）
- **CSSでサイズ制御**: `width: 100%`, `height: auto`で親要素に合わせる
- **固定座標系**: D3.jsコードは固定座標系（800x600等）で記述、表示は自動スケール

#### SVG設定例
```javascript
// 従来の固定サイズ
svg.attr('width', 800).attr('height', 600);

// レスポンシブ版
svg.attr('viewBox', '0 0 800 600')
   .attr('preserveAspectRatio', 'xMidYMid meet')
   .style('width', '100%')
   .style('height', 'auto');
```

#### メリット
- **デバイス対応**: PC・タブレット・スマートフォンで最適表示
- **コード簡素化**: D3.jsコードは固定座標系で記述可能
- **パフォーマンス**: ブラウザネイティブのスケーリング機能を活用
- **アクセシビリティ**: ズーム機能との親和性が高い

## 実装方針
- 汎用性を重視し、特定テーマに依存しない設計
- 設定ファイルによる柔軟なカスタマイズ対応
- パフォーマンスを考慮したスムーズなスクロール体験
- シンプルな階層構造でメンテナンス性を確保

## 共通ユーティリティクラス

### 概要
コードの重複を削減し、保守性を向上させるため、以下の共通ユーティリティクラスを実装。

### 1. BaseManager (`utils/base-manager.js`)
すべてのManagerクラスの基底クラス。

#### 主な機能
- **共通初期化処理**: constructor、init、setupEventListeners
- **表示制御**: show/hide（フェードイン・アウト対応）
- **状態管理**: updateState（エラーハンドリング付き）
- **設定マージ**: mergeConfig（ディープマージ対応）
- **非同期処理**: safeAsyncOperation（エラー処理付き）
- **ユーティリティ**: clearContainer、stopAnimations、getDebugInfo
- **設定検証**: validateConfig
- **リソース管理**: destroy

### 2. SVGHelper (`utils/svg-helper.js`)
D3.jsを使用したSVG操作の共通処理を提供。

#### 主な機能
- **initSVG**: SVG要素の初期化
- **getResponsiveSize**: レスポンシブなサイズ計算
- **getInnerSize**: マージンを考慮した内部サイズ計算
- **createGroup**: マージン付きグループ要素の作成
- **styleAxis**: 軸のスタイリング
- **calculatePosition**: ビューポート内での要素位置計算
- **addGridLines**: グリッドラインの追加
- **createTooltip**: ツールチップコンテナの作成
- **トランジション機能**: createTransition、fadeIn/fadeOut、scaleTransition、sequenceTransitions
- **アクセシビリティ対応**: accessibleTransition（prefers-reduced-motion対応）

### 3. AnimationConfig (`utils/animation-config.js`)
D3.jsのトランジション設定を一元管理。

#### 主な機能
- **速度定数**: INSTANT, FAST, NORMAL, SLOW, VERY_SLOW
- **イージング関数**: LINEAR, QUAD, CUBIC, ELASTIC, BOUNCE等
- **プリセット設定**: 
  - FAST_SMOOTH: UI要素の高速切り替え
  - DEFAULT: 通常のチャート更新
  - SLOW_SMOOTH: 地図ズーム等のゆっくりした動作
  - ENTER/EXIT: 要素の追加・削除アニメーション
- **apply**: トランジションの適用
- **stagger**: 順次アニメーション
- **fadeIn/fadeOut**: フェード効果
- **scale**: スケール効果
- **sequence**: 連続トランジション
- **アクセシビリティ対応**: prefers-reduced-motionの考慮

### 4. ErrorHandler (`utils/error-handler.js`)
アプリケーション全体のエラー処理を統一管理。

#### 主な機能
- **エラータイプ分類**: DATA_LOAD, RENDER, TRANSITION, VALIDATION, NETWORK
- **重要度レベル**: LOW, MEDIUM, HIGH, CRITICAL
- **handle**: エラーハンドリングのメイン関数
- **wrap/wrapAsync**: try-catchラッパー関数
- **handleDataValidationError**: データ検証エラー専用処理
- **ユーザー通知**: 重要度に応じた通知表示
- **デバッグ機能**: エラーログの保存・エクスポート
- **開発環境対応**: localhost環境での詳細デバッグパネル

### 5. CoordinateHelper (`utils/coordinate-helper.js`)
座標計算とプロジェクション処理のユーティリティクラス。

#### 主な機能
- **safeProjection**: 安全な座標プロジェクション変換
- **projectCoordinates**: 座標配列の一括変換
- **coordsToObject/objectToCoords**: 座標形式の相互変換
- **pixelDistance/geographicDistance**: 距離計算
- **calculateBounds**: 座標配列の境界矩形計算
- **scaleCoordinate**: 座標系のスケール変換
- **calculateCentroid**: 中心点計算
- **validateCoordinate**: 座標の妥当性検証

### 6. DataHelper (`utils/data-helper.js`)
データ処理とバリデーションのユーティリティクラス。

#### 主な機能
- **validateData**: データの存在チェックとバリデーション
- **safeNumericConversion**: 型安全な数値変換
- **applyFilters**: データフィルタリング（AND/OR、範囲、正規表現対応）
- **compareValues**: 値の比較（大文字小文字、部分一致対応）
- **isYearData**: 日付データの判定
- **removeDuplicates**: 重複削除
- **groupBy**: データのグループ化
- **sortData**: データのソート
- **calculateStats**: 統計情報計算
- **transformToSeries**: 系列データへの変換
- **handleMissingValues**: 欠損値の処理

### 7. ConfigHelper (`utils/config-helper.js`)
設定管理のユーティリティクラス。

#### 主な機能
- **デフォルト設定**: getDefaultChartConfig、getDefaultMapConfig等
- **mergeConfig**: 設定のディープマージ（配列マージ戦略、型検証対応）
- **validateConfig**: 設定の検証（JSONスキーマベース）
- **optimizeConfig**: 設定ファイルの最適化（共通設定の抽出）
- **deepClone**: オブジェクトのディープクローン
- **isPlainObject**: プレーンオブジェクトの判定

### 使用例
```javascript
// BaseManager継承
class ChartManager extends BaseManager {
    constructor(containerId) {
        super(containerId);
        // 追加の初期化
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        // 追加のイベントリスナー
    }
}

// SVGHelper
const { width, height } = SVGHelper.getResponsiveSize(container, {
    defaultWidth: 800,
    defaultHeight: 600,
    widthPercent: 80
});
const svg = SVGHelper.initSVG(container, width, height);

// DataHelper
const validation = DataHelper.validateData(data, ['year', 'value']);
if (!validation.valid) {
    console.error('Data validation failed:', validation.error);
    return;
}

// ConfigHelper
const config = ConfigHelper.mergeConfig(
    ConfigHelper.getDefaultChartConfig(),
    userConfig
);
```

### スクリプト読み込み順序
```html
<!-- 共通ユーティリティ -->
<script src="assets/js/utils/base-manager.js"></script>
<script src="assets/js/utils/svg-helper.js"></script>
<script src="assets/js/utils/animation-config.js"></script>
<script src="assets/js/utils/error-handler.js"></script>
<script src="assets/js/utils/coordinate-helper.js"></script>
<script src="assets/js/utils/data-helper.js"></script>
<script src="assets/js/utils/config-helper.js"></script>

<!-- アプリケーションスクリプト -->
<script src="assets/js/pubsub.js"></script>
<script src="assets/js/chart-manager.js"></script>
<script src="assets/js/map-manager.js"></script>
<script src="assets/js/image-manager.js"></script>
<script src="assets/js/main.js"></script>
```

### 今後の移行計画
1. **進行中**: 既存のManagerクラスをBaseManagerに継承変更
2. **次フェーズ**: エラーハンドリングの統一化
3. **将来**: TypeScript導入の検討、単体テストの追加

### 実装方針
- グローバルスコープでの提供を継続（window.SVGHelper等）
- 既存コードとの互換性を維持
- script要素での読み込み順序に注意（ユーティリティ→アプリケーション）

## 開発方針

### コンテンツ改変禁止
**重要**: デバッグや開発の途中で、コンテンツのチャートやテキストを追加、もしくは改変することは禁止します。

- **開発のみに集中**: 機能実装、バグ修正、システム改善のみを行う
- **コンテンツ改変禁止**: チャート設定、テキスト、データファイルの変更は行わない
- **既存設定尊重**: 元々のconfig.jsonの内容を維持する
- **デモ用改変禁止**: 機能テストのためのコンテンツ変更も行わない

### 実装時の注意事項
- 機能の実装や修正は行うが、その過程でコンテンツ自体を変更してはならない
- 設定ファイル（config.json）の構造改善は可能だが、コンテンツの内容は変更しない
- テスト用のダミーデータやサンプルコンテンツの追加は行わない