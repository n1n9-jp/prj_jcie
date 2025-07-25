# スクロールテリングコンテンツ管理ガイド

## 概要

このドキュメントは、JCIEスクロールテリングシステムでのコンテンツ追加・修正手順を詳しく説明します。本システムは`data-step`属性に基づいてコンテンツを管理し、統一されたJSONファイルでテキスト、チャート、地図の表示を制御します。

## システム構成

### ファイル構造
```
01_aids/                  # エイズコンテンツ
├── index.html           # メインHTMLファイル
├── config/
│   └── content.json     # コンテンツ設定
└── data/               # データファイル（CSV形式）

02_tuberculosis/         # 結核コンテンツ
├── index.html
├── config/
│   └── content.json
└── data/

03_malariae/            # マラリアコンテンツ
├── index.html
├── config/
│   └── content.json
└── data/
```

### 基本概念

1. **Step**: 各スクロール位置でのコンテンツ状態
2. **data-step属性**: HTMLでのステップ識別子
3. **content.json**: ステップとコンテンツの対応設定
4. **統一レイアウト**: single, dual, triple, gridの4種類

## コンテンツ追加手順

### 1. 新しいStepの追加

#### Step 1.1: HTMLファイルの編集

`index.html`に新しいステップ要素を追加します：

```html
<div class="step" data-step="new-step-id">
    <div class="w-full min-h-screen flex items-center">
        <div class="max-w-lg mx-auto p-8 bg-white bg-opacity-90 rounded-lg shadow-lg">
            <p class="text-gray-700 leading-relaxed">
                <!-- テキストはcontent.jsonで管理されるため、ここは空でOK -->
            </p>
        </div>
    </div>
</div>
```

**重要**: `data-step`値は英数字とハイフンのみ使用してください。

#### Step 1.2: content.jsonの編集

`config/content.json`に対応する設定を追加します：

```json
{
  "id": "new-step-id",
  "text": {
    "content": "ここにテキスト内容を記述",
    "visible": true,
    "position": {
      "width": "30%",
      "horizontal": "right",
      "vertical": "center"
    }
  },
  "chart": {
    "visible": false
  },
  "map": {
    "visible": false
  },
  "image": {
    "visible": false
  }
}
```

### 2. チャート表示の追加

#### 2.1: データファイルの準備

`data/`フォルダにCSVファイルを配置します。統一スキーマに従ってください：

```csv
year,series,value
2020,感染者数,1000000
2021,感染者数,900000
2020,死亡者数,50000
2021,死亡者数,45000
```

**必須要件**:
- ヘッダー行: `year,series,value`
- 年度データ: `year`列
- 系列データ: `series`列（グラフの線や分類）
- 数値データ: `value`列

#### 2.2: チャート設定の追加

content.jsonでチャート表示を設定します：

```json
{
  "id": "chart-step",
  "text": {
    "content": "チャートの説明文",
    "position": {
      "width": "30%",
      "horizontal": "right",
      "vertical": "center"
    }
  },
  "chart": {
    "visible": true,
    "type": "line",
    "dataFile": "sample_data.csv",
    "title": "チャートタイトル",
    "config": {
      "widthPercent": 70,
      "heightPercent": 60,
      "xField": "year",
      "yField": "value",
      "seriesField": "series",
      "multiSeries": true,
      "colors": ["#1f77b4", "#ff7f0e"],
      "dataSource": "データソース表記"
    }
  }
}
```

### 3. デュアルレイアウト（2つのチャート並列表示）

複数のチャートを横並びで表示する場合：

```json
{
  "id": "dual-chart-step",
  "text": {
    "content": "2つのチャートの比較説明",
    "position": {
      "width": "30%",
      "horizontal": "right",
      "vertical": "center"
    }
  },
  "chart": {
    "layout": "dual",
    "visible": true,
    "position": {
      "horizontal": "left",
      "vertical": "center",
      "width": "70%",
      "height": "100%"
    },
    "charts": [
      {
        "id": "chart1",
        "type": "line",
        "title": "チャート1のタイトル",
        "dataFile": "data1.csv",
        "config": {
          "widthPercent": 70,
          "heightPercent": 100,
          "xField": "year",
          "yField": "value",
          "seriesField": "series"
        }
      },
      {
        "id": "chart2",
        "type": "line",
        "title": "チャート2のタイトル",
        "dataFile": "data2.csv",
        "config": {
          "widthPercent": 70,
          "heightPercent": 100,
          "xField": "year",
          "yField": "value",
          "seriesField": "series"
        }
      }
    ]
  }
}
```

### 4. グリッドレイアウト（複数円グラフの格子表示）

地域別データなどの格子状表示：

```json
{
  "id": "grid-chart-step",
  "chart": {
    "layout": "grid",
    "visible": true,
    "position": {
      "horizontal": "center",
      "vertical": "center",
      "width": "100%",
      "height": "100%"
    },
    "config": {
      "dataFile": "regional_data.csv",
      "columns": 8,              // 手動指定
      "rows": 2,                 // 手動指定
      "chartType": "pie",
      "chartWidth": 120,
      "chartHeight": 120,
      "labelField": "region",
      "valueField": "percentage",
      "categoryField": "ageGroup",
      "title": "地域別データ",
      "showLabels": true
    }
  }
}
```

