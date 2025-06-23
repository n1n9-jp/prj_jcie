/**
 * UN統計区分に基づく国から地域へのマッピング
 * HIV/エイズ対策の地域分類に合わせて調整
 */
class CountryRegionMapping {
    constructor() {
        // UN統計区分をベースに、HIV/エイズ対策の地域分類に合わせたマッピング
        this.countryToRegion = {
            // アジア・太平洋地域
            'Afghanistan': 'アジア・太平洋地域',
            'Bangladesh': 'アジア・太平洋地域',
            'Bhutan': 'アジア・太平洋地域',
            'Brunei': 'アジア・太平洋地域',
            'Cambodia': 'アジア・太平洋地域',
            'China': 'アジア・太平洋地域',
            'North Korea': 'アジア・太平洋地域',
            'Fiji': 'アジア・太平洋地域',
            'India': 'アジア・太平洋地域',
            'Indonesia': 'アジア・太平洋地域',
            'Iran': 'アジア・太平洋地域',
            'Japan': 'アジア・太平洋地域',
            'Laos': 'アジア・太平洋地域',
            'Malaysia': 'アジア・太平洋地域',
            'Maldives': 'アジア・太平洋地域',
            'Mongolia': 'アジア・太平洋地域',
            'Myanmar': 'アジア・太平洋地域',
            'Nepal': 'アジア・太平洋地域',
            'Pakistan': 'アジア・太平洋地域',
            'Papua New Guinea': 'アジア・太平洋地域',
            'Philippines': 'アジア・太平洋地域',
            'Singapore': 'アジア・太平洋地域',
            'South Korea': 'アジア・太平洋地域',
            'Sri Lanka': 'アジア・太平洋地域',
            'Thailand': 'アジア・太平洋地域',
            'Timor-Leste': 'アジア・太平洋地域',
            'Vietnam': 'アジア・太平洋地域',
            'Australia': 'アジア・太平洋地域',
            'New Zealand': 'アジア・太平洋地域',
            'Solomon Islands': 'アジア・太平洋地域',
            'Vanuatu': 'アジア・太平洋地域',
            'Samoa': 'アジア・太平洋地域',
            'Tonga': 'アジア・太平洋地域',
            'Micronesia': 'アジア・太平洋地域',
            'Marshall Islands': 'アジア・太平洋地域',
            'Palau': 'アジア・太平洋地域',
            'Kiribati': 'アジア・太平洋地域',
            'Nauru': 'アジア・太平洋地域',
            'Tuvalu': 'アジア・太平洋地域',
            'Taiwan': 'アジア・太平洋地域',
            'New Caledonia': 'アジア・太平洋地域',
            
            // カリブ海地域
            'Antigua and Barbuda': 'カリブ海地域',
            'Bahamas': 'カリブ海地域',
            'Barbados': 'カリブ海地域',
            'Cuba': 'カリブ海地域',
            'Dominica': 'カリブ海地域',
            'Dominican Republic': 'カリブ海地域',
            'Grenada': 'カリブ海地域',
            'Haiti': 'カリブ海地域',
            'Jamaica': 'カリブ海地域',
            'Saint Kitts and Nevis': 'カリブ海地域',
            'Saint Lucia': 'カリブ海地域',
            'Saint Vincent and the Grenadines': 'カリブ海地域',
            'Trinidad and Tobago': 'カリブ海地域',
            
            // 東部・南部アフリカ
            'Angola': '東部・南部アフリカ',
            'Botswana': '東部・南部アフリカ',
            'Burundi': '東部・南部アフリカ',
            'Comoros': '東部・南部アフリカ',
            'Djibouti': '東部・南部アフリカ',
            'Eritrea': '東部・南部アフリカ',
            'Ethiopia': '東部・南部アフリカ',
            'Kenya': '東部・南部アフリカ',
            'Lesotho': '東部・南部アフリカ',
            'Madagascar': '東部・南部アフリカ',
            'Malawi': '東部・南部アフリカ',
            'Mauritius': '東部・南部アフリカ',
            'Mozambique': '東部・南部アフリカ',
            'Namibia': '東部・南部アフリカ',
            'Rwanda': '東部・南部アフリカ',
            'Seychelles': '東部・南部アフリカ',
            'Somalia': '東部・南部アフリカ',
            'South Africa': '東部・南部アフリカ',
            'South Sudan': '東部・南部アフリカ',
            'Eswatini': '東部・南部アフリカ',
            'Tanzania': '東部・南部アフリカ',
            'Uganda': '東部・南部アフリカ',
            'Zambia': '東部・南部アフリカ',
            'Zimbabwe': '東部・南部アフリカ',
            'Somaliland': '東部・南部アフリカ',
            
            // 東ヨーロッパ・中央アジア
            'Albania': '東ヨーロッパ・中央アジア',
            'Armenia': '東ヨーロッパ・中央アジア',
            'Azerbaijan': '東ヨーロッパ・中央アジア',
            'Belarus': '東ヨーロッパ・中央アジア',
            'Bosnia and Herzegovina': '東ヨーロッパ・中央アジア',
            'Bulgaria': '東ヨーロッパ・中央アジア',
            'Croatia': '東ヨーロッパ・中央アジア',
            'Czech Republic': '東ヨーロッパ・中央アジア',
            'Estonia': '東ヨーロッパ・中央アジア',
            'Georgia': '東ヨーロッパ・中央アジア',
            'Hungary': '東ヨーロッパ・中央アジア',
            'Kazakhstan': '東ヨーロッパ・中央アジア',
            'Kosovo': '東ヨーロッパ・中央アジア',
            'Kyrgyzstan': '東ヨーロッパ・中央アジア',
            'Latvia': '東ヨーロッパ・中央アジア',
            'Lithuania': '東ヨーロッパ・中央アジア',
            'Moldova': '東ヨーロッパ・中央アジア',
            'Montenegro': '東ヨーロッパ・中央アジア',
            'North Macedonia': '東ヨーロッパ・中央アジア',
            'Poland': '東ヨーロッパ・中央アジア',
            'Romania': '東ヨーロッパ・中央アジア',
            'Russia': '東ヨーロッパ・中央アジア',
            'Serbia': '東ヨーロッパ・中央アジア',
            'Slovakia': '東ヨーロッパ・中央アジア',
            'Slovenia': '東ヨーロッパ・中央アジア',
            'Tajikistan': '東ヨーロッパ・中央アジア',
            'Turkey': '東ヨーロッパ・中央アジア',
            'Turkmenistan': '東ヨーロッパ・中央アジア',
            'Ukraine': '東ヨーロッパ・中央アジア',
            'Uzbekistan': '東ヨーロッパ・中央アジア',
            
            // 中南米（ラテンアメリカ）
            'Argentina': '中南米（ラテンアメリカ）',
            'Belize': '中南米（ラテンアメリカ）',
            'Bolivia': '中南米（ラテンアメリカ）',
            'Brazil': '中南米（ラテンアメリカ）',
            'Chile': '中南米（ラテンアメリカ）',
            'Colombia': '中南米（ラテンアメリカ）',
            'Costa Rica': '中南米（ラテンアメリカ）',
            'Ecuador': '中南米（ラテンアメリカ）',
            'El Salvador': '中南米（ラテンアメリカ）',
            'Guatemala': '中南米（ラテンアメリカ）',
            'Guyana': '中南米（ラテンアメリカ）',
            'Honduras': '中南米（ラテンアメリカ）',
            'Mexico': '中南米（ラテンアメリカ）',
            'Nicaragua': '中南米（ラテンアメリカ）',
            'Panama': '中南米（ラテンアメリカ）',
            'Paraguay': '中南米（ラテンアメリカ）',
            'Peru': '中南米（ラテンアメリカ）',
            'Suriname': '中南米（ラテンアメリカ）',
            'Uruguay': '中南米（ラテンアメリカ）',
            'Venezuela': '中南米（ラテンアメリカ）',
            'French Guiana': '中南米（ラテンアメリカ）',
            
            // 中東・北アフリカ
            'Algeria': '中東・北アフリカ',
            'Bahrain': '中東・北アフリカ',
            'Egypt': '中東・北アフリカ',
            'Iraq': '中東・北アフリカ',
            'Israel': '中東・北アフリカ',
            'Jordan': '中東・北アフリカ',
            'Kuwait': '中東・北アフリカ',
            'Lebanon': '中東・北アフリカ',
            'Libya': '中東・北アフリカ',
            'Morocco': '中東・北アフリカ',
            'Oman': '中東・北アフリカ',
            'Palestine': '中東・北アフリカ',
            'Qatar': '中東・北アフリカ',
            'Saudi Arabia': '中東・北アフリカ',
            'Sudan': '中東・北アフリカ',
            'S. Sudan': '中東・北アフリカ',
            'Syria': '中東・北アフリカ',
            'Tunisia': '中東・北アフリカ',
            'United Arab Emirates': '中東・北アフリカ',
            'W. Sahara': '中東・北アフリカ',
            'Yemen': '中東・北アフリカ',
            
            // 西部・中部アフリカ
            'Benin': '西部・中部アフリカ',
            'Burkina Faso': '西部・中部アフリカ',
            'Cameroon': '西部・中部アフリカ',
            'Cape Verde': '西部・中部アフリカ',
            'Central African Republic': '西部・中部アフリカ',
            'Chad': '西部・中部アフリカ',
            'Republic of the Congo': '西部・中部アフリカ',
            'Democratic Republic of the Congo': '西部・中部アフリカ',
            'Ivory Coast': '西部・中部アフリカ',
            'Equatorial Guinea': '西部・中部アフリカ',
            'Gabon': '西部・中部アフリカ',
            'Gambia': '西部・中部アフリカ',
            'Ghana': '西部・中部アフリカ',
            'Guinea': '西部・中部アフリカ',
            'Guinea-Bissau': '西部・中部アフリカ',
            'Liberia': '西部・中部アフリカ',
            'Mali': '西部・中部アフリカ',
            'Mauritania': '西部・中部アフリカ',
            'Niger': '西部・中部アフリカ',
            'Nigeria': '西部・中部アフリカ',
            'Sao Tome and Principe': '西部・中部アフリカ',
            'Senegal': '西部・中部アフリカ',
            'Sierra Leone': '西部・中部アフリカ',
            'Togo': '西部・中部アフリカ',
            
            // 西・中央ヨーロッパおよび北米
            'Andorra': '西・中央ヨーロッパおよび北米',
            'Austria': '西・中央ヨーロッパおよび北米',
            'Belgium': '西・中央ヨーロッパおよび北米',
            'Canada': '西・中央ヨーロッパおよび北米',
            'Cyprus': '西・中央ヨーロッパおよび北米',
            'N. Cyprus': '西・中央ヨーロッパおよび北米',
            'Denmark': '西・中央ヨーロッパおよび北米',
            'Finland': '西・中央ヨーロッパおよび北米',
            'France': '西・中央ヨーロッパおよび北米',
            'Germany': '西・中央ヨーロッパおよび北米',
            'Greece': '西・中央ヨーロッパおよび北米',
            'Iceland': '西・中央ヨーロッパおよび北米',
            'Ireland': '西・中央ヨーロッパおよび北米',
            'Italy': '西・中央ヨーロッパおよび北米',
            'Liechtenstein': '西・中央ヨーロッパおよび北米',
            'Luxembourg': '西・中央ヨーロッパおよび北米',
            'Malta': '西・中央ヨーロッパおよび北米',
            'Monaco': '西・中央ヨーロッパおよび北米',
            'Netherlands': '西・中央ヨーロッパおよび北米',
            'Norway': '西・中央ヨーロッパおよび北米',
            'Portugal': '西・中央ヨーロッパおよび北米',
            'San Marino': '西・中央ヨーロッパおよび北米',
            'Spain': '西・中央ヨーロッパおよび北米',
            'Sweden': '西・中央ヨーロッパおよび北米',
            'Switzerland': '西・中央ヨーロッパおよび北米',
            'United Kingdom': '西・中央ヨーロッパおよび北米',
            'United States of America': '西・中央ヨーロッパおよび北米',
            'United States': '西・中央ヨーロッパおよび北米',
            'USA': '西・中央ヨーロッパおよび北米',
            'Vatican City': '西・中央ヨーロッパおよび北米',
            'Falkland Islands': '西・中央ヨーロッパおよび北米',
            'Greenland': '西・中央ヨーロッパおよび北米',
            'Puerto Rico': '西・中央ヨーロッパおよび北米',
            
            // その他・特別地域（南極地域など）
            'Antarctica': 'その他・特別地域',
            'Fr. S. Antarctic Lands': 'その他・特別地域'
        };
        
        // 別名・表記ゆれ対応
        this.countryAliases = {
            'Czechia': 'Czech Republic',
            'Swaziland': 'Eswatini',
            'Macedonia': 'North Macedonia',
            'Congo': 'Republic of the Congo',
            'DR Congo': 'Democratic Republic of the Congo',
            'DRC': 'Democratic Republic of the Congo',
            'Dem. Rep. Congo': 'Democratic Republic of the Congo',
            "Côte d'Ivoire": 'Ivory Coast',
            'Burma': 'Myanmar',
            'East Timor': 'Timor-Leste',
            'Cabo Verde': 'Cape Verde',
            'The Gambia': 'Gambia',
            'The Bahamas': 'Bahamas',
            // 地図データの略称対応
            'Central African Rep.': 'Central African Republic',
            'Bosnia and Herz.': 'Bosnia and Herzegovina',
            'Solomon Is.': 'Solomon Islands',
            'eSwatini': 'Eswatini',
            'Dominican Rep.': 'Dominican Republic',
            'Eq. Guinea': 'Equatorial Guinea',
            'S. Sudan': 'South Sudan',
            // 追加のアフリカ地図データ対応
            'Congo': 'Republic of the Congo',
            'Falkland Is.': 'Falkland Islands',
            'Macedonia': 'North Macedonia',
            'Somaliland': 'Somalia',
            // フランス領ギアナの別表記
            'Guyane': 'French Guiana',
            'Fr. Guiana': 'French Guiana'
        };
    }
    
