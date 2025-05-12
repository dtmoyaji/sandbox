/**
 * EjsRendererSidebar - サイドバーレンダリング専用クラス
 * 
 * このクラスは以下の機能を提供します：
 * 1. サイドメインパネルのレンダリング
 * 2. サイドサブパネルのレンダリング
 * 3. アプリケーション/テーブル/クエリ/スクリプトのリスト取得 (CS.mdに定義されたAPIを使用)
 */

class EjsRendererSidebar {
    constructor(restUtil, modelManager, ejsRenderer) {
        this.restUtil = restUtil;
        this.modelManager = modelManager;
        this.ejsRenderer = ejsRenderer; // EjsRendererへの参照（renderHtmlなどを使用するため）
        this.basePath = process.env.BASE_PATH || '';
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
        let param1 = pathNode[1] || ''; // param1は常にadmin
        // param2はサブパネルのセクション名（application, table, query, script）
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
        const sideMenuTranslations = await this.ejsRenderer.getL10nBatch([
            'application',
            'table',
            'クエリ',
            'スクリプト'
        ]);

        let renderResult = { status: 200, body: '' };

        // メインパネルのパラメータ設定
        let paneParameter = {
            sidePanelTitle: userDomainName,
            appendButtonVisible: false,
            user: user,
            basePath: this.basePath,
            translations: sideMenuTranslations,  // 翻訳データを直接渡す
            currentSection: param1 || '' // 現在のセクションを渡す
        };
        
        // メインパネルをレンダリング
        const sidePanelRenderResult = await this.ejsRenderer.renderHtml('views/controls/sidePanel/sideMainPanel.ejs', paneParameter);
        if (sidePanelRenderResult.status > 200) {
            renderResult.status = sidePanelRenderResult.status;
            renderResult.body += sidePanelRenderResult.message || '';
        } else {
            renderResult.body += sidePanelRenderResult.body || '';
        }

        // サブパネルは常にレンダリング（メニュー選択がない場合でも空のパネルを表示）
        const selectedSection = param2 || 'application'; // デフォルトはapplication
        ejsParameters.basePath = this.basePath;
        
        const subMenuRenderResult = await this.renderSideSubPanel(user, selectedSection, ejsParameters);
        if (subMenuRenderResult.status > 200) {
            renderResult.status = subMenuRenderResult.status;
            renderResult.body += subMenuRenderResult.message || '';
        } else {
            renderResult.body += subMenuRenderResult.body || '';
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
        const basePath = ejsParameters.basePath;
        console.log(`サブパネルのレンダリング開始: path=${path}`);
        let list = [];
        try {
            // APIを使わず、直接modelManagerを使用してデータを取得
            switch (path) {
                case 'application':
                    console.log('アプリケーションリストをモデルから取得します');
                    const applicationModel = await this.modelManager.getModel('application');
                    list = await applicationModel.get({});
                    console.log(`取得したアプリケーション数: ${list.length}`);
                    break;
                case 'table':
                    console.log('テーブルリストをモデルから取得します');
                    list = this.modelManager.models;
                    console.log(`取得したテーブル数: ${list.length}`);
                    break;
                case 'query':
                    console.log('クエリリストをモデルから取得します');
                    const queryModel = await this.modelManager.getModel('query_template');
                    list = await queryModel.get({});
                    console.log(`取得したクエリ数: ${list.length}`);
                    break;
                case 'script':
                    console.log('スクリプトリストをモデルから取得します');
                    const scriptModel = await this.modelManager.getModel('script');
                    list = await scriptModel.get({});
                    console.log(`取得したスクリプト数: ${list.length}`);
                    break;
                default:
                    console.log(`未知のパス: ${path}, デフォルトは空リスト`);
                    break;
            }

            // ユーザードメインIDに基づいてフィルタリング（必要に応じて）
            if (user && user.user_domain_id > 1 && list.length > 0) {
                list = this.filterByUserDomain(list, user.user_domain_id, path);
            }

            // リストの構造を検証（デバッグ用）
            if (list && list.length > 0) {
                console.log('最初のリスト項目のサンプル:', JSON.stringify(list[0]).substring(0, 200));
            } else {
                console.warn(`${path}のリストが空またはundefinedです`);
                list = []; // 必ずlist配列が存在するようにする
            }

            let paneParameter = { 
                sidePanelTitle: path,
                appendButtonVisible: false,
                user: user,
                list: list,
                basePath: this.basePath
            };
            
            console.log(`sideSubPanel.ejsのレンダリングを開始 (${list.length}項目)`);
            const sidePanelRenderResult = await this.ejsRenderer.renderHtml('views/controls/sidePanel/sideSubPanel.ejs', paneParameter);
            console.log('sideSubPanel.ejsのレンダリング完了');
            return sidePanelRenderResult;
        } catch (error) {
            console.error('サブパネルレンダリングエラー:', error);
            // エラー時もパネルを表示するためのフォールバック
            return {
                status: 200, 
                body: `<div class="sidebarPanel" id="sideSubPanel">
                         <div class="sidePanelTitle"><label>${path || 'エラー'}</label></div>
                         <div class="sidePanelMenu">
                           <div class="error-panel">読み込みエラー: ${error.message}</div>
                         </div>
                       </div>`
            };
        }
    }

    /**
     * APIからデータを取得する
     * @param {string} endpoint - APIエンドポイント
     * @returns {Promise<Array>} 取得したデータ
     */
    async fetchApiData(endpoint, basePath) {
        try {
            console.log(`API呼び出し: ${basePath}${endpoint}`);
            
            // 絶対URLを構築
            const apiUrl = `${basePath}${endpoint}`;
            console.log(`完全なAPI URL: ${apiUrl}`);
            
            // genericTableと同様にシンプルなfetchリクエストを使用
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API呼び出しエラー (${response.status}): ${errorText}`);
            }
            
            const result = await response.json();
            console.log('取得したデータ構造:', Object.keys(result));
            
            // genericTableと同様のレスポンス形式の解析
            if (result.data && Array.isArray(result.data)) {
                console.log(`取得したデータ件数: ${result.data.length}`);
                return result.data;
            } else if (result.tableDefinition && Array.isArray(result.tableDefinition.data)) {
                return result.tableDefinition.data;
            } else if (Array.isArray(result)) {
                return result;
            } else if (result && typeof result === 'object') {
                console.log('単一オブジェクトをリストに変換:', result);
                return [result];
            }
            
            console.warn('未知のレスポンス形式:', result);
            return [];
        } catch (error) {
            console.error(`APIデータ取得エラー (${endpoint}):`, error);
            return [];
        }
    }

    /**
     * ユーザードメインIDに基づいてデータをフィルタリングする
     * @param {Array} list - フィルタリングするデータリスト
     * @param {number} userDomainId - ユーザードメインID
     * @param {string} type - データタイプ (application, table, query, script)
     * @returns {Array} フィルタリングされたデータ
     */
    filterByUserDomain(list, userDomainId, type) {
        if (!list || !Array.isArray(list) || list.length === 0) {
            return [];
        }

        // 各データタイプに応じたフィルタリング
        switch (type) {
            case 'application':
                // アプリケーションの場合、user_domain_idかdomain_idでフィルタリング
                return list.filter(item => 
                    (item.user_domain_id && item.user_domain_id === userDomainId) || 
                    (item.domain_id && item.domain_id === userDomainId)
                );
            
            case 'table':
            case 'query':
            case 'script':
                // 他のタイプはuser_domain_idでフィルタリング
                return list.filter(item => item.user_domain_id === userDomainId);
            
            default:
                return list;
        }
    }
}

export default EjsRendererSidebar;