### 5. 地図表示の設定

世界地図や都市フォーカス機能：

```json
{
  "id": "map-step",
  "map": {
    "visible": true,
    "center": [35.6762, 139.6503],    // [緯度, 経度]
    "zoom": 10,
    "config": {
      "focusCountries": ["JPN", "USA", "CHN"],
      "useRegionColors": true,
      "lightenAllCountries": false
    }
  }
}
```

### 6. 画像表示の設定

背景画像やステップ0の画像：

```json
{
  "id": "image-step",
  "image": {
    "visible": true,
    "src": "assets/images/sample.jpg",
    "alt": "画像の説明",
    "position": {
      "width": "100%",
      "height": "100%",
      "objectFit": "cover",
      "specialMode": "step0-background"    // ステップ0背景用
    }
  }
}
```

## コンテンツ修正手順

### 1. テキスト内容の修正

content.jsonの`text.content`フィールドを直接編集：

```json
{
  "text": {
    "content": "修正後のテキスト内容。<br>改行も可能です。"
  }
}
```

### 2. チャート設定の修正

#### タイトル変更:
```json
{
  "chart": {
    "title": "新しいチャートタイトル",
    "config": {
      "title": "新しいチャートタイトル"    // こちらも合わせて変更
    }
  }
}
```

#### データファイル変更:
```json
{
  "chart": {
    "dataFile": "new_data.csv"    // 新しいCSVファイル名
  }
}
```

#### サイズ調整:
```json
{
  "chart": {
    "config": {
      "widthPercent": 80,     // 幅をブラウザの80%に
      "heightPercent": 70     // 高さをブラウザの70%に
    }
  }
}
```

### 3. レイアウト位置の調整

```json
{
  "text": {
    "position": {
      "width": "40%",           // テキスト幅
      "horizontal": "left",     // left, center, right
      "vertical": "top"         // top, center, bottom
    }
  }
}
```

## 注意事項とベストプラクティス

### 1. Step管理の重要ルール

**⚠️ 最重要**: Step番号を変更する際は、以下を同時に確認・修正すること：

1. **HTMLの`data-step`属性**: 連番かつ重複なし
2. **content.jsonの`id`フィールド**: HTMLと一致
3. **main.js内のstep参照**: 特にフッター表示step番号

### 2. データファイルの命名規則

- **推奨**: `description_data.csv`形式
- **例**: `trend_new_infections.csv`, `regional_coverage.csv`
- **避ける**: スペース、特殊文字、日本語ファイル名

### 3. レスポンシブ対応

```json
{
  "config": {
    "widthPercent": 80,        // パーセンテージ指定推奨
    "heightPercent": 60,
    "minWidth": 400,           // 最小サイズ指定
    "maxWidth": 1200
  }
}
```

### 4. カラーパレット統一

各感染症で統一されたカラーテーマを使用：

```json
{
  "config": {
    "colors": [
      "#ff6b6b",    // エイズ: 赤系
      "#4ecdc4",    // 結核: 青緑系  
      "#f4a620"     // マラリア: 黄系
    ]
  }
}
```

### 5. エラー回避のチェックリスト

- [ ] CSVファイルのヘッダーが`year,series,value`
- [ ] `data-step`属性に重複がない
- [ ] content.jsonのJSON文法が正しい
- [ ] 画像ファイルパスが正確
- [ ] 必須フィールドが欠けていない

## トラブルシューティング

### チャートが表示されない場合

1. **ブラウザのコンソールを確認**
2. **CSVファイルの存在確認**
3. **JSON文法エラーのチェック**
4. **データフィールド名の確認**（xField, yField, seriesField）

### レイアウトが崩れる場合

1. **position設定の確認**
2. **widthPercent/heightPercentの調整**
3. **HTMLとJSONのid一致確認**

### Step遷移がうまくいかない場合

1. **data-step属性の連番確認**
2. **main.jsのstep範囲確認**
3. **scrollama.jsの初期化確認**

## 実際の作業例

### 例1: 新しい折れ線グラフステップの追加

1. **データ準備**: `data/new_trend.csv`を作成
2. **HTML追加**:
```html
<div class="step" data-step="new-trend">
    <!-- コンテンツ -->
</div>
```

3. **JSON設定**:
```json
{
  "id": "new-trend",
  "text": {
    "content": "新しいトレンドの説明"
  },
  "chart": {
    "visible": true,
    "type": "line",
    "dataFile": "new_trend.csv",
    "config": {
      "widthPercent": 70,
      "heightPercent": 60
    }
  }
}
```

### 例2: 既存チャートのデータ更新

1. **新しいCSVファイル作成**: `new_data.csv`
2. **JSON更新**:
```json
{
  "chart": {
    "dataFile": "new_data.csv",
    "title": "更新されたタイトル"
  }
}
```

## まとめ

本システムでは、HTMLの`data-step`属性とcontent.jsonの`id`を対応させることで、一元的にコンテンツを管理しています。新規追加・修正時は必ずこの対応関係を維持し、統一されたデータ形式（year,series,value）に従ってください。

疑問点がある場合は、既存の動作しているステップ設定を参考にして、同様のパターンで実装することをお勧めします。