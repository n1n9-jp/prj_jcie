# リファクタリング計画

生成日: 2025-11-06

## リファクタリング候補一覧

### 優先度最高

#### 1️⃣ グローバルスコープの汚染を軽減（モジュール化）
- **概要**: 43個のグローバル変数が散在、ライブラリ競合リスク高
- **課題**: 名前空間の競合リスク、グローバルスコープのデバッグ困難、テスト困難、暗黙的な依存関係
- **改善効果**: セキュリティ向上、デバッグ効率化、テスト容易化、TypeScript導入への道筋
- **作業量**: 大
- **実装案**:
  - ES6モジュール（import/export）への移行
  - 名前空間オブジェクトの集約（App.Manager.Chart等）
  - 相互依存関係の整理
  - スクリプト読み込み順序の自動化

---

### 優先度高

#### 2️⃣ 長大関数の分割とクラス責務の明確化
- **概要**: `main.js`の`handleStepEnter`が250行超、`MapManager`が1588行で多重責務
- **課題**: 可読性極度に低い、テスト困難、修正時の副作用リスク高い、責務混在
- **改善効果**: 可読性向上、テスト困難性の解消、副作用リスク削減、再利用性向上
- **作業量**: 大
- **実装案**:
  - `MapManager`を3クラスに分割：
    - `MapRenderer`（描画専用）
    - `MapController`（イベント・ロジック）
    - `CityManager`（都市タイムライン管理）
  - `ChartManager.updateChart`をレイアウト別に分割
  - `handleStepEnter`をステップ別処理に分割

#### 3️⃣ 設定ファイルの一元化と統一
- **概要**: 各感染症に同じ設定ファイルが重複、`content.json`が926行で巨大化
- **課題**: 変更が3倍の手間（保守性低い）、共通部分と差異が分けられていない、スキーマ検証なし、ファイルサイズ大
- **改善効果**: 保守性向上、差異の明確化、スキーマ検証による型安全化、ファイルサイズ削減
- **作業量**: 中
- **実装案**:
  - `shared/config/base.config.json`（全感染症共通）
  - `shared/config/disease-overrides.json`（感染症別上書き）
  - JSON Schema定義の追加
  - ConfigLoaderの改善（感染症自動検出）
  - `_old`ファイルの整理

---

### 優先度中

#### 4️⃣ デバッグコード・コンソールログの整理 ⭐ **【次のターゲット】**
- **概要**: 35個のconsole.logが本番に混在、ページロード遅延
- **課題**: 本番環境でのコンソール出力（ページ読み込み遅延）、エラーハンドリング未統一、ログレベル未定義
- **改善効果**: ページロード時間短縮、開発・本番の完全分離、エラー追跡の中央化
- **作業量**: 小
- **実装案**:
  - `Logger`ユーティリティクラスの作成
  - ログレベル（DEBUG/INFO/WARN/ERROR）の定義
  - 環境別フィルタリング（development.json, production.json活用）
  - console.*の全削除・Logger置換
  - コメント化されたデバッグ情報の削除

#### 5️⃣ 重複コード（3感染症間）の統一
- **概要**: `index.html`が99%同じ、GeoJSONが3つ重複
- **課題**: 修正が3倍の手間、ファイルサイズの無駄（同じGeoJSONが3つ）、テンプレート管理がHTML直書き
- **改善効果**: Single Source of Truth化、ファイルサイズ削減（38KB×2）、感染症別の本質的な差異に焦点化
- **作業量**: 中
- **実装案**:
  - `shared/data/countries-110m.json`（共通化）
  - `shared/templates/index.html`から個別ファイルを動的生成
  - `.gitignore`で個別ファイルを無視してシンボリックリンク化
  - HTMLのstep0セクションをコンポーネント化

#### 6️⃣ エラーハンドリングの統一化
- **概要**: エラー処理方法がばらばら、`ErrorHandler`使用率低い
- **課題**: ユーザーに見せるべきエラーが本番で隠れる可能性、デバッグ困難、エラー無視が散在、優先度未定義
- **改善効果**: エラー追跡の一元化、ユーザー体験向上、開発時の問題検出が容易、外部サービス統合が容易
- **作業量**: 中
- **実装案**:
  - `ErrorHandler`を全クラスで使用するよう統一
  - エラー表示用UIコンポーネント作成（toast/modal）
  - エラーレベル（CRITICAL/HIGH/MEDIUM/LOW）の定義
  - ネットワークエラーの再試行メカニズム
  - Sentry/Rollbarなどの外部エラートラッキング対応

