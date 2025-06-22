/**
 * CoordinateHelper - 座標計算とプロジェクション処理のユーティリティクラス
 * 地理的座標変換、座標計算、位置決めなどの共通処理を提供
 */
class CoordinateHelper {
    /**
     * 安全な座標プロジェクション変換
     * @param {Function} projection - D3のプロジェクション関数
     * @param {Array} coordinates - [経度, 緯度]の配列
     * @param {Array} fallback - 変換失敗時のフォールバック座標
     * @returns {Array} 変換された座標 [x, y]
     */
    static safeProjection(projection, coordinates, fallback = [0, 0]) {
        try {
            if (!projection || !coordinates || coordinates.length < 2) {
                return fallback;
            }
            
            const [longitude, latitude] = coordinates;
            
            // 有効な座標値の範囲チェック
            if (isNaN(longitude) || isNaN(latitude) ||
                longitude < -180 || longitude > 180 ||
                latitude < -90 || latitude > 90) {
                console.warn('Invalid coordinates:', coordinates);
                return fallback;
            }
            
            const result = projection(coordinates);
            return result || fallback;
            
        } catch (error) {
            console.warn('Projection failed:', error);
            return fallback;
        }
    }

    /**
     * 座標配列の一括プロジェクション変換
     * @param {Function} projection - D3のプロジェクション関数
     * @param {Array} coordinateArray - 座標配列の配列
     * @param {Array} fallback - 変換失敗時のフォールバック座標
     * @returns {Array} 変換された座標配列
     */
    static projectCoordinates(projection, coordinateArray, fallback = [0, 0]) {
        if (!Array.isArray(coordinateArray)) {
            return [fallback];
        }
        
        return coordinateArray.map(coords => 
            this.safeProjection(projection, coords, fallback)
        );
    }

    /**
     * 座標配列からオブジェクト形式に変換
     * @param {Array} coords - [x, y]座標配列
     * @param {Object} fallback - 変換失敗時のフォールバックオブジェクト
     * @returns {Object} {x, y}形式のオブジェクト
     */
    static coordsToObject(coords, fallback = { x: 0, y: 0 }) {
        if (!coords || !Array.isArray(coords) || coords.length < 2) {
            return fallback;
        }
        
        const [x, y] = coords;
        if (isNaN(x) || isNaN(y)) {
            return fallback;
        }
        
        return { x, y };
    }

    /**
     * オブジェクト形式から座標配列に変換
     * @param {Object} coordObj - {x, y}形式のオブジェクト
     * @param {Array} fallback - 変換失敗時のフォールバック座標
     * @returns {Array} [x, y]座標配列
     */
    static objectToCoords(coordObj, fallback = [0, 0]) {
        if (!coordObj || typeof coordObj !== 'object') {
            return fallback;
        }
        
        const x = coordObj.x || coordObj.longitude || 0;
        const y = coordObj.y || coordObj.latitude || 0;
        
        if (isNaN(x) || isNaN(y)) {
            return fallback;
        }
        
        return [x, y];
    }

