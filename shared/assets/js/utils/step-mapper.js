/**
 * StepMapper - 論理名とインデックス番号の相互変換システム
 * 
 * このクラスは論理名ベースのステップ管理を提供し、
 * ステップの追加・削除時の整合性を自動的に保証します。
 */

window.StepMapper = class StepMapper {
    static cache = null;
    static currentDisease = null;
    
    /**
     * キャッシュをクリア（設定変更時に呼び出し）
     */
    static clearCache() {
        this.cache = null;
        this.currentDisease = null;
    }
    
    /**
     * 現在の感染症タイプを取得
     */
    static getCurrentDisease() {
        if (this.currentDisease) return this.currentDisease;
        
        // window.DISEASE_TYPE から取得
        this.currentDisease = window.DISEASE_TYPE || 'aids';
        return this.currentDisease;
    }
    
    /**
     * 動的ステップ（都市エピソード）の数を取得
     */
    static getDynamicStepCount(stepName) {
        if (stepName !== 'city-episodes') return 0;
        
        const disease = this.getCurrentDisease();
        const config = window.DISEASE_STEP_CONFIG?.[disease];
        
        if (config && config['city-episodes']) {
            return config['city-episodes'].expectedCityCount;
        }
        
        // フォールバック：content-map.jsonから動的に取得を試みる
        // （ただし、同期的な処理のため、実際にはconfig設定を推奨）
        return 7; // AIDSのデフォルト
    }
    
    /**
     * 全ステップマッピングを計算
     * @returns {Object} 論理名→インデックス番号のマッピング
     */
    static calculateAllMappings() {
        if (this.cache) return this.cache;

        // ConfigLoader から steps を取得（STEP_DEFINITIONS の代替）
        let stepDefinitions = this._getStepDefinitions();

        if (!stepDefinitions || Object.keys(stepDefinitions).length === 0) {
            if (window.Logger) {
                window.Logger.error('STEP_DEFINITIONS を取得できません');
            } else {
                console.error('STEP_DEFINITIONS を取得できません');
            }
            return {};
        }

        const mappings = {};
        let currentIndex = 0;

        // Step Definitionsに従って順序立ててマッピングを作成
        for (const [stepName, definition] of Object.entries(stepDefinitions)) {
            if (definition.type === 'fixed') {
                mappings[stepName] = currentIndex++;
            }
            else if (definition.type === 'dynamic') {
                const count = this.getDynamicStepCount(stepName);
                mappings[`${stepName}-start`] = currentIndex;

                // 個別の都市エピソード
                for (let i = 0; i < count; i++) {
                    mappings[`${stepName}-${i}`] = currentIndex++;
                }

                mappings[`${stepName}-end`] = currentIndex - 1;
                mappings[`${stepName}-count`] = count;
            }
        }


        this.cache = mappings;

        // デバッグ情報
        if (window.DEBUG_STEP_MAPPER) {
            const logger = window.Logger || console;
            logger.log('StepMapper: 計算されたマッピング', mappings);
        }

        return mappings;
    }

    /**
     * ステップ定義を取得（ConfigLoader または STEP_DEFINITIONS から）
     * @private
     */
    static _getStepDefinitions() {
        // グローバル STEP_DEFINITIONS を優先
        if (window.STEP_DEFINITIONS) {
            return window.STEP_DEFINITIONS;
        }

        // ConfigLoader から步 情報を取得して STEP_DEFINITIONS を構築
        if (window.ConfigLoader && window.ConfigLoader.loaded) {
            const config = window.ConfigLoader.getLegacyCompatibleConfig();

            if (config && config.steps) {
                const definitions = {};

                config.steps.forEach(step => {
                    const stepId = step.id || step['data-step'];

                    // 特別なステップを検出
                    if (stepId === 'city-episodes' || stepId?.includes('city')) {
                        definitions[stepId] = {
                            type: 'dynamic',
                            description: 'City episodes',
                            contentType: 'mixed'
                        };
                    } else {
                        definitions[stepId] = {
                            type: 'fixed',
                            description: stepId,
                            contentType: 'mixed'
                        };
                    }
                });

                return definitions;
            }
        }

        // フォールバック: 最小限の定義
        return this._getMinimalDefinitions();
    }

    /**
     * 最小限のステップ定義を取得（フォールバック用）
     * @private
     */
    static _getMinimalDefinitions() {
        return {
            'opening': { type: 'fixed', description: 'Opening' },
            'intro': { type: 'fixed', description: 'Introduction' },
            'city-episodes': { type: 'dynamic', description: 'City episodes' },
            'footer': { type: 'fixed', description: 'Footer' }
        };
    }
    
    /**
     * 論理名からインデックス番号を取得
     * @param {string} stepName - 論理名
     * @returns {number|null} インデックス番号
     */
    static getIndex(stepName) {
        const mappings = this.calculateAllMappings();
        const index = mappings[stepName];
        
        if (index === undefined) {
            console.warn(`StepMapper: 未定義のステップ名 '${stepName}'`);
            return null;
        }
        
        return index;
    }
    
    /**
     * インデックス番号から論理名を取得（逆引き）
     * @param {number} index - インデックス番号
     * @returns {string|null} 論理名
     */
    static getName(index) {
        const mappings = this.calculateAllMappings();
        
        for (const [name, idx] of Object.entries(mappings)) {
            if (idx === index) return name;
        }
        
        console.warn(`StepMapper: インデックス ${index} に対応するステップが見つかりません`);
        return null;
    }
    
    /**
     * フッターステップのインデックスを取得
     * @returns {number} フッターステップのインデックス
     */
    static getFooterStepIndex() {
        return this.getIndex('footer');
    }
    
    /**
     * 都市エピソードの範囲を取得
     * @returns {Object} {start, end, count}
     */
    static getCityStepsRange() {
        const mappings = this.calculateAllMappings();
        return {
            start: mappings['city-episodes-start'],
            end: mappings['city-episodes-end'],
            intro: mappings['city-episodes-intro'],
            count: mappings['city-episodes-count']
        };
    }
    
    /**
     * 特定の都市エピソードのインデックスを取得
     * @param {number} cityIndex - 都市インデックス（0ベース）
     * @returns {number|null} ステップインデックス
     */
    static getCityStepIndex(cityIndex) {
        return this.getIndex(`city-episodes-${cityIndex}`);
    }
    
    /**
     * 指定されたインデックスが都市エピソード範囲内かチェック
     * @param {number} stepIndex - チェックするステップインデックス
     * @returns {boolean} 都市エピソード範囲内かどうか
     */
    static isCityStep(stepIndex) {
        const range = this.getCityStepsRange();
        return stepIndex >= range.start && stepIndex <= range.end;
    }
    
    /**
     * 全マッピング情報をデバッグ出力
     */
    static debugPrintMappings() {
        const mappings = this.calculateAllMappings();
        console.group('StepMapper: 全マッピング情報');
        
        // 論理名でソート
        const sorted = Object.entries(mappings).sort(([,a], [,b]) => a - b);
        
        for (const [name, index] of sorted) {
            const definition = window.STEP_DEFINITIONS[name.split('-')[0]];
            const desc = definition?.description || '説明なし';
            console.log(`${index.toString().padStart(2)}: ${name.padEnd(25)} - ${desc}`);
        }
        
        console.groupEnd();
        
        // 特別な情報
        console.log('特別な参照:');
        console.log('  フッターステップ:', this.getFooterStepIndex());
        console.log('  都市エピソード範囲:', this.getCityStepsRange());
    }
    
    /**
     * 設定の妥当性をチェック
     * @returns {boolean} 設定が正常かどうか
     */
    static validateConfiguration() {
        const errors = [];
        
        try {
            const mappings = this.calculateAllMappings();
            
            // 必須ステップの存在確認
            if (this.getIndex('opening') === null) {
                errors.push('openingステップが定義されていません');
            }
            
            if (this.getIndex('footer') === null) {
                errors.push('footerステップが定義されていません');
            }
            
            // 都市エピソードの設定確認
            const cityRange = this.getCityStepsRange();
            if (cityRange.start === undefined || cityRange.end === undefined) {
                errors.push('都市エピソードの範囲が正しく設定されていません');
            }
            
            // インデックスの連続性確認
            const indices = Object.values(mappings).filter(idx => typeof idx === 'number').sort((a, b) => a - b);
            for (let i = 0; i < indices.length - 1; i++) {
                if (indices[i + 1] - indices[i] !== 1) {
                    errors.push(`インデックス ${indices[i]} と ${indices[i + 1]} の間に欠番があります`);
                }
            }
            
        } catch (error) {
            errors.push(`マッピング計算中にエラー: ${error.message}`);
        }
        
        if (errors.length > 0) {
            console.error('StepMapper設定エラー:', errors);
            return false;
        }
        
        return true;
    }
};

/**
 * デバッグモード設定
 * trueにすると詳細なログが出力されます
 */
window.DEBUG_STEP_MAPPER = false;

/**
 * ページ読み込み完了時の初期化
 */
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // 設定検証（開発時のみ）
        if (window.location.hostname === 'localhost' || window.DEBUG_STEP_MAPPER) {
            window.StepMapper.validateConfiguration();
        }
    });
}