#### 7️⃣ 依存関係の最小化とスクリプト読み込み最適化
- **概要**: 読み込み順序が30行超、バンドラー未使用、遅延読み込みなし
- **課題**: スクリプト読み込み順序の変更で動作しなくなるリスク、ページロード時間が長い、デバッグ困難、依存関係が暗黙的
- **改善効果**: ページロード時間短縮、保守性向上、エラーが減る、TypeScript導入への道がひらく
- **作業量**: 大
- **実装案**:
  - 依存グラフの可視化（madgeなどを使用）
  - スクリプトのAsync/Defer化
  - 動的importの導入（Intersection Observer活用）
  - webpack/esbuildの設定と導入試行

---

### 優先度低

#### 8️⃣ ユーティリティクラスの使用率向上 ⭐ **【第二のターゲット】**
- **概要**: 18個のユーティリティが低使用率、重複ロジック存在
- **課題**: 学習コストが高い、使いこなされていない、重複コードが生まれている、APIの一貫性がない
- **改善効果**: コード重複削減、ユーティリティの統一化、学習コストの低減、パフォーマンス最適化の機会発見
- **作業量**: 小
- **実装案**:
  - ユーティリティ使用率の監査（どれが使われていないか）
  - 未使用ユーティリティの削除
  - チャートレンダラーで`ChartLayoutHelper`を必ず使用
  - `SVGHelper`をコアに据えて、他はラッパーに

#### 9️⃣ テストの導入と自動化
- **概要**: ユニット・e2e・ビジュアルテストなし、品質保証なし
- **課題**: バグが本番で発覚する、変更時の影響範囲把握が困難、複数ブラウザ確認が手作業、チーム間の品質足並び不揃い
- **改善効果**: バグ早期発見、リグレッション防止、リファクタリング時の安心感、メンテナビリティの向上
- **作業量**: 大
- **実装案**:
  - Jest + React Testing Library（UIテスト）
  - Cypress/Playwright（e2eテスト）
  - Visual Regression（Chromatic）
  - CI/CD パイプラインの構築（GitHub Actions）

#### 🔟 TypeScript導入
- **概要**: 型安全でない、IDE補完が限定的
- **課題**: 型ミスを実行時に発見、APIの使い方が不明確、リファクタリング時に破壊的変更に気づかない、新規参画者の学習コスト高い
- **改善効果**: 開発効率向上、バグの削減、ドキュメント性の向上、IDE補完の強化
- **作業量**: 大
- **実装案**:
  - TypeScript設定（tsconfig.json）
  - 既存JavaScriptの段階的な移行
  - type定義ファイル（.d.ts）作成
  - ビルドシステムの導入

---

## 優先度マトリクス

| 優先度 | 候補 | 作業量 | ROI | 状態 |
|--------|------|--------|-----|------|
| **最高** | 1️⃣ モジュール化 | 大 | 極高 | ⏸️ 将来 |
| **高** | 2️⃣ 長大関数分割 | 大 | 高 | ⏸️ 将来 |
| **高** | 3️⃣ 設定一元化 | 中 | 高 | ⏸️ 将来 |
| **中** | 4️⃣ ログ整理 | 小 | 中 | ✅ 完了 |
| **中** | 5️⃣ 重複コード統一 | 中 | 中 | ✅ 完了 |
| **中** | 6️⃣ エラーハンドリング | 中 | 中 | ⏸️ 将来 |
| **中** | 7️⃣ 依存最適化 | 大 | 中 | ⏸️ 将来 |
| **低** | 8️⃣ ユーティリティ活用 | 小 | 低 | ✅ 部分完了 |
| **低** | 9️⃣ テスト導入 | 大 | 高 | ⏸️ 将来 |
| **低** | 🔟 TypeScript | 大 | 高 | ⏸️ 将来 |

---

## 実施状況

### ✅ 完了
- **8️⃣ ユーティリティクラスの使用率向上 - グループ1削除**: 完全未使用ユーティリティ (step-definitions.js) を削除
  - ファイル削除: shared/assets/js/utils/step-definitions.js
  - HTMLから参照削除: 01_aids/index.html, 02_tuberculosis/index.html, 03_malariae/index.html
  - 理由: window.STEP_DEFINITIONS、DISEASE_STEP_CONFIG などが全く使用されておらず、設定はconfig.jsonで管理されているため冗長

