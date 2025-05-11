// filepath: c:\misc\scripts\sandbox\nodejs\views\renderer\ejs-renderer.mjs
/**
 * EjsRenderer - EJSテンプレートレンダリングと多言語対応を統合したレンダラークラス
 * 
 * このクラスは以下の機能を提供します：
 * 1. L10nRendererを使用した効率的な多言語対応
 * 2. EJSテンプレートのレンダリング機能
 * 3. ページレイアウト全体のレンダリング機能
 */

import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import { resolve } from 'path';
import L10nRenderer from './l10n-renderer.mjs';

dotenv.config();

class EjsRenderer {
    restUtil = undefined;
    modelManager = undefined;
    pageRouter = undefined;
    l10nRenderer = undefined; // 翻訳機能のインスタンス
    defaultLang = 'ja';

    constructor(restUtil, modelManager, translations = {}) {
        this.restUtil = restUtil;
        this.modelManager = modelManager;
        this.pageRouter = express.Router();
        
        // L10nRendererのインスタンスを作成
        this.l10nRenderer = new L10nRenderer(modelManager, translations);

        // ルーティング設定
        this.setupRoutes();
    }

    /**
     * Expressルーターを設定する
     */
    setupRoutes() {
        this.pageRouter.get('/*', async (req, res) => {
            try {
                const renderResult = await this.render(req, res);
                res.status(renderResult.status || 200).send(renderResult.body);
            } catch (error) {
                console.error('ページレンダリングエラー:', error);
                res.status(500).send(`<h1>レンダリングエラー</h1><p>${error.message}</p>`);
            }
        });
    }

    /**
     * ユーザーが使用する言語を取得する
     * @param {Object} req リクエストオブジェクト
     * @returns {string} 言語コード（デフォルトは'ja'）
     */
    getUserLanguage(req) {
        return this.l10nRenderer.getUserLanguage(req);
    }

    /**
     * キャッシュされた翻訳データから翻訳を取得する（高速・同期的）
     * @param {string} src 翻訳前のテキスト
     * @param {string} lang 言語コード
     * @returns {string} 翻訳後のテキスト
     */
    getTranslation(src, lang = this.defaultLang) {
        return this.l10nRenderer.getTranslation(src, lang);
    }

    /**
     * 多言語テキストを取得する（非同期）
     * キャッシュになければDBから取得
     * @param {string} src 翻訳前のテキスト
     * @param {string} lang 言語コード
     * @returns {Promise<string>} 翻訳後のテキスト
     */
    async getL10n(src, lang = this.defaultLang) {
        return await this.l10nRenderer.getL10n(src, lang);
    }
    
    /**
     * 複数の翻訳テキストを一度に効率的に取得する
     * パフォーマンス向上のため、一度のDBアクセスで複数の翻訳を取得
     * @param {string[]} srcTexts - 翻訳前のテキスト配列
     * @param {string} lang - 言語コード
     * @returns {Promise<Object>} - キーがsrc、値がdstの翻訳マップ
     */
    async getL10nBatch(srcTexts, lang = this.defaultLang) {
        return await this.l10nRenderer.getL10nBatch(srcTexts, lang);
    }

