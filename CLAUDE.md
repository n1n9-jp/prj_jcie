# Scrollytelling コンテンツ要件定義


## 原則
- 日本語で応答すること。
- 作業者の許可なく、コンテンツ内容を書き換えてはいけない。
- 作業者の許可なく、git commitやgit pushした内容を取り消してはいけない。
- 作業者の指示を局所最適で解決しようとは決してしないこと。プロジェクトを統一的なシステムと捉えて、全体の仕組みを把握してからの課題解決を試みること。

## 【重要】Step管理における注意事項

### Step増減時の必須確認事項
**Step の追加・削除・番号変更を行う際は、以下を必ず同時に確認・修正すること：**

1. **config.json の steps 配列**
   - 配列のインデックス（0ベース）と HTML の data-step 属性の対応関係
   - 削除されたstepのインデックスによる後続stepへの影響
   - 各step設定の整合性確認

2. **index.html の data-step 属性**
   - `<div class="step" data-step="N">` の連番確認
   - 欠番や重複がないことの確認
   - 特にフッター表示step（通常は最終step）の番号

3. **JavaScript コードでの step 参照**
   - `document.querySelector('[data-step="N"]')` での参照箇所
   - 特に `renderFooter()` 関数内のフッター挿入先指定
   - 都市ステップ生成における開始step番号
   - step範囲を指定している処理

### 具体的なチェックポイント

#### config.json 確認事項
- steps配列の要素数とHTMLのstep要素数が一致
- 各stepのid属性が正しい形式（"step0", "step1", ...）
- 最終stepにfooter設定がある場合、対応するHTMLのdata-step値

#### index.html 確認事項  
- data-step属性が0から連番で設定されている
- 欠番（例：step5が削除されて step4 → step6）がない
- 重複番号がない
- フッタ表示用のstepが正しく設定されている

#### JavaScript コード確認事項
- `main.js` の `renderFooter()` 関数：
  ```javascript
  const stepElement = document.querySelector('[data-step="24"]');
  ```
  この「24」が実際の最終step番号と一致していること

- 都市ステップ生成における開始番号：
  ```javascript
  // 都市ステップは動的に生成されます（step10-16）
  ```
  コメントと実際の生成範囲が一致していること

### Step削除時の手順
1. **config.json から該当stepを削除**
2. **index.html から該当のstep要素を削除**  
3. **後続stepの番号を詰める（config.json の id と index.html の data-step 両方）**
4. **JavaScript コード内のstep参照を更新**
5. **動作確認（特にフッター表示とスクロール遷移）**

### Step追加時の手順
1. **追加位置を決定**
2. **config.json に新step設定を挿入**
3. **index.html に新step要素を挿入**
4. **後続stepの番号を調整（config.json の id と index.html の data-step 両方）**
5. **JavaScript コード内のstep参照を更新**
6. **動作確認**

### 過去の問題事例
- step8, 9削除時に後続stepの番号調整が不完全
- フッター表示step番号の更新漏れ
- HTMLとJSONの同期漏れによるインデックス不整合
- 都市ステップ範囲の不整合

### デバッグ方法
step関連の問題が発生した場合：
1. ブラウザの開発者ツールでHTMLのdata-step属性を確認
2. config.jsonのsteps配列の要素数と各stepのidを確認  
3. JavaScript コンソールでstep参照エラーがないか確認
4. scrollama.jsのステップ検出が正常に動作しているか確認

**この注意事項を必ず作業前に確認し、HTML・JSON・JavaScriptの3ファイルを同期して修正すること。**

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

### 新しい設定システム（v2.0）
**2024年6月より新しい設定システムを導入**。設定ファイルが機能別に分割され、ConfigLoaderクラスによって統合管理されます。

#### 設定ファイル構成
```
config/
├── main.config.json          # メイン設定（統合）
├── content.config.json       # コンテンツ設定（steps）
├── settings.config.json      # アプリケーション設定
├── app.config.json          # アプリケーション固有設定
├── theme.config.json        # テーマ設定
├── animation.config.json    # アニメーション設定
└── environment/
    ├── development.json     # 開発環境設定
    └── production.json      # 本番環境設定
```

