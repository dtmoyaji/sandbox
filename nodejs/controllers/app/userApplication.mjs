import ejs from 'ejs';
import express from 'express';
import path from 'path';

export class UserApplication {
    router = null;
    modelManager = null;
    viewRoute = null;
    systemViewRoute = null;

    constructor(modelManager) {
        this.modelManager = modelManager;
        this.router = express.Router();
        this.viewRoute = path.resolve('./applications');
        this.systemViewRoute = path.resolve('./views');

        this.router.get('/*', async (req, res) => {
            await this.drawPage(req, res);
        });
    }

    async drawPage(req, res){
        let applicationName = req.params[0];
        let application = await this.modelManager.getModel('application');
        let applicationRecord = await application.get({ application_name: applicationName });
        if (applicationRecord.length === 0) {
            return res.status(404).send('Not Found');
        }
        let appViewRoute = path.resolve(this.viewRoute, applicationName);
        let appMain = path.resolve(appViewRoute, 'views', 'main.ejs');

        let systemFootBarPath = path.resolve(this.systemViewRoute, 'controls', 'footBar', 'footBar.ejs');


        let page = await ejs.renderFile(appMain, 
            {
                systemFootBar: await ejs.renderFile(systemFootBarPath),
                systemViewRoute: this.systemViewRoute,
                application: applicationRecord[0] 
            }
        );

        res.send(page);
    }
}

