/**
 * L10nRenderer - アプリケーション全体のテキスト翻訳を管理するクラス
 * 
 * このクラスは以下の機能を提供します：
 * 1. データベースとメモリキャッシュを使用した効率的な翻訳の取得
 * 2. 一括翻訳取得による効率化
 * 3. EJSテンプレート用の翻訳ヘルパー関数
 */

class L10nRenderer {
    modelManager = undefined;
    translations = {}; // キャッシュされた翻訳データ
    defaultLang = 'ja'; // デフォルト言語

    /**
     * L10nRendererのコンストラクタ
     * @param {object} modelManager - データベースモデルマネージャー
     * @param {object} [translations={}] - 事前ロードされた翻訳データ（オプション）
     * @param {string} [defaultLang='ja'] - デフォルト言語（オプション）
     */
    constructor(modelManager, translations = {}, defaultLang = 'ja') {
        this.modelManager = modelManager;
        this.translations = translations;
        this.defaultLang = defaultLang;
    }

    /**
     * 利用可能な言語リストを取得
     * @returns {Promise<string[]>} 言語コードのリスト
     */
    async getAvailableLanguages() {
        try {
            const l10nTable = await this.modelManager.getModel('l10n');
            const result = await l10nTable.knex('l10n')
                .distinct('lang')
                .where({ deleted_at: null });
            
            return result.map(item => item.lang);
        } catch (error) {
            console.error('言語リスト取得エラー:', error);
            return [this.defaultLang]; // エラー時はデフォルト言語のみ返す
        }
    }

    /**
     * ユーザーが使用する言語を取得する
     * @param {Object} req リクエストオブジェクト
     * @returns {string} 言語コード
     */
    getUserLanguage(req) {
        // 優先順位: 1.クエリパラメータ 2.クッキー 3.Accept-Language 4.デフォルト
        if (req.query && req.query.lang) {
            return req.query.lang;
        }
        
        if (req.cookies && req.cookies.preferredLanguage) {
            return req.cookies.preferredLanguage;
        }
        
        if (req.headers && req.headers['accept-language']) {
            // Accept-Language ヘッダーをパース（例: ja,en-US;q=0.9,en;q=0.8）
            const acceptLanguage = req.headers['accept-language'];
            const languages = acceptLanguage.split(',');
            if (languages.length > 0) {
                // 最初の言語タグを取得（q値が最も高い）
                let primaryLang = languages[0].split(';')[0].trim();
                // 地域サブタグがある場合は除去（例: en-US → en）
                if (primaryLang.includes('-')) {
                    primaryLang = primaryLang.split('-')[0];
                }
                return primaryLang;
            }
        }
        
        return this.defaultLang;
    }

    /**
     * 翻訳テキストをメモリキャッシュから取得（同期的）
     * @param {string} src 翻訳前のテキスト
     * @param {string} lang 言語コード
     * @returns {string} 翻訳後のテキスト（キャッシュになければ元のテキスト）
     */
    getTranslation(src, lang = this.defaultLang) {
        // 指定された言語の翻訳データが存在するか確認
        if (this.translations && this.translations[lang] && this.translations[lang][src]) {
            return this.translations[lang][src];
        }
        
        // 指定言語の翻訳がない場合、デフォルト言語で試す
        if (lang !== this.defaultLang && 
            this.translations && 
            this.translations[this.defaultLang] && 
            this.translations[this.defaultLang][src]) {
            return this.translations[this.defaultLang][src];
        }
        
        // 翻訳が見つからない場合は元のテキストを返す
        return src;
    }

