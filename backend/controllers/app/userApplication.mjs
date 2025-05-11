import express from 'express';
import path from 'path';
import EjsRenderer from '../../views/renderer/ejs-renderer.mjs';

export class UserApplication {

    router = null;
    modelManager = null;
    viewRoute = null;
    systemViewRoute = null;
    unifiedRenderer = null;

    constructor(restUtil, modelManager) {
        this.modelManager = modelManager;
        this.router = express.Router();
        this.viewRoute = path.resolve('./applications');
        this.systemViewRoute = path.resolve('./views');
        this.unifiedRenderer = new EjsRenderer(restUtil, modelManager);

    }

    async initializeResolvers() {
        this.router.get('/*', async (req, res) => {
            await this.drawPage(req, res);
        });
    }

    async drawPage(req, res) {
        let applicationName = req.params[0];
        req.application_name = applicationName;
        let application = await this.modelManager.getModel('application');
        let applicationRecord = await application.get({ application_name: applicationName });
        if (applicationRecord.length === 0) {
            if (!res.headersSent) {
                return res.status(404).send('Not Found');
            }
            return;
        }
        req.application_protection = applicationRecord[0].application_protection;
        let appViewRoute = path.resolve(this.viewRoute, applicationName);
        let appMain = path.resolve(appViewRoute, 'views', 'main.ejs');

        let page = await this.unifiedRenderer.render(req, res, appMain);

        if (!res.headersSent) {
            res.send(page.body);
        }
    }
}