    /**
     * ページをレンダリングする
     * @param {*} req - リクエストオブジェクト
     * @param {*} res - レスポンスオブジェクト
     * @param {string} [pageEjs='views/page/page.ejs'] - 使用するEJSテンプレートのパス
     * @returns {Promise<object>} レンダリング結果
     */
    async render(req, res, pageEjs = 'views/page/page.ejs') {
        try {
            let path = req.params[0] || ''; // パスがない場合は空文字列を使用
            const nameParts = path.split('/');
            const queryParams = {
                path: nameParts,
                query: req.query
            };

            console.log('ページのレンダリングを開始します:', path);

            // テーブルパネル用の翻訳を事前取得（パフォーマンス向上）
            const commonTranslations = await this.getL10nBatch([
                'data',
                'definition',
                'REST',
                'Data View',
                'テーブル定義',
                'application',
                'table',
                'クエリ',
                'スクリプト'
            ]);

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
                modifyCss: '',
                commonTranslations, // 翻訳データを追加
                tableTranslations: commonTranslations // 後方互換性のため、tableTranslationsとしても提供
            };

            console.log('各コンポーネントのレンダリングを開始します');

            // 各部品を個別にレンダリング
            const [startButtonHtml, topBarHtml, footerHtml, sidePanelHtml, centerPanelHtml, websocketHtml, modifyCssHtml] = await Promise.all([
                this.renderHtml('views/controls/startButton/startButton.ejs', ejsParameters),
                this.renderHtml('views/controls/topBar/topBar.ejs', ejsParameters),
                this.renderHtml('views/controls/footBar/footBar.ejs', ejsParameters),
                req.application_protection !== 'public' ? this.renderSidePanel(req, res, ejsParameters) : { body: '' },
                this.renderHtml('views/controls/centerPanel/centerPanel.ejs', ejsParameters),
                this.renderHtml('views/controls/websocket/websocket.ejs', ejsParameters),
                this.renderHtml('views/page/modifyCss.ejs', ejsParameters)
            ]);

            // 各部品のHTMLをパラメータに設定
            ejsParameters.topBar = topBarHtml.body || '';
            ejsParameters.startButton = startButtonHtml.body || '';
            ejsParameters.footer = footerHtml.body || '';
            ejsParameters.sidebarPanel = sidePanelHtml.body || '';
            ejsParameters.centerPanel = centerPanelHtml.body || '';
            ejsParameters.websocket = websocketHtml.body || '';
            ejsParameters.modifyCss = modifyCssHtml.body || '';

            // 最終的なページのレンダリング
            console.log('最終ページのレンダリングを開始します');
            const renderResult = await this.renderHtml(pageEjs, ejsParameters);
            console.log('ページのレンダリングが完了しました');
            return renderResult;
        } catch (error) {
            console.error('レンダリングエラー:', error);
            throw error;
        }
    }

    /**
     * センターパネルをレンダリングする
     * @param {string} renderType レンダリングタイプ
     * @param {string} renderTarget レンダリングターゲット
     * @returns {Promise<string>} レンダリング結果（文字列として）
     */
    async renderCenterPanel(renderType, renderTarget) {
        try {
            console.log(`センターパネルのレンダリング: type=${renderType}, target=${renderTarget}`);
            
            // パラメータの設定
            const queryParams = {
                path: [renderType, renderTarget],
                query: {}
            };
            
            // 翻訳を事前取得（一括取得でDBアクセスを最適化）
            const translations = await this.getL10nBatch([
                'data',
                'definition',
                'REST',
                'Data View',
                'テーブル定義',
                'クエリ',
                'SQL',
                '実行',
                '実行結果'
            ]);
            
            // すべての必要なパラメータが含まれていることを確認
            const ejsParameters = {
                application_name: 'system',
                basePath: process.env.BASE_PATH ? process.env.BASE_PATH : '',
                path: [renderType, renderTarget],
                params: queryParams,
                tableTranslations: translations
            };            // レンダリングタイプに応じて適切なパラメータとテンプレートを設定
            let templatePath = 'views/controls/centerPanel/centerPanel.ejs';
            
            if (renderType === 'table') {
                ejsParameters.targetTable = renderTarget;
            } else if (renderType === 'script') {
                ejsParameters.targetScript = renderTarget;
                // targetScriptがnullの場合は一覧表示、それ以外は個別表示
                if (renderTarget !== null) {
                    templatePath = 'views/controls/centerPanel/scriptPanel.ejs';
                }
            } else if (renderType === 'query') {
                ejsParameters.targetQuery = renderTarget;
                // targetQueryがnullの場合は一覧表示、それ以外は個別表示
                if (renderTarget !== null) {
                    templatePath = 'views/controls/centerPanel/queryPanel.ejs';
                }
            } else if (renderType === 'application') {
                ejsParameters.targetApplication = renderTarget;
                // targetApplicationがnullの場合は一覧表示、それ以外は個別表示
                if (renderTarget !== null) {
                    templatePath = 'views/controls/centerPanel/applicationPanel.ejs';
                }
            }
            
            // 対応するパネルをレンダリング
            const panelResult = await this.renderHtml(templatePath, ejsParameters);
            
            // 結果が文字列であることを確認
            if (typeof panelResult === 'object' && panelResult !== null) {
                if (typeof panelResult.body === 'string') {
                    return panelResult.body;
                } else if (panelResult.body) {
                    return String(panelResult.body);
                }
            }
            
            // 有効な結果が得られなかった場合のフォールバック
            console.error('センターパネルのレンダリング結果が無効です:', panelResult);
            return '<div class="error-panel">センターパネルの表示中にエラーが発生しました</div>';
        } catch (error) {
            console.error('センターパネルレンダリングエラー:', error);
            return `<div class="error-panel">センターパネルのレンダリングエラー: ${error.message}</div>`;
        }
    }

    /**
     * サイドパネルをレンダリングする
     * @param {*} req リクエストオブジェクト
     * @param {*} res レスポンスオブジェクト
     * @param {*} ejsParameters EJSパラメータ
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
            return { status: 401, body: '' };
        }

        let user = verifyResult.user;
        let userDomainLinkTable = await this.modelManager.getModel('user_domain_link');
        let userDomainLink = await userDomainLinkTable.get({ user_id: user.user_id });
        let userDomainId = userDomainLink[0].user_domain_id;

        let userDomainTable = await this.modelManager.getModel('user_domain');
        let userDomain = await userDomainTable.get({ user_domain_id: userDomainId });
        if (userDomain.length === 0) {
            return { status: 404, body: '見つかりませんでした' };
        }
        let userDomainName = userDomain[0].domain_name;

        // サイドパネルの翻訳データを事前取得（一括取得でDBアクセスを最適化）
        const sideMenuTranslations = await this.getL10nBatch([
            'application',
            'table',
            'クエリ',
            'スクリプト'
        ]);

        let renderResult = { status: 200, body: '' };

        let paneParameter = {
            sidePanelTitle: userDomainName,
            appendButtonVisible: false,
            user: user,
            basePath: process.env.BASE_PATH ? process.env.BASE_PATH : '',
            translations: sideMenuTranslations  // 翻訳データを直接渡す
        };
        
        const sidePanelRenderResult = await this.renderHtml('views/controls/sidePanel/sideMainPanel.ejs', paneParameter);
        if (sidePanelRenderResult.status > 200) {
            renderResult.status = sidePanelRenderResult.status;
            renderResult.body += sidePanelRenderResult.message || '';
        } else {
            renderResult.body += sidePanelRenderResult.body || '';
        }

        if (param2 !== '') {
            ejsParameters.basePath = process.env.BASE_PATH ? process.env.BASE_PATH : '';
            const subMenuRenderResult = await this.renderSideSubPanel(user, param2, ejsParameters);
            if (subMenuRenderResult.status > 200) {
                renderResult.status = subMenuRenderResult.status;
                renderResult.body += subMenuRenderResult.message || '';
            } else {
                renderResult.body += subMenuRenderResult.body || '';
            }
        }

        return renderResult;
    }

    /**
     * サブサイドパネルをレンダリングする
     * @param {*} user ユーザー情報
     * @param {*} path パス
     * @param {*} ejsParameters EJSパラメータ
     * @returns {Promise<object>} レンダリング結果
     */
    async renderSideSubPanel(user, path, ejsParameters) {
        let list = [];
        switch (path) {
            case 'application':
                list = await this.getApplications(user.user_domain_id);
                break;
            case 'table':
                list = await this.getTables(user.user_domain_id);
                break;
            case 'query':
                // クエリリストの取得処理
                break;
            case 'script':
                // スクリプトリストの取得処理
                break;
            default:
                break;
        }

        let paneParameter = { 
            sidePanelTitle: path,
            appendButtonVisible: false,
            user: user,
            list: list,
            basePath: process.env.BASE_PATH ? process.env.BASE_PATH : ''
        };
        
        const sidePanelRenderResult = await this.renderHtml('views/controls/sidePanel/sideSubPanel.ejs', paneParameter);
        return sidePanelRenderResult;
    }

    /**
     * テーブルリストを取得する
     * @param {number} userDomainId ユーザードメインID
     * @returns {Array} テーブルリスト
     */
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
     * アプリケーションリストを取得する
     * @param {number} userDomainId ユーザードメインID
     * @returns {Promise<Array>} アプリケーションリスト
     */
    async getApplications(userDomainId) {
        try {
            const applicationTable = await this.modelManager.getModel('application');
            let applicationList = await applicationTable.get({});
            
            // ユーザードメインIDでフィルタリング（必要に応じて）
            if (userDomainId > 1) {
                // アプリケーションとドメインの関連付けを取得
                const appDomainLinkTable = await this.modelManager.getModel('application_domain_link');
                const appDomainLinks = await appDomainLinkTable.get({ user_domain_id: userDomainId });
                
                // 関連するアプリケーションIDのリストを作成
                const appIds = appDomainLinks.map(link => link.application_id);
                
                // フィルタリング
                applicationList = applicationList.filter(app => appIds.includes(app.application_id));
            }
            
            // アプリケーション名でソート
            applicationList.sort((a, b) => {
                if (a.application_name < b.application_name) return -1;
                if (a.application_name > b.application_name) return 1;
                return 0;
            });
            
            return applicationList;
        } catch (error) {
            console.error('アプリケーションリスト取得エラー:', error);
            return [];
        }
    }

    /**
     * HTMLをレンダリングする
     * @param {string} ejsPath EJSテンプレートのパス
     * @param {object} ejsParameters レンダリングパラメータ
     * @returns {Promise<object>} レンダリング結果
     */
    async renderHtml(ejsPath, ejsParameters) {
        const templatePath = resolve(ejsPath); // 絶対パスを指定

        // オブジェクトの複製を作成して元のパラメータを変更しない
        const params = { ...ejsParameters };

        // 翻訳ヘルパー関数をテンプレートパラメータに追加
        params.getL10n = async (text, lang = this.defaultLang) => {
            // 既にキャッシュにある場合は同期的に返す
            const cachedTranslation = this.getTranslation(text, lang);
            if (cachedTranslation !== text) {
                return cachedTranslation;
            }
            // キャッシュになければ非同期で取得
            return await this.getL10n(text, lang);
        };

        // 一括翻訳ヘルパー関数を追加
        params.getL10nBatch = async (textArray, lang = this.defaultLang) => {
            return await this.getL10nBatch(textArray, lang);
        };

        let renderResult = {};

        try {
            // 同期処理を優先してasync: falseにして処理
            // これによりEJSテンプレート内で[object Promise]の問題を回避する
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

    /**
     * Express用のルーターを取得する
     * @returns {object} Expressルーター
     */
    getRouter() {
        return this.pageRouter;
    }

    /**
     * L10nミドルウェアを取得する
     * @returns {Function} Expressミドルウェア
     */
    getL10nMiddleware() {
        return this.l10nRenderer.getMiddleware();
    }

    /**
     * 翻訳をプリロードする
     * アプリケーション起動時に使用して翻訳キャッシュを初期化
     * @param {string} [lang=null] 特定の言語のみロードする場合は指定
     * @returns {Promise<number>} ロードされた翻訳の数
     */
    async preloadTranslations(lang = null) {
        return await this.l10nRenderer.preloadTranslations(lang);
    }
}

export default EjsRenderer;