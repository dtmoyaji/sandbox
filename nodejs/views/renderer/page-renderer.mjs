import ejs from 'ejs';
import { resolve } from 'path';

class PageRenderer {
    restUtil = undefined;
    modelManager = undefined;

    constructor(restUtil, modelManager) {
        this.restUtil = restUtil;
        this.modelManager = modelManager;
    }

    /**
     * ページをレンダリングする
     * @param {*} req
     * @param {*} res
     * @returns {Promise<object>} レンダリング結果
     */
    async render(req, res) {
        let path = req.params[0] || ''; // パスがない場合は空文字列を使用
        const nameParts = path.split('/');
        const queryParams = req.query;

        let ejsParameters = {
            path: nameParts,
            params: queryParams,
            pageTitle: 'Page Title',
            startButton: '',
            topBar: '',
            sidebarPanel: '',
            centerPanel: '',
            footer: ''
        };

        // 各部品をレンダリング
        let startButtonHtml = await this.renderHtml('views/controls/startButton/startButton.ejs', ejsParameters);
        let topBarHtml = await this.renderHtml('views/controls/topBar/topbar.ejs', ejsParameters);
        let footerHtml = await this.renderHtml('views/controls/footBar/footbar.ejs', ejsParameters);
        let sidePanelHtml = await this.renderSidePanel(req, res, ejsParameters);

        ejsParameters.topBar = topBarHtml.body;
        ejsParameters.startButton = startButtonHtml.body;
        ejsParameters.footer = footerHtml.body;
        ejsParameters.sidebarPanel = sidePanelHtml.body;

        let renderResult = this.renderHtml('views/page/page.ejs', ejsParameters); // 絶対パスを指定
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
        if( req.path.length > 0 ) {
            pathNode = req.path.split('/');
        }
        let param1 = pathNode[1] || '';
        let param2 = pathNode[2] || '';

        let verfyResult = await this.restUtil.verifyToken(req, res);
        if (!verfyResult.auth) {
            return res.status(401).send(verfyResult.message);
        }

        let user = verfyResult.user;
        let userDomainId = user.user_domain_id;

        let userDomainTable = await this.modelManager.getModel('user_domain');
        let userDomain = await userDomainTable.get({ user_domain_id: userDomainId });
        if(userDomain.length === 0) {
            return res.status(404).send('Not Found');
        }
        let userDomainName = userDomain[0].domain_name;

        let sidePanelRenderResult = {};
        let renderResult = { status: 200, body: '' };
        
        let paneParameter = { sidePanelTitle: userDomainName, appendButtonVisible: false, user: user };
        sidePanelRenderResult = await this.renderHtml('views/controls/sidePanel/sideMainPanel.ejs', paneParameter);
        if (sidePanelRenderResult.status > 200) {
            renderResult.status = sidePanelRenderResult.status;
            renderResult.body += sidePanelRenderResult.message;
        } else {
            renderResult.body += sidePanelRenderResult.body;
        }
        
        if(param2 !== '') {
            paneParameter = { sidePanelTitle: param2, appendButtonVisible: false, user: user };
            sidePanelRenderResult = await this.renderHtml('views/controls/sidePanel/sideSubPanel.ejs', paneParameter);
            if (sidePanelRenderResult.status > 200) {
                renderResult.status = sidePanelRenderResult.status;
                renderResult.body += sidePanelRenderResult.message;
            } else {
                renderResult.body += sidePanelRenderResult.body;
            }
        }
        
        return renderResult;
    }

    /**
     * HTMLをレンダリングする
     * @param {string} ejsPath
     * @param {object} ejsParameters
     * @returns {Promise<object>} レンダリング結果
     */
    async renderHtml(ejsPath, ejsParameters) {
        const templatePath = resolve(ejsPath); // 絶対パスを指定

        let renderResult = {};

        try {
            const str = await ejs.renderFile(templatePath, ejsParameters);
            renderResult.status = 200;
            renderResult.body = str;
        } catch (err) {
            renderResult.status = 500;
            renderResult.message = err.message;
            throw err;
        }

        return renderResult;
    }
}

export {
    PageRenderer
};