#### ConfigLoaderクラス
```javascript
// 使用例
const configLoader = new ConfigLoader();
const config = await configLoader.getLegacyCompatibleConfig();

// 旧config.jsonとの互換性を維持
const steps = config.steps;
const settings = config.settings;
```

#### 後方互換性
- 旧`config.json`は新システムへの移行を示すメタデータファイルとして機能
- `ConfigLoader.getLegacyCompatibleConfig()`で従来の形式で取得可能
- 既存コードの変更不要

### 基本構造（content.config.json）
```json
{
  "steps": [
    {
      "id": "step0",
      "text": {
        "content": "段落のテキスト内容",
        "visible": true,
        "position": {
          "width": "30%",
          "horizontal": "center",
          "vertical": "center"
        }
      },
      "chart": {
        "type": "line",
        "dataFile": "data/chart1.csv",
        "visible": true,
        "config": {
          "width": 600,
          "height": 400,
          "title": "チャートタイトル"
        }
      },
      "map": {
        "center": [35.6762, 139.6503],
        "zoom": 10,
        "visible": false
      },
      "image": {
        "src": "assets/images/sample.jpg",
        "alt": "画像の説明",
        "visible": false,
        "position": {
          "horizontal": "center",
          "vertical": "center"
        }
      }
    }
  ]
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
- **専門化レンダラーシステム**: チャートタイプ別の専門レンダラー
- **新設定システム**: ConfigLoaderクラスによる分散設定管理
- **拡張ユーティリティ**: 多数の専門ユーティリティクラス

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

### 8. 追加のユーティリティクラス

#### AppConstants (`utils/app-constants.js`)
アプリケーション全体で使用する定数の管理。

#### ChartLayoutHelper (`utils/chart-layout-helper.js`)
チャートレイアウトの計算と配置管理。

#### ChartTransitions (`utils/chart-transitions.js`)
チャート特有のトランジション効果の管理。

#### CityFocusManager (`utils/city-focus-manager.js`)
地図の都市フォーカス機能の管理。

#### ColorScheme (`utils/color-scheme.js`)
統一されたカラーパレットとテーマ管理。

#### CountryRegionMapping (`utils/country-region-mapping.js`)
国と地域のマッピングデータ管理。

#### MapProjectionHelper (`utils/map-projection-helper.js`)
地図投影法の計算とヘルパー機能。

#### MapStylingHelper (`utils/map-styling-helper.js`)
地図のスタイリングとテーマ適用。

#### PositionManager (`utils/position-manager.js`)
要素の位置計算と配置管理。

#### TextMeasurement (`utils/text-measurement.js`)
テキストサイズ計算と配置最適化。

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
<!-- 外部ライブラリ -->
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://d3js.org/topojson.v3.min.js"></script>
<script src="https://unpkg.com/scrollama"></script>
<script src="assets/js/libs/d3-labeler.js"></script>

<!-- 設定システム -->
<script src="assets/js/utils/config-loader.js"></script>
<script src="assets/js/config/defaults.js"></script>

<!-- 共通ユーティリティ（基盤） -->
<script src="assets/js/utils/app-constants.js"></script>
<script src="assets/js/utils/base-manager.js"></script>
<script src="assets/js/utils/svg-helper.js"></script>
<script src="assets/js/utils/animation-config.js"></script>
<script src="assets/js/utils/error-handler.js"></script>
<script src="assets/js/utils/coordinate-helper.js"></script>
<script src="assets/js/utils/data-helper.js"></script>
<script src="assets/js/utils/config-helper.js"></script>

<!-- 共通ユーティリティ（専門） -->
<script src="assets/js/utils/chart-layout-helper.js"></script>
<script src="assets/js/utils/color-scheme.js"></script>
<script src="assets/js/utils/country-region-mapping.js"></script>
<script src="assets/js/utils/position-manager.js"></script>
<script src="assets/js/utils/text-measurement.js"></script>
<script src="assets/js/utils/chart-transitions.js"></script>

<!-- チャートレンダラー -->
<script src="assets/js/bar-chart-renderer.js"></script>
<script src="assets/js/line-chart-renderer.js"></script>
<script src="assets/js/pie-chart-renderer.js"></script>
<script src="assets/js/grid-chart-renderer.js"></script>

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

## マルチ感染症システム（v3.0）

### 概要
**2024年6月より新しいマルチ感染症システムを導入**。AIDS、結核、マラリアの3つの感染症に対応した統一プラットフォームを構築。

### システム構成
```
jcie_scrollytelling/
├── 01_aids/              # エイズコンテンツ
├── 02_tuberculosis/      # 結核コンテンツ  
├── 03_malariae/          # マラリアコンテンツ
└── shared/               # 共通リソース
    ├── assets/
    │   ├── css/          # 統一スタイル
    │   └── js/           # 共通JavaScript
    └── templates/        # 共通テンプレート
