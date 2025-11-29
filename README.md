# Scrollytelling プロジェクト

3 疾患（HIV/エイズ、結核、マラリア）それぞれのストーリーをスクロール操作で展開する静的サイト群です。各感染症ディレクトリ (`01_aids`, `02_tuberculosis`, `03_malariae`) は同じ構成を持ち、共有アセット (`shared/…`) によって共通ロジックとスタイルを切り替えています。

## 主要ディレクトリ
- `0x_*` : 感染症ごとのHTML・データ・設定ファイル。
- `shared/assets/js` : 共通のマネージャー／レンダラー／ユーティリティ群。
- `shared/assets/css` : 統一スタイルシート。
- `shared/data` : 共通TopoJSONやその他共有データ。

## 感染症ごとの設定テキスト
各疾患フォルダの `config/` には、ConfigLoader が読み込む複数のテキストファイルがあり、以下の責務を持っています。

| ファイル | 役割 |
| --- | --- |
| `main.config.json` | ConfigLoader の司令塔。読み込むファイル（`app-settings.json`, `content.json`, `content-map.json` など）とロード順、マージ戦略、フォールバック方針を定義します。`environmentOverrides` を追加すれば単一環境向けの上書きも可能です。 |
| `shared/config/app-settings.base.json` | 全感染症共通のUI/UX設定。レイアウト・スクロール・レスポンシブ・チャート/マップ既定値などを一元管理します。 |
| `app-settings.json` | 各感染症固有の上書き設定。メタ情報（疾患名など）やテーマカラー、チャート配色、`ui.theme` などを base にマージして最終設定を構成します。 |
| `content.json` | スクロリーテリング本編の脚本。各ステップのID、テキスト、チャート/マップ/画像の表示設定、参照データファイル、トランジションパラメータなどを列挙し、`ScrollytellingApp`・`ChartManager`・`MapManager` がこれに従って表示を切り替えます。 |
| `content-map.json` | 地図タイムライン用のデータ。タイトル・説明と、国ごとの座標/順番/スタイル/スクロール距離を定義し、`CityStepsGenerator` がステップを自動生成する際に参照します。 |

## 共有ローダーと利用箇所
- `shared/assets/js/utils/config-loader.js` が `main.config.json` を起点に上記ファイル群を読み込み、CSS変数適用やパス解決を実施。
- `shared/assets/js/core/data-loader.js` は `ConfigLoader` で決定した `content-map.json` を読み込み、都市データ・CSV・TopoJSONをまとめて `ScrollytellingApp` に渡します。
- `shared/assets/js/core/city-steps-generator.js` や `shared/assets/js/utils/step-mapper.js` は `content-map.json` を前提に都市ステップを構築します。

## 動作確認
```bash
npm install
npm run dev
npm test # Jest (jsdom)
```

ブラウザ確認時は任意の感染症ディレクトリをローカルサーバーで配信し、`shared/` への相対パスを保持したままアクセスしてください。
