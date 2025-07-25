# チャートタイプリファレンス

## 概要

スクロールテリングシステムで使用可能な全チャートタイプの設定方法と実装例を詳しく説明します。

## 基本チャートタイプ

### 1. 折れ線グラフ (Line Chart)

時系列データやトレンド表示に最適。

#### 基本設定
```json
{
  "chart": {
    "type": "line",
    "dataFile": "trend_data.csv",
    "title": "感染者数の推移",
    "config": {
      "widthPercent": 70,
      "heightPercent": 60,
      "xField": "year",
      "yField": "value",
      "seriesField": "series",
      "multiSeries": true,
      "colors": ["#1f77b4", "#ff7f0e", "#2ca02c"],
      "dataSource": "WHO Global Health Observatory"
    }
  }
}
```

#### データ形式例
```csv
year,series,value
2020,感染者数,1000000
2021,感染者数,900000
2020,死亡者数,50000
2021,死亡者数,45000
```

#### 高度な設定オプション
```json
{
  "config": {
    "yRange": [0, 2000000],           // Y軸の範囲指定
    "showGrid": true,                 // グリッドライン表示
    "legendType": "inline",           // 凡例タイプ
    "yAxisFormat": {
      "type": "japanese",             // 日本語数値形式
      "decimals": 0,                  // 小数点以下桁数
      "units": {
        "万": 10000,                  // 単位変換
        "百万": 1000000
      }
    },
    "xAxis": {
      "title": "年"                   // X軸タイトル
    },
    "yAxis": {
      "title": "人数"                 // Y軸タイトル
    }
  }
}
```

### 2. 棒グラフ (Bar Chart)

カテゴリ別データの比較に適用。

#### 基本設定
```json
{
  "chart": {
    "type": "bar",
    "dataFile": "category_data.csv",
    "title": "地域別感染者数",
    "config": {
      "widthPercent": 80,
      "heightPercent": 70,
      "xField": "region",
      "yField": "value",
      "colors": ["#2ca02c"],
      "orientation": "vertical"        // vertical | horizontal
    }
  }
}
```

#### データ形式例
```csv
year,series,value
2023,アフリカ,5000000
2023,アジア,3000000
2023,ヨーロッパ,100000
2023,アメリカ,500000
```

### 3. 円グラフ (Pie Chart)

構成比や割合の表示に使用。

#### 基本設定
```json
{
  "chart": {
    "type": "pie",
    "dataFile": "composition_data.csv",
    "title": "感染者の年齢構成",
    "config": {
      "width": 300,
      "height": 300,
      "valueField": "value",
      "labelField": "ageGroup",
      "colors": ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"],
      "showPercentages": true,
      "showLabels": true
    }
  }
}
```

#### データ形式例
```csv
year,series,value
2023,0-14歳,150000
2023,15-24歳,300000
2023,25-49歳,800000
2023,50歳以上,250000
```

## 複合レイアウト

### 4. デュアルレイアウト (Dual Layout)

2つのチャートを横並びで表示。

