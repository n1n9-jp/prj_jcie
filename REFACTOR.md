# リファクタリング計画

## ✅ 完了したタスク

### 1️⃣ グローバルスコープの汚染を軽減（モジュール化）
- **対応**: ES Modules (ESM) への完全移行を実施。
- **結果**: `shared/assets/js` 内のすべてのスクリプトをモジュール化し、`import/export` ベースの依存管理に移行しました。

### 7️⃣ 依存関係の最小化と読み込み最適化
- **対応**: Vite の導入。
- **結果**: 多数の `<script>` タグを削除し、エントリポイント (`main.js`) からのモジュール読み込みに一本化しました。Tailwind CSS も導入し、スタイリングの依存関係も整理しました。

### 6️⃣ エラーハンドリングの統一化
- [x] Unify error handling with `ErrorHandler` class
  - [x] Replace `console.error` in Managers
  - [x] Replace `console.error` in Renderers
  - [x] Implement consistent error notification UIdler.handle` を経由。
  - 軽量な Toast もしくは Alert UI を作成し、致命的エラーのみ表示。
  - 重要ログは Logger と連携して集計。

---

## 🚧 今後の課題（未完了）

### 8️⃣ ユーティリティクラスの使用率向上
- **現状**: Map 系は `MapHelper` に統一済み、Chart 系ユーティリティの適用が未着手。
- **残タスク**:
  - `ChartLayoutManager`/`ChartFormatterHelper` をすべてのレンダラーで必須化。
  - 未使用のユーティリティ（存在すれば）削除または README に用途を明記。

### 9️⃣ テスト導入と自動化
- **目的**: リグレッション検知とブラウザ差異の早期発見。
- **着手案**:
  - Jest でユーティリティ・マネージャーの単体テスト。
  - Playwright などで主要ステップの E2E テスト。
  - GitHub Actions で PR 時に自動実行。

### 🔟 TypeScript 導入
- **価値**: 型補完とリファクタ耐性の向上。
- **段階案**:
  1. `tsconfig` と `checkJs` を導入して型エラーを洗い出す。
  2. Utils → Managers → Renderers の順で `.ts` 化。
  3. ビルドは既存バンドラ（Vite）と統合。