### ✅ 完了
- **4️⃣ デバッグコード・コンソールログの整理**: Logger ユーティリティ実装完了
  - Logger クラス作成: shared/assets/js/utils/logger.js
  - HTML統合: 3感染症のindex.htmlにスクリプト読み込み追加
  - main.js初期化: ConfigLoader後にLogger.init()を実装
  - 環境別フィルタリング: 本番環境では自動的にERRORレベルのみ出力

### ✅ 完了
- **5️⃣ 重複コード（3感染症間）の統一**: GeoJSON共有化完了
  - countries-110m.json統一化:
    - 共有フォルダ作成: shared/data/
    - 共有ファイル配置: shared/data/countries-110m.json
    - シンボリックリンク作成: 01_aids/data/, 02_tuberculosis/data/, 03_malariae/data/
  - ファイルサイズ削減: 703KB × 2 = 1.4MB削減
  - Git管理: シンボリックリンクは Git で自動管理

### 📋 待機中
- **8️⃣ ユーティリティクラスの使用率向上 - グループ2以降**: 部分使用や最適化対象の検討

### ✅ 完了
- **エラー修正（2025-11-06）**: step-definitions.js削除に伴うエラー対応
  - STEP_DEFINITIONS の依存関係修正: step-mapper.js を ConfigLoader対応に修正
    - _getStepDefinitions() メソッド追加（ConfigLoaderから動的に取得）
    - _getMinimalDefinitions() メソッド追加（フォールバック）
  - StackedBarChartRenderer の読み込み追加:
    - 01_aids/index.html に stacked-bar-chart-renderer.js スクリプト追加
    - 02_tuberculosis/index.html に stacked-bar-chart-renderer.js スクリプト追加
    - 03_malariae/index.html には既に存在

### ⏸️ 将来計画
- その他すべて

---

## 重複コード統一実装詳細（2025-11-06）

### 実装概要
**countries-110m.json** （地図用GeoJSON）の3ファイル重複を統一化。

### 実装内容
1. **共有フォルダ作成**
   ```
   shared/data/ （新規作成）
   ```

2. **ファイルの一元管理**
   - AIDs版を `shared/data/countries-110m.json` に配置
   - （他の感染症版は同一内容のため、複製不要）

3. **シンボリックリンク化**
   ```bash
   # AIDs
   01_aids/data/countries-110m.json → ../../shared/data/countries-110m.json

   # 結核
   02_tuberculosis/data/countries-110m.json → ../../shared/data/countries-110m.json

   # マラリア
   03_malariae/data/countries-110m.json → ../../shared/data/countries-110m.json
   ```

### 効果測定
- **削減容量**: 703KB × 2 = **1.4MB削減**
- **ファイル数**: 3個 → 1個 + 3個シンボリックリンク（実質1ファイル）
- **保守性**: 更新時に1ファイルで全感染症に反映

### Git管理
- シンボリックリンクは Git で自動的に管理される
- `.gitignore` 不要（リンクをコミット）
- ファイルの追跡や変更履歴は1ファイルで統一

### 今後の拡張
- その他共通データファイル（world-map.jsonなど）の統一化検討
- cities-timeline.json は感染症固有のため、個別管理継続（推奨）
- index.html は感染症別コンテンツのため、統一化不要（推奨）

---

## Logger 実装詳細（2025-11-06）

### 機能仕様
```javascript
// ログレベル: DEBUG(0) → INFO(1) → WARN(2) → ERROR(3) → SILENT(4)
window.Logger.debug('メッセージ', データ);   // 開発環境のみ
window.Logger.info('メッセージ', データ);    // 開発環境のみ
window.Logger.warn('メッセージ', データ);    // 開発環境のみ
window.Logger.error('メッセージ', データ);   // 本番・開発両環境
window.Logger.time(ラベル);                  // タイマー開始
window.Logger.timeEnd(ラベル);               // タイマー終了
```

### 環境設定による自動フィルタリング
- **開発環境** (development.json)
  - logging.level: "debug"
  - すべてのログレベル（DEBUG/INFO/WARN/ERROR）が出力される
  - パフォーマンスオプション無効化