#### 基本設定
```json
{
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
        "id": "left-chart",
        "type": "line",
        "title": "若年女性",
        "dataFile": "young_women_data.csv",
        "position": "left",
        "config": {
          "widthPercent": 70,
          "heightPercent": 100,
          "xField": "year",
          "yField": "value",
          "seriesField": "series"
        }
      },
      {
        "id": "right-chart", 
        "type": "line",
        "title": "若年男性",
        "dataFile": "young_men_data.csv",
        "position": "right",
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

### 5. グリッドレイアウト (Grid Layout)

複数の円グラフを格子状に配置。

#### 手動設定（推奨）
```json
{
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
      "dataFile": "regional_coverage.csv",
      "columns": 8,                    // 列数（地域数）
      "rows": 2,                       // 行数（カテゴリ数）
      "chartType": "pie",
      "chartWidth": 120,
      "chartHeight": 120,
      "rowSpacing": 30,
      "labelField": "region",          // 地域名
      "valueField": "percentage",      // パーセンテージ
      "categoryField": "ageGroup",     // 年齢グループ
      "title": "地域別HIV治療カバレッジ",
      "showLabels": true,
      "showPercentages": true
    }
  }
}
```

#### データ形式例（地域×カテゴリ）
```csv
region,ageGroup,percentage
全世界,成人,77
全世界,こども,57
アジア・太平洋地域,成人,67
アジア・太平洋地域,こども,75
カリブ海地域,成人,71
カリブ海地域,こども,39
```

#### 自動格子計算（実験的）
```json
{
  "config": {
    "gridMode": "auto",              // 自動計算モード
    "preferredAspectRatio": 1.6      // 好ましいアスペクト比
  }
}
```

## データフィルタリング機能

### 範囲フィルタ
特定の年度範囲のみ表示：

```json
{
  "config": {
    "filter": {
      "type": "range",
      "field": "year",
      "range": [2015, 2023]          // 2015-2023年のみ
    }
  }
}
```

### 系列フィルタ
特定の数列のみ表示：

```json
{
  "config": {
    "filter": {
      "type": "series",
      "field": "series",
      "values": ["感染者数"]          // 感染者数系列のみ
    }
  }
}
```

### トランジション更新
同一チャートでのスムーズなデータ切り替え：

```json
{
  "config": {
    "updateMode": "transition",      // トランジションモード
    "transitionDuration": 1000       // アニメーション時間（ms）
  }
}
```

## レスポンシブ設定

### パーセンテージ指定
ブラウザサイズに対する相対サイズ：

```json
{
  "config": {
    "widthPercent": 80,              // ブラウザ幅の80%
    "heightPercent": 60,             // ブラウザ高さの60%
    "minWidth": 400,                 // 最小幅
    "maxWidth": 1200,                // 最大幅
    "aspectRatio": 1.6               // アスペクト比
  }
}
```

### 固定サイズ指定
```json
{
  "config": {
    "width": 800,                    // 固定幅（px）
    "height": 600,                   // 固定高さ（px）
    "margin": {
      "top": 20,
      "right": 30,
      "bottom": 40,
      "left": 50
    }
  }
}
```

## アニメーション設定

### 基本アニメーション
```json
{
  "config": {
    "animation": {
      "enabled": true,
      "duration": 1000,               // アニメーション時間
      "easing": "easeQuadInOut",      // イージング関数
      "delay": 0                      // 開始遅延
    }
  }
}
```

### 段階的アニメーション（Object Constancy）
```json
{
  "config": {
    "objectConstancy": true,          // データポイント追跡
    "staggeredAnimation": {
      "enabled": true,
      "delay": 100                    // 各要素の遅延時間
    }
  }
}
```

## カラーパレット

### 感染症別統一カラー
```json
{
  "config": {
    "colors": [
      "#ff6b6b",                      // エイズ: 赤系
      "#4ecdc4",                      // 結核: 青緑系
      "#f4a620"                       // マラリア: 黄系
    ]
  }
}
```

### カテゴリ別カラー
```json
{
  "config": {
    "colorScheme": {
      "感染者数": "#1f77b4",
      "死亡者数": "#d62728",
      "治療者数": "#2ca02c"
    }
  }
}
```

## エラーハンドリング

### データ検証
```json
{
  "config": {
    "validation": {
      "required": ["year", "value"],   // 必須フィールド
      "numeric": ["value"],           // 数値フィールド
      "dateFormat": "YYYY"            // 日付形式
    }
  }
}
```

### フォールバック表示
```json
{
  "config": {
    "fallback": {
      "showError": true,              // エラー表示
      "errorMessage": "データを読み込めませんでした",
      "retryButton": false
    }
  }
}
```

## パフォーマンス最適化

### データサンプリング
大量データの間引き表示：

```json
{
  "config": {
    "sampling": {
      "enabled": true,
      "maxPoints": 1000,              // 最大データポイント数
      "method": "uniform"             // uniform | adaptive
    }
  }
}
```

### 遅延読み込み
```json
{
  "config": {
    "lazyLoading": true,              // 表示時にデータ読み込み
    "preload": false                  // 事前読み込み無効
  }
}
```

## 実装のベストプラクティス

### 1. データファイル命名規則
- **推奨**: `category_description.csv`
- **例**: `trend_new_infections.csv`, `regional_treatment_coverage.csv`

### 2. チャートID命名規則
- **推奨**: `kebab-case`形式
- **例**: `global-trend`, `regional-comparison`

### 3. 設定の階層化
```json
{
  "chart": {
    "type": "line",
    "dataFile": "data.csv",
    "title": "チャートタイトル",          // 表示用タイトル
    "config": {
      "title": "チャートタイトル",        // 設定用タイトル（同一にする）
      "widthPercent": 70,
      // その他の詳細設定
    }
  }
}
```

### 4. エラー回避のチェックポイント
- [ ] CSVヘッダーが`year,series,value`
- [ ] JSON文法が正確（カンマ、クォート）
- [ ] ファイルパスが正確
- [ ] 必須フィールドが存在
- [ ] データ型が適切（数値、文字列）

---

このリファレンスを参考に、適切なチャートタイプを選択し、データに応じた設定を行ってください。