    /**
     * 翻訳テキストを取得（非同期）
     * キャッシュになければDBから取得
     * @param {string} src 翻訳前のテキスト
     * @param {string} lang 言語コード
     * @returns {Promise<string>} 翻訳後のテキスト
     */
    async getL10n(src, lang = this.defaultLang) {
        // 空文字列や未定義の場合はそのまま返す
        if (!src) return src;
        
        // まずキャッシュを確認（同期的）
        const cachedTranslation = this.getTranslation(src, lang);
        if (cachedTranslation !== src) {
            return cachedTranslation;
        }
        
        // キャッシュにない場合はDBから取得（非同期）
        try {
            const l10nTable = await this.modelManager.getModel('l10n');
            const result = await l10nTable.get({ src: src, lang: lang });
            
            if (result && result.length > 0) {
                // 取得した翻訳をキャッシュに追加
                if (!this.translations[lang]) {
                    this.translations[lang] = {};
                }
                this.translations[lang][src] = result[0].dst;
                
                return result[0].dst;
            }
            
            // 指定言語で見つからなかった場合、デフォルト言語で試す
            if (lang !== this.defaultLang) {
                const defaultResult = await l10nTable.get({ src: src, lang: this.defaultLang });
                if (defaultResult && defaultResult.length > 0) {
                    // デフォルト言語の翻訳をキャッシュに追加
                    if (!this.translations[this.defaultLang]) {
                        this.translations[this.defaultLang] = {};
                    }
                    this.translations[this.defaultLang][src] = defaultResult[0].dst;
                    
                    return defaultResult[0].dst;
                }
            }
            
            return src; // 翻訳が見つからない場合は元のテキスト
        } catch (error) {
            console.error('翻訳取得エラー:', error);
            return src; // エラー時は元のテキスト
        }
    }
    
    /**
     * 複数の翻訳テキストを一括取得
     * パフォーマンス向上のため、一度のDBアクセスで複数の翻訳を取得
     * @param {string[]} srcTexts 翻訳前のテキスト配列
     * @param {string} lang 言語コード
     * @returns {Promise<Object>} キー:元テキスト、値:翻訳テキストのオブジェクト
     */
    async getL10nBatch(srcTexts, lang = this.defaultLang) {
        // 空の配列やnullの場合は空のオブジェクトを返す
        if (!srcTexts || !Array.isArray(srcTexts) || srcTexts.length === 0) {
            return {};
        }
        
        try {
            const translations = {};
            const missingTranslations = [];
            
            // まずキャッシュから取得
            srcTexts.forEach(src => {
                if (!src) {
                    translations[src] = src;
                    return;
                }
                
                const cached = this.getTranslation(src, lang);
                if (cached !== src) {
                    // キャッシュに存在
                    translations[src] = cached;
                } else {
                    // キャッシュになし
                    translations[src] = src; // デフォルト値を設定
                    missingTranslations.push(src);
                }
            });
            
            // キャッシュにないものがあればDBから一括取得
            if (missingTranslations.length > 0) {
                const l10nTable = await this.modelManager.getModel('l10n');
                
                // whereIn を使用して一括取得（配列フィルタリングの問題を回避）
                const validSources = missingTranslations.filter(src => src !== undefined && src !== null);
                if (validSources.length > 0) {
                    const results = await l10nTable.get({
                        src: validSources,
                        lang: lang
                    });
                    
                    // 結果をキャッシュに追加し、返却オブジェクトに設定
                    if (results && results.length > 0) {
                        // 言語キャッシュがなければ初期化
                        if (!this.translations[lang]) {
                            this.translations[lang] = {};
                        }
                        
                        results.forEach(result => {
                            this.translations[lang][result.src] = result.dst;
                            translations[result.src] = result.dst;
                        });
                    }
                    
                    // デフォルト言語と異なる場合、未翻訳のものをデフォルト言語で再試行
                    if (lang !== this.defaultLang) {
                        // まだ未翻訳のソーステキストを特定
                        const stillMissing = validSources.filter(src => 
                            !results.some(r => r.src === src)
                        );
                        
                        if (stillMissing.length > 0) {
                            const defaultResults = await l10nTable.get({
                                src: stillMissing,
                                lang: this.defaultLang
                            });
                            
                            if (defaultResults && defaultResults.length > 0) {
                                // デフォルト言語のキャッシュがなければ初期化
                                if (!this.translations[this.defaultLang]) {
                                    this.translations[this.defaultLang] = {};
                                }
                                
                                defaultResults.forEach(result => {
                                    this.translations[this.defaultLang][result.src] = result.dst;
                                    translations[result.src] = result.dst;
                                });
                            }
                        }
                    }
                }
            }
            
            return translations;
        } catch (error) {
            console.error('一括翻訳取得エラー:', error);
            // エラー時はオリジナルのテキストでオブジェクトを返す
            const fallbackTranslations = {};
            srcTexts.forEach(src => {
                fallbackTranslations[src] = src;
            });
            return fallbackTranslations;
        }
    }