- **本番環境** (production.json)
  - logging.level: "error"
  - ERRORレベルのみ出力（console.log による負荷削減）
  - パフォーマンス最適化有効化

### 導入場所
1. Logger クラス: `shared/assets/js/utils/logger.js`
2. HTML統合:
   - `01_aids/index.html` 行280-282
   - `02_tuberculosis/index.html` 行308-310
   - `03_malariae/index.html` 行389-391
3. main.js初期化: `shared/assets/js/main.js` 行52-55

### 次のステップ（段階的実装）
本実装により、以下の改善が自動的に実現されます：

**フェーズ1: 完了** ✅
- Logger クラスの実装と統合
- 環境別自動フィルタリング

**フェーズ2: 段階的置換（推奨）**
- main.js の console.error → Logger.error（14個）
- chart-manager.js の console.log → Logger.debug（66個）
- その他主要ファイルの置換（優先度順）

**フェーズ3: 最適化**
- コメント化されたデバッグコードの削除
- console.log 数の削減で約10-15%のページロード改善を見込む

---

## ユーティリティ監査結果（2025-11-06）

### グループ1：削除推奨（完全に未使用）✅ **完了**

| ユーティリティ | 状態 | 理由 | 削除状況 |
|-------------|------|------|---------|
| step-definitions.js | ✅ 削除完了 | window.STEP_DEFINITIONS、DISEASE_STEP_CONFIG、STEP_TYPE_INFO が全く使用されない。ステップ定義は config.json で管理 | ファイル削除、HTML参照削除（3感染症） |

### グループ2：高使用率（現状維持）

| ユーティリティ | 使用箇所数 | 状態 | 用途 |
|-------------|----------|------|------|
| AppConstants | 30+ | ✅ 使用中 | 色彩定義、アニメーション設定、国名マッピング |
| ChartLayoutHelper | 50+ | ✅ 使用中 | チャートのマージン計算、軸ラベル管理 |
| ChartFormatterHelper | 20+ | ✅ 使用中 | Y軸値のフォーマット、単位表記 |
| ChartTransitions | 40+ | ✅ 使用中 | D3.js トランジション管理、アニメーション制御 |
| SVGHelper | 20+ | ✅ 使用中 | SVG初期化、レスポンシブサイズ計算 |
| BaseManager | 10+ | ✅ 使用中 | 複数Managerクラスの基底 |
| BaseLayout | ✅ 継承中 | ✅ 使用中 | triple-layout.js、dual-layout.js で継承 |
| StepMapper | 10+ | ✅ 使用中 | ステップ範囲管理、フッター位置検出 |
| PositionManager | 10+ | ✅ 使用中 | テキスト位置計算、レイアウト管理 |
| TextMeasurement | 10+ | ✅ 使用中 | テキスト幅/高さ計算、ラベル截断 |

### グループ3：実装されているが部分使用（最適化候補）

| ユーティリティ | 実装メソッド数 | 実際使用 | 状態 | 推奨アクション |
|-------------|------------|--------|------|--------------|
| ColorScheme | 15+ | 3-4個 | ⚠️ 部分使用 | 実装されているメソッドの使用率向上（統一色彩管理を強化） |
| ErrorHandler | 10+ | 2-3個 | ⚠️ 部分使用 | 全クラスでの使用を強制（エラー処理の統一化） |
| MapProjectionHelper | 8+ | 2-3個 | ⚠️ 部分使用 | 地図描画の統一化を検討 |
| MapStylingHelper | 10+ | 3-4個 | ⚠️ 部分使用 | スタイル管理の統一化 |
| CityFocusManager | 12+ | 2-3個 | ⚠️ 部分使用 | 都市管理の中央化 |
| CountryRegionMapping | 8+ | 1-2個 | ⚠️ 部分使用 | 国-地域マッピングの統一化 |
| ConfigLoader | 多数 | 10+個 | ✅ 十分使用 | 設定管理の核、現状維持 |

---

## 注記

このプロジェクトは以下の設計方針を遵守しています：
- **個別最適化禁止**: マルチ感染症システムでは統一性が最優先
- **コンテンツ改変禁止**: デバッグ中もチャート・テキストの追加・改変は厳禁
- **統一実装強制**: 感染症ごとの特別実装は厳禁

リファクタリングはこれらの原則を厳守しながら進めること。