    /**
     * 国名から地域を取得
     * @param {string} countryName - 国名
     * @returns {string|null} 地域名、見つからない場合はnull
     */
    getRegionForCountry(countryName) {
        // まず直接マッチを試みる
        let region = this.countryToRegion[countryName];
        
        // エイリアスをチェック
        if (!region) {
            const standardName = this.countryAliases[countryName];
            if (standardName) {
                region = this.countryToRegion[standardName];
            }
        }
        
        // それでも見つからない場合は部分一致を試みる
        if (!region) {
            // 国名の一部が含まれているかチェック
            for (const [country, regionName] of Object.entries(this.countryToRegion)) {
                if (countryName.includes(country) || country.includes(countryName)) {
                    region = regionName;
                    break;
                }
            }
        }
        
        return region || null;
    }
    
    /**
     * 地域ごとの国リストを取得
     * @returns {Object} 地域名をキー、国名配列を値とするオブジェクト
     */
    getCountriesByRegion() {
        const regionToCountries = {};
        
        for (const [country, region] of Object.entries(this.countryToRegion)) {
            if (!regionToCountries[region]) {
                regionToCountries[region] = [];
            }
            regionToCountries[region].push(country);
        }
        
        return regionToCountries;
    }
}

// グローバルインスタンスを作成
window.CountryRegionMapping = new CountryRegionMapping();