```

### 統一システム設計

#### 1. 統一テンプレートシステム
- **shared/templates/unified-index.html**: 全感染症で使用する共通HTMLテンプレート
- **disease-config.js**: 感染症別の設定（色、名前、パス）を集中管理
- **unified-styling.js**: 動的スタイル適用とナビゲーション生成

#### 2. 感染症別設定
```javascript
// shared/assets/js/config/disease-config.js
const DISEASE_CONFIG = {
    'aids': {
        id: 'aids',
        name: 'HIV/エイズとの闘い',
        color: { primary: '#ff6b6b', secondary: '#ff8e8e', accent: '#e85555' }
    },
    'tuberculosis': {
        id: 'tuberculosis', 
        name: '結核との闘い',
        color: { primary: '#4ecdc4', secondary: '#6dd5d0', accent: '#3bb8b0' }
    },
    'malariae': {
        id: 'malariae',
        name: 'マラリアとの闘い', 
        color: { primary: '#f4a620', secondary: '#f6b84a', accent: '#e89813' }
    }
};
```

#### 3. 統一スタイルシステム

- **shared/assets/css/unified-base.css**: 統一コンポーネントスタイル（shared-base.cssを統合済み）
- **動的カラーテーマ**: JavaScriptによる感染症別色の自動適用

#### 4. Step0統一実装
全感染症でstep0（オープニング画面）の実装を統一：

**HTMLテンプレート:**
```html
<div class="step" data-step="0">
    <div class="w-full min-h-screen flex items-center justify-center relative">
        <div class="absolute inset-0 z-0" id="step0-bg-container">
            <!-- 背景画像は ImageManager で管理される -->
        </div>
        
        <!-- 黒い半透明オーバーレイ -->
        <div class="absolute inset-0 bg-black bg-opacity-70 z-10"></div>
        
        <!-- タイトルコンテナ -->
        <div class="relative z-20 text-center">
            <h1 class="text-white font-thin mb-4" style="font-size: 100px; text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8); font-family: 'Shippori Mincho', serif;">[感染症名]</h1>
            <p class="text-white font-light" style="font-size: 30px; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8); font-family: 'Shippori Mincho', serif;">～データで見る希望と課題～</p>
        </div>
    </div>
