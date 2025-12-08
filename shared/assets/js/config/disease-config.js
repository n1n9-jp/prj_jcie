/**
 * Disease Configuration - 感染症別設定管理
 * 各感染症の固有設定とテーマを定義
 */
export const DISEASE_CONFIG = {
    'aids': {
        id: 'aids',
        name: 'HIV/エイズとの闘い',
        nameEn: 'Fighting HIV/AIDS',
        subtitle: '～データで見る希望と課題～',
        color: {
            primary: '#ff6b6b',
            secondary: '#ff8e8e',
            accent: '#e85555'
        },
        navigation: {
            current: 'エイズ',
            others: [
                { name: '結核', path: '../02_tuberculosis/' },
                { name: 'マラリア', path: '../03_malariae/' }
            ]
        },
        paths: {
            base: '',  // 01_aids/からの相対パス
            config: 'config/',
            data: 'data/',
            assets: 'assets/',
            images: 'assets/images/'
        }
    },
    'tuberculosis': {
        id: 'tuberculosis',
        name: '結核との闘い',
        nameEn: 'Fighting Tuberculosis',
        subtitle: '～データで見る希望と課題～',
        color: {
            primary: '#4ecdc4',
            secondary: '#6fd4cc',
            accent: '#3bb8b0'
        },
        navigation: {
            current: '結核',
            others: [
                { name: 'エイズ', path: '../01_aids/' },
                { name: 'マラリア', path: '../03_malariae/' }
            ]
        },
        paths: {
            base: '',  // 02_tuberculosis/からの相対パス
            config: 'config/',
            data: 'data/',
            assets: 'assets/',
            images: 'assets/images/'
        }
    },
    'malariae': {
        id: 'malariae',
        name: 'マラリアとの闘い',
        nameEn: 'Fighting Malaria',
        subtitle: '～データで見る希望と課題～',
        color: {
            primary: '#f4a620',
            secondary: '#f6b84a',
            accent: '#e89813'
        },
        navigation: {
            current: 'マラリア',
            others: [
                { name: 'エイズ', path: '../01_aids/' },
                { name: '結核', path: '../02_tuberculosis/' }
            ]
        },
        paths: {
            base: '',  // 03_malariae/からの相対パス
            config: 'config/',
            data: 'data/',
            assets: 'assets/',
            images: 'assets/images/'
        }
    },
    'top': {
        id: 'top',
        name: '感染症との闘い',
        nameEn: 'Fighting Infectious Diseases',
        subtitle: '～データで見る希望と課題～',
        color: {
            primary: '#6b7280',
            secondary: '#9ca3af',
            accent: '#4b5563'
        },
        navigation: {
            current: null,
            others: []
        },
        paths: {
            base: '',
            config: 'shared/config/',
            data: '',
            assets: 'shared/assets/',
            images: 'shared/assets/images/'
        }
    }
};