    /**
     * 2点間の距離を計算（ピクセル座標）
     * @param {Array|Object} point1 - 点1の座標
     * @param {Array|Object} point2 - 点2の座標
     * @returns {number} 距離
     */
    static pixelDistance(point1, point2) {
        const coord1 = Array.isArray(point1) ? point1 : this.objectToCoords(point1);
        const coord2 = Array.isArray(point2) ? point2 : this.objectToCoords(point2);
        
        const [x1, y1] = coord1;
        const [x2, y2] = coord2;
        
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * 2点間の地理的距離を計算（ハヴァーサイン公式）
     * @param {Array} coord1 - 点1の座標 [経度, 緯度]
     * @param {Array} coord2 - 点2の座標 [経度, 緯度]
     * @param {string} unit - 単位 ('km', 'miles', 'nm')
     * @returns {number} 距離
     */
    static geographicDistance(coord1, coord2, unit = 'km') {
        if (!coord1 || !coord2 || coord1.length < 2 || coord2.length < 2) {
            return 0;
        }
        
        const [lon1, lat1] = coord1;
        const [lon2, lat2] = coord2;
        
        // 度をラジアンに変換
        const toRad = (deg) => deg * (Math.PI / 180);
        
        const R = {
            km: 6371,      // 地球の半径（キロメートル）
            miles: 3956,   // 地球の半径（マイル）
            nm: 3440       // 地球の半径（海里）
        };
        
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return (R[unit] || R.km) * c;
    }

    /**
     * 座標が境界内にあるかチェック
     * @param {Array} coord - チェックする座標 [x, y]
     * @param {Object} bounds - 境界 {minX, maxX, minY, maxY}
     * @returns {boolean} 境界内にあるかどうか
     */
    static isWithinBounds(coord, bounds) {
        if (!coord || coord.length < 2 || !bounds) {
            return false;
        }
        
        const [x, y] = coord;
        const { minX, maxX, minY, maxY } = bounds;
        
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    /**
     * 座標配列の境界矩形を計算
     * @param {Array} coordinates - 座標配列
     * @returns {Object} 境界矩形 {minX, maxX, minY, maxY, width, height}
     */
    static calculateBounds(coordinates) {
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        coordinates.forEach(coord => {
            const [x, y] = Array.isArray(coord) ? coord : this.objectToCoords(coord);
            
            if (!isNaN(x) && !isNaN(y)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        });
        
        // 無効な境界の場合はデフォルト値を返す
        if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
        
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * 座標を別の座標系にスケール変換
     * @param {Array} coord - 変換する座標 [x, y]
     * @param {Object} sourceBounds - ソース座標系の境界
     * @param {Object} targetBounds - ターゲット座標系の境界
     * @returns {Array} 変換された座標
     */
    static scaleCoordinate(coord, sourceBounds, targetBounds) {
        if (!coord || coord.length < 2 || !sourceBounds || !targetBounds) {
            return [0, 0];
        }
        
        const [x, y] = coord;
        
        // 正規化（0-1の範囲）
        const normalizedX = (x - sourceBounds.minX) / sourceBounds.width;
        const normalizedY = (y - sourceBounds.minY) / sourceBounds.height;
        
        // ターゲット座標系にスケール
        const scaledX = targetBounds.minX + (normalizedX * targetBounds.width);
        const scaledY = targetBounds.minY + (normalizedY * targetBounds.height);
        
        return [scaledX, scaledY];
    }

    /**
     * 座標を中心点から指定距離だけ移動
     * @param {Array} center - 中心座標 [x, y]
     * @param {number} distance - 移動距離
     * @param {number} angle - 移動角度（ラジアン）
     * @returns {Array} 移動後の座標
     */
    static moveCoordinate(center, distance, angle) {
        if (!center || center.length < 2) {
            return [0, 0];
        }
        
        const [x, y] = center;
        const newX = x + distance * Math.cos(angle);
        const newY = y + distance * Math.sin(angle);
        
        return [newX, newY];
    }

    /**
     * 座標配列の中心点を計算
     * @param {Array} coordinates - 座標配列
     * @returns {Array} 中心座標 [x, y]
     */
    static calculateCentroid(coordinates) {
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            return [0, 0];
        }
        
        let totalX = 0, totalY = 0, validCount = 0;
        
        coordinates.forEach(coord => {
            const [x, y] = Array.isArray(coord) ? coord : this.objectToCoords(coord);
            
            if (!isNaN(x) && !isNaN(y)) {
                totalX += x;
                totalY += y;
                validCount++;
            }
        });
        
        if (validCount === 0) {
            return [0, 0];
        }
        
        return [totalX / validCount, totalY / validCount];
    }

    /**
     * 座標を最も近いグリッド点にスナップ
     * @param {Array} coord - スナップする座標 [x, y]
     * @param {number} gridSize - グリッドサイズ
     * @returns {Array} スナップされた座標
     */
    static snapToGrid(coord, gridSize = 1) {
        if (!coord || coord.length < 2 || gridSize <= 0) {
            return [0, 0];
        }
        
        const [x, y] = coord;
        const snappedX = Math.round(x / gridSize) * gridSize;
        const snappedY = Math.round(y / gridSize) * gridSize;
        
        return [snappedX, snappedY];
    }

    /**
     * 座標の妥当性を検証
     * @param {Array} coord - 検証する座標
     * @param {Object} options - 検証オプション
     * @returns {Object} 検証結果 {valid: boolean, errors: Array}
     */
    static validateCoordinate(coord, options = {}) {
        const {
            requireFinite = true,
            minX = -Infinity,
            maxX = Infinity,
            minY = -Infinity,
            maxY = Infinity
        } = options;
        
        const errors = [];
        
        if (!coord || !Array.isArray(coord)) {
            errors.push('Coordinate must be an array');
            return { valid: false, errors };
        }
        
        if (coord.length < 2) {
            errors.push('Coordinate must have at least 2 elements');
            return { valid: false, errors };
        }
        
        const [x, y] = coord;
        
        if (requireFinite && (!isFinite(x) || !isFinite(y))) {
            errors.push('Coordinate values must be finite numbers');
        }
        
        if (x < minX || x > maxX) {
            errors.push(`X coordinate ${x} is outside valid range [${minX}, ${maxX}]`);
        }
        
        if (y < minY || y > maxY) {
            errors.push(`Y coordinate ${y} is outside valid range [${minY}, ${maxY}]`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.CoordinateHelper = CoordinateHelper;