    /**
     * 新しい翻訳をDBに追加
     * @param {string} src 翻訳元テキスト
     * @param {string} dst 翻訳先テキスト
     * @param {string} lang 言語コード
     * @returns {Promise<object>} 追加結果
     */
    async addTranslation(src, dst, lang = this.defaultLang) {
        try {
            const l10nTable = await this.modelManager.getModel('l10n');
            // 既存エントリの確認
            const existing = await l10nTable.get({ src: src, lang: lang });
            
            if (existing && existing.length > 0) {
                // 既存エントリの更新
                await l10nTable.post({
                    l10n_id: existing[0].l10n_id,
                    dst: dst,
                    updated_at: new Date()
                });
            } else {
                // 新規エントリの追加
                await l10nTable.put({
                    src: src,
                    dst: dst,
                    lang: lang
                });
            }
            
            // キャッシュの更新
            if (!this.translations[lang]) {
                this.translations[lang] = {};
            }
            this.translations[lang][src] = dst;
            
            return { success: true, message: '翻訳が正常に保存されました' };
        } catch (error) {
            console.error('翻訳保存エラー:', error);
            return { success: false, message: `翻訳の保存に失敗しました: ${error.message}` };
        }
    }

    /**
     * EJSテンプレート用に最適化された翻訳ヘルパー関数を含むオブジェクトを取得
     * @returns {object} 翻訳ヘルパー関数を含むオブジェクト
     */
    getTemplateHelpers() {
        return {
            // 同期的に翻訳を取得（キャッシュのみ使用）
            t: (text, lang = this.defaultLang) => this.getTranslation(text, lang),
            
            // 非同期翻訳関数（EJSテンプレート内での使用は注意が必要）
            // 最初はキャッシュを確認し、なければDBにアクセス
            tAsync: async (text, lang = this.defaultLang) => await this.getL10n(text, lang)
        };
    }

    /**
     * データベースから全ての翻訳をロードしてキャッシュに保存
     * アプリケーション起動時のプリロードに使用
     * @param {string} [lang] 特定の言語のみロードする場合は指定（省略時は全言語）
     * @returns {Promise<number>} ロードされた翻訳の数
     */
    async preloadTranslations(lang = null) {
        try {
            const l10nTable = await this.modelManager.getModel('l10n');
            let query = { deleted_at: null };
            
            if (lang) {
                query.lang = lang;
            }
            
            const allTranslations = await l10nTable.get(query);
            let count = 0;
            
            allTranslations.forEach(translation => {
                if (!this.translations[translation.lang]) {
                    this.translations[translation.lang] = {};
                }
                this.translations[translation.lang][translation.src] = translation.dst;
                count++;
            });
            
            console.log(`${count}件の翻訳をキャッシュにプリロードしました。${lang ? `言語: ${lang}` : '全言語'}`);
            return count;
        } catch (error) {
            console.error('翻訳プリロードエラー:', error);
            return 0;
        }
    }

    /**
     * アプリケーション全体で使用するミドルウェア関数を返す
     * Express.jsアプリケーションで使用
     * @returns {Function} Express.jsミドルウェア関数
     */
    getMiddleware() {
        return (req, res, next) => {
            // リクエストからユーザー言語を検出
            const userLang = this.getUserLanguage(req);
            
            // リクエストオブジェクトに翻訳ヘルパーを追加
            req.L10n = {
                lang: userLang,
                t: (text) => this.getTranslation(text, userLang),
                tAsync: async (text) => await this.getL10n(text, userLang),
                getBatch: async (textArray) => await this.getL10nBatch(textArray, userLang)
            };
            
            // レスポンスのローカルスコープにも同じヘルパーを追加（テンプレート用）
            res.locals.L10n = req.L10n;
            
            next();
        };
    }
}

export default L10nRenderer;