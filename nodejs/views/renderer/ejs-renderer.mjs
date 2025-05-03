import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import { resolve } from 'path';

dotenv.config();

class EjsRenderer {
    restUtil = undefined;
    modelManager = undefined;
    pageRouter = undefined;
    translations = undefined; // 翻訳データ保持用
    defaultLang = 'ja';      // デフォルト言語

    constructor(restUtil, modelManager, translations = {}) {
        this.restUtil = restUtil;
        this.modelManager = modelManager;
        this.translations = translations; // 初期化時に翻訳データを受け取る
        this.pageRouter = express.Router();
    }

    /**
     * ユーザーが使用する言語を取得する
     * @param {Object} req リクエストオブジェクト
     * @returns {string} 言語コード（デフォルトは'ja'）
     */
    getUserLanguage(req) {
        // ヘッダー、クッキー、またはユーザー設定から言語を取得する
        // 現時点では単純にデフォルト言語を返す
        return this.defaultLang;
    }

    /**
     * キャッシュされた翻訳データから翻訳を取得する（高速）
     * @param {string} src 翻訳前のテキスト
     * @param {string} lang 言語コード
     * @returns {string} 翻訳後のテキスト
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
     * 多言語テキストを取得する
     * 翻訳キャッシュになければDBから取得を試みる
     * @param {string} src 翻訳前のテキスト
     * @param {string} lang 言語コード（デフォルトは'ja'）
     * @returns {Promise<string>} 翻訳後のテキスト
     */
    async getL10n(src, lang = this.defaultLang) {
        // まずキャッシュを確認
        const cachedTranslation = this.getTranslation(src, lang);
        if (cachedTranslation !== src) {
            return cachedTranslation;
        }
        
        // キャッシュにない場合はDBから取得
        try {
            const l10nTable = await this.modelManager.getModel('l10n');
            const result = await l10nTable.get({ src: src, lang: lang });
            if (result && result.length > 0) {
                // 取得した翻訳をキャッシュに追加（将来の使用のため）
                if (!this.translations[lang]) {
                    this.translations[lang] = {};
                }
                this.translations[lang][src] = result[0].dst;
                
                return result[0].dst;
            }
            return src; // 翻訳が見つからない場合は元のテキストを返す
        } catch (error) {
            console.error('L10n error:', error);
            return src; // エラーが発生した場合は元のテキストを返す
        }
    }
    
    /**
     * 複数の翻訳テキストを一度に取得する
     * キャッシュになければDBから一括取得を試みる
     * @param {string[]} srcTexts - 翻訳前のテキスト配列
     * @param {string} lang - 言語コード
     * @returns {Promise<Object>} - キーがsrc、値がdstの翻訳マップ
     */
    async getL10nBatch(srcTexts, lang = this.defaultLang) {
        try {
            const translations = {};
            const missingTranslations = [];
            
            // まずキャッシュから取得できるものを集める
            srcTexts.forEach(src => {
                const cached = this.getTranslation(src, lang);
                if (cached !== src) {
                    // キャッシュにあった
                    translations[src] = cached;
                } else {
                    // キャッシュになかった
                    translations[src] = src; // デフォルト値を設定
                    missingTranslations.push(src); // DBから取得すべきリスト
                }
            });
            
            // キャッシュになかったものがある場合、DBから取得
            if (missingTranslations.length > 0) {
                const l10nTable = await this.modelManager.getModel('l10n');
                // 個別に取得
                for (const src of missingTranslations) {
                    const result = await l10nTable.get({ src: src, lang: lang });
                    if (result && result.length > 0) {
                        translations[src] = result[0].dst;
                        
                        // キャッシュに追加
                        if (!this.translations[lang]) {
                            this.translations[lang] = {};
                        }
                        this.translations[lang][src] = result[0].dst;
                    }
                }
            }
            
            return translations;
        } catch (error) {
            console.error('L10n batch error:', error);
            // エラー時はオリジナルのテキストをそのまま返す
            const translations = {};
            srcTexts.forEach(src => {
                translations[src] = src;
            });
            return translations;
        }
    }

