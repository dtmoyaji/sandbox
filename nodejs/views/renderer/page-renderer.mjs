import ejs from 'ejs';
import express from 'express';
import { resolve } from 'path';

class PageRenderer {
    restUtil = undefined;
    modelManager = undefined;
    pageRouter = undefined;

    constructor(restUtil, modelManager) {
        this.restUtil = restUtil;
        this.modelManager = modelManager;
        this.pageRouter = express.Router();

        this.pageRouter.get('/*', async (req, res) => {
            let paths = req.path.split('/');
            let renderPanel = paths[1] || '';
            let renderType = paths[2] || '';
            let renderTarget = paths[3] || '';
            let renderResult = await this.renderCenterPanel(renderType, renderTarget);
            res.send(renderResult);
        });
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
        const queryParams = {
            path: nameParts,
            query: req.query
        };

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
        let centerPanelHtml = await this.renderHtml('views/controls/centerPanel/centerPanel.ejs', ejsParameters);

        ejsParameters.topBar = topBarHtml.body;
        ejsParameters.startButton = startButtonHtml.body;
        ejsParameters.footer = footerHtml.body;
        ejsParameters.sidebarPanel = sidePanelHtml.body;
        ejsParameters.centerPanel = centerPanelHtml.body;

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
        if (req.path.length > 0) {
            pathNode = req.path.split('/');
        }
        let param1 = pathNode[1] || '';
        let param2 = pathNode[2] || '';

        let verfyResult = await this.restUtil.verifyToken(req, res);
        if (!verfyResult.auth) {
            return res.status(401).send(verfyResult.message);
        }

        let user = verfyResult.user;
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

        let paneParameter = { sidePanelTitle: userDomainName, appendButtonVisible: false, user: user };
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
