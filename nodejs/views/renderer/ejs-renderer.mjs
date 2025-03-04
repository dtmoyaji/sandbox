import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import { resolve } from 'path';

dotenv.config();

class EjsRenderer {
    restUtil = undefined;
    modelManager = undefined;
    pageRouter = undefined;

    constructor(restUtil, modelManager) {
        this.restUtil = restUtil;
        this.modelManager = modelManager;
        this.pageRouter = express.Router();
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
            modifycss: ''
        };

        // 各部品をレンダリング
        let startButtonHtml = await this.renderHtml('views/controls/startButton/startButton.ejs', ejsParameters);
        let topBarHtml = await this.renderHtml('views/controls/topBar/topBar.ejs', ejsParameters);
        let footerHtml = await this.renderHtml('views/controls/footBar/footBar.ejs', ejsParameters);
        let centerPanelHtml = await this.renderHtml('views/controls/centerPanel/centerPanel.ejs', ejsParameters);
        let websocketHtml = await this.renderHtml('views/controls/websocket/websocket.ejs', ejsParameters);
        let modifycssHtml = await this.renderHtml('views/page/modifycss.ejs', ejsParameters);

        ejsParameters.topBar = topBarHtml.body;
        ejsParameters.startButton = startButtonHtml.body;
        ejsParameters.footer = footerHtml.body;
        ejsParameters.centerPanel = centerPanelHtml.body;
        ejsParameters.websocket = websocketHtml.body;
        ejsParameters.modifycss = modifycssHtml.body;

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
            return res.status(401).send(verifyResult.message);
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

export default EjsRenderer;