    /**
     * ページをレンダリングする
     * @param {*} req
     * @param {*} res
     * @returns {Promise<object>} レンダリング結果
     */
    async render(req, res, pageEjs = 'views/page/page.ejs') {
        let path = req.params[0] || ''; // パスがない場合は空文字列を使用
        const nameParts = path.split('/');
        const queryParams = {
            path: nameParts,
            query: req.query
        };

        let ejsParameters = {
            application_name: req.application_name ? req.application_name : 'system',
            basePath: process.env.BASE_PATH ? process.env.BASE_PATH : '',
            path: nameParts,
            params: queryParams,
            pageTitle: 'Page Title',
            startButton: '',
            topBar: '',
            sidebarPanel: '',
            centerPanel: '',
            footer: '',
            websocket: '',
            modifyCss: ''
        };

        // 各部品をレンダリング
        let startButtonHtml = await this.renderHtml('views/controls/startButton/startButton.ejs', ejsParameters);
        let topBarHtml = await this.renderHtml('views/controls/topBar/topBar.ejs', ejsParameters);
        let footerHtml = await this.renderHtml('views/controls/footBar/footBar.ejs', ejsParameters);
        let centerPanelHtml = await this.renderHtml('views/controls/centerPanel/centerPanel.ejs', ejsParameters);
        let websocketHtml = await this.renderHtml('views/controls/websocket/websocket.ejs', ejsParameters);
        let modifyCssHtml = await this.renderHtml('views/page/modifyCss.ejs', ejsParameters);

        ejsParameters.topBar = topBarHtml.body;
        ejsParameters.startButton = startButtonHtml.body;
        ejsParameters.footer = footerHtml.body;
        ejsParameters.centerPanel = centerPanelHtml.body;
        ejsParameters.websocket = websocketHtml.body;
        ejsParameters.modifyCss = modifyCssHtml.body;

        // 公開ページの場合はシステムのサイドパネルを表示しない
        if (req.application_protection !== 'public') {
            let sidePanelHtml = await this.renderSidePanel(req, res, ejsParameters);
            ejsParameters.sidebarPanel = sidePanelHtml.body;
        }

        let renderResult = await this.renderHtml(pageEjs, ejsParameters); // 絶対パスを指定
        return renderResult;
    }

    /**
     * サイドパネルをレンダリングする
     * @param {*} req
     * @param {*} res
     * @param {*} ejsParameters
     * @returns {Promise<object>} レンダリング結果
     */
    async renderSidePanel(req, res, ejsParameters) {
        // パラメータの取得
        let pathNode = [];
        if (req.path.length > 0) {
            pathNode = req.path.split('/');
        }
        let param1 = pathNode[1] || '';
        let param2 = pathNode[2] || '';

        let verifyResult = await this.restUtil.verifyToken(req, res);
        if (!verifyResult.auth) {
            let currentUrl = req.originalUrl;
            let redirectUrl = '/login?redirect=' + currentUrl;
            console.log('redirectUrl:', redirectUrl);
            res.redirect(redirectUrl);
            return { status: 401, body: '' };
        }

        let user = verifyResult.user;
        let userDomainLinkTable = await this.modelManager.getModel('user_domain_link');
        let userDomainLink = await userDomainLinkTable.get({ user_id: user.user_id });
        let userDomainId = userDomainLink[0].user_domain_id;

        let userDomainTable = await this.modelManager.getModel('user_domain');
        let userDomain = await userDomainTable.get({ user_domain_id: userDomainId });
        if (userDomain.length === 0) {
            return res.status(404).send('Not Found');
        }
        let userDomainName = userDomain[0].domain_name;

        let sidePanelRenderResult = {};
        let renderResult = { status: 200, body: '' };

        let paneParameter = {
            sidePanelTitle: userDomainName,
            appendButtonVisible: false,
            user: user,
            basePath: ejsParameters.basePath
        };
        sidePanelRenderResult = await this.renderHtml('views/controls/sidePanel/sideMainPanel.ejs', paneParameter);
        if (sidePanelRenderResult.status > 200) {
            renderResult.status = sidePanelRenderResult.status;
            renderResult.body += sidePanelRenderResult.message;
        } else {
            renderResult.body += sidePanelRenderResult.body;
        }

        if (param2 !== '') {
            let subMenuRenderResult = await this.renderSideSubPanel(user, param2, ejsParameters);
            if (subMenuRenderResult.status > 200) {
                renderResult.status = subMenuRenderResult.status;
                renderResult.body += subMenuRenderResult.message;
            } else {
                renderResult.body += subMenuRenderResult.body;
            }
        }

        return renderResult;
    }

    async renderSideSubPanel(user, path, ejsParameters) {
        let sidePanelRenderResult = { status: 200, body: '' };

        let list = [];
        switch (path) {
            case 'table':
                list = await this.getTables(user.user_domain_id);
                break;
            case 'query':
                break;
            case 'script':
                break;
            default:
                break;
        }

        let paneParameter = { sidePanelTitle: path, appendButtonVisible: false, user: user, list: list };
        sidePanelRenderResult = await this.renderHtml('views/controls/sidePanel/sideSubPanel.ejs', paneParameter);

        if (sidePanelRenderResult.status > 200) {
            sidePanelRenderResult.status = sidePanelRenderResult.status;
            sidePanelRenderResult.body = sidePanelRenderResult.message;
        } else {
            sidePanelRenderResult.body = sidePanelRenderResult.body;
        }
        return sidePanelRenderResult;
    }