</div>
```

**CSS統一スタイル:**
```css
/* unified-base.css */
.step[data-step="0"]::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0; 
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 1;
}
```

#### 5. 画像管理統一
**ImageManagerでstep0特別処理:**
```javascript
// specialMode: "step0-background"での統一処理
if (specialMode === 'step0-background') {
    const step0BgContainer = d3.select('#step0-bg-container');
    if (!step0BgContainer.empty()) {
        // 背景画像を step0-bg-container に配置
        const bgImage = step0BgContainer.append('img')
            .attr('src', src)
            .style('object-fit', 'cover')
            .style('opacity', opacity);
        
        // 通常のimage-containerは非表示
        this.container.classed('visible', false);
        return;
    }
}
```

### 実装した統一機能

#### 1. ナビゲーション統一
- **3感染症間の相互リンク**: 各ページのヘッダーに他の感染症へのリンクを動的生成
- **アクティブ状態表示**: 現在表示中の感染症をハイライト
- **感染症別カラーテーマ**: ナビゲーション要素も各感染症の色で統一

#### 2. 設定システム統一  
- **content.json形式**: 全感染症でcontent.json形式を採用
- **共通パス解決**: ConfigLoaderによる感染症別パス自動解決
- **フォールバック機能**: DiseaseDetector無しでも動作する互換性

#### 3. HTML構造統一
- **step0実装**: 全感染症でHTML直書き方式に統一（JavaScript動的生成を廃止）
- **コンテナ構造**: 同じz-index構造とクラス名で一貫性確保
- **レスポンシブ対応**: 統一されたTailwindCSSクラスで全デバイス対応

### 重要な設計方針

#### 個別最適化の禁止
**最重要**: 感染症ごとの個別実装は厳禁。必ず統一された方式を採用すること。

- **統一テンプレート使用**: shared/templates/を基準とした実装
- **共通コンポーネント**: 同じHTML構造、CSS、JavaScript処理
- **設定ファイル統一**: 同じJSON構造とキー名
- **一貫性保持**: 一つの感染症で修正したら、他も同様に修正

#### 実装パターンの統一
1. **HTMLテンプレート**: 共通構造を全感染症で使用
2. **設定ファイル**: content.json形式で統一
3. **スタイル**: unified-base.cssの統一スタイル使用
4. **JavaScript**: 感染症別の条件分岐ではなく、設定驱动での処理

### トラブルシューティング

#### Step0表示問題
マラリアでstep0が表示されない問題を解決：

**原因:**
- content.jsonでstep0設定が不完全
- main.jsで個別処理を追加（統一性違反）

**解決:**
1. content.jsonをcontent.config.jsonから正しい内容にコピー
2. main.jsの個別処理を削除
3. HTMLを結核と同じ構造に統一（直接記述方式）

**学んだ教訓:**
- 個別対応は必ず他の感染症との不整合を生む
- 統一された実装方法を必ず採用する
- 一つの感染症で動作確認されたパターンを他でも使用する

### 今後の拡張計画

#### フェーズ1（完了）
- [x] 3感染症の基本実装
- [x] 統一テンプレートシステム
- [x] Step0統一実装
- [x] ナビゲーション統一

#### フェーズ2（計画中）
- [ ] 感染症間の共通コンポーネント抽出
- [ ] 統一デザインシステムの完成
- [ ] パフォーマンス最適化

## 開発方針

### コンテンツ改変禁止
**重要**: デバッグや開発の途中で、コンテンツのチャートやテキストを追加、もしくは改変することは禁止します。

- **開発のみに集中**: 機能実装、バグ修正、システム改善のみを行う
- **コンテンツ改変禁止**: チャート設定、テキスト、データファイルの変更は行わない
- **既存設定尊重**: 元々のconfig.jsonの内容を維持する
- **デモ用改変禁止**: 機能テストのためのコンテンツ変更も行わない

### 統一実装の強制
**最重要**: マルチ感染症システムでは統一性が最優先事項です。

- **個別最適化禁止**: 感染症ごとの特別実装は厳禁
- **統一パターン採用**: 一つの感染症で確立されたパターンを必ず他でも使用
- **共通コンポーネント使用**: shared/配下の共通リソースを活用
- **設定駆動開発**: ハードコードではなく設定ファイルでの制御

### 実装時の注意事項
- 機能の実装や修正は行うが、その過程でコンテンツ自体を変更してはならない
- 設定ファイル（config.json）の構造改善は可能だが、コンテンツの内容は変更しない
- テスト用のダミーデータやサンプルコンテンツの追加は行わない
- 一つの感染症で修正を行った場合、他の感染症も同様に修正して統一性を保つ