    async getTables(userDomainId) {
        let tableList = this.modelManager.models;
        if (userDomainId > 1) {
            tableList = tableList.filter((table) => table.user_domain_id === userDomainId);
        }
        // テーブルの名前でソート
        tableList.sort((a, b) => {
            if (a.tableDefinition.table_name < b.tableDefinition.table_name) {
                return -1;
            }
            if (a.tableDefinition.table_name > b.tableDefinition.table_name) {
                return 1;
            }
            return 0;
        });

        return tableList;
    }

    /**
     * HTMLをレンダリングする
     * @param {string} ejsPath
     * @param {object} ejsParameters
     * @returns {Promise<object>} レンダリング結果
     */
    async renderHtml(ejsPath, ejsParameters) {
        const templatePath = resolve(ejsPath); // 絶対パスを指定

        // オブジェクトの複製を作成して元のパラメータを変更しない
        const params = { ...ejsParameters };

        // getL10n関数をテンプレート内で安全に使えるようにする
        // 重要: EJSテンプレート内のasyncブロックで使われると[object Promise]になるのを防ぐ
        params.getL10n = async (text, lang = this.defaultLang) => {
            // 既にキャッシュにある場合は同期的に返す
            const cachedTranslation = this.getTranslation(text, lang);
            if (cachedTranslation !== text) {
                return cachedTranslation;
            }
            // キャッシュになければ非同期で取得
            try {
                const l10nTable = await this.modelManager.getModel('l10n');
                const result = await l10nTable.get({ src: text, lang: lang });
                if (result && result.length > 0) {
                    // キャッシュに追加
                    if (!this.translations[lang]) {
                        this.translations[lang] = {};
                    }
                    this.translations[lang][text] = result[0].dst;
                    return result[0].dst;
                }
                return text;
            } catch (error) {
                console.error('L10n error:', error);
                return text;
            }
        };

        let renderResult = {};

        try {
            // 同期処理を優先してasync: falseにして処理
            // これにより[object Promise]の問題を回避する
            let str;
            try {
                console.log(`${ejsPath}のレンダリングを開始...`);
                str = await ejs.renderFile(templatePath, params, {
                    async: false,
                    cache: false,
                    rmWhitespace: true,
                    compileDebug: true
                });
            } catch (ejsErr) {
                // もし同期モードで失敗した場合、非同期モードを試す
                console.warn(`${ejsPath}の同期レンダリングに失敗、非同期モードを試みます:`, ejsErr);
                str = await ejs.renderFile(templatePath, params, {
                    async: true,
                    cache: false,
                    rmWhitespace: true,
                    compileDebug: true
                });
            }
            
            renderResult.status = 200;
            
            // 必ず文字列型であることを保証
            if (typeof str === 'string') {
                renderResult.body = str;
            } else if (str && typeof str.then === 'function') {
                // まだPromiseであれば解決する
                console.warn(`${ejsPath}の結果がまだPromiseです。解決します...`);
                try {
                    renderResult.body = await str;
                } catch (promiseErr) {
                    console.error(`${ejsPath}のPromise解決エラー:`, promiseErr);
                    renderResult.body = `<div class="error">Promiseの解決に失敗しました: ${promiseErr.message}</div>`;
                }
            } else if (str && str.toString) {
                renderResult.body = str.toString();
                console.warn(`${ejsPath}のレンダリング結果が文字列ではありません。toString()で変換しました。`);
            } else {
                console.error(`${ejsPath}のレンダリング結果が無効です。空の文字列を使用します。`);
                renderResult.body = '';
            }
            
            // 最終確認 - bodyが文字列かを確認
            if (typeof renderResult.body !== 'string') {
                console.error(`最終チェック: ${ejsPath}のbodyがまだ文字列ではありません:`, typeof renderResult.body);
                renderResult.body = String(renderResult.body || '');
            }
            
            console.log(`${ejsPath}のレンダリング完了`);
        } catch (err) {
            console.error(`${ejsPath}のレンダリングエラー:`, err);
            renderResult.status = 500;
            renderResult.message = err.message;
            renderResult.body = `<div class="error">レンダリングエラー: ${err.message}</div>`;
        }

        return renderResult;
    }
}

export default EjsRenderer;
