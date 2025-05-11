import express from 'express';
import { RestUtil } from './rest-util.mjs';

let modelManager = undefined;
let restUtil = undefined;

function createQueryController(manager) {
    const QueryController = express.Router();
    modelManager = manager;
    restUtil = new RestUtil(manager);

    QueryController.get('/*', async (req, res) => {

        // アクセストークンを検証
        let verifyResult = await restUtil.verifyToken(req, res);
        if (!verifyResult.auth) {
            return res.status(401).send(verifyResult.message);
        }
        let queryName = req.params[0];

        // ドメインIDのチェック
        let domain_id_check = await modelManager.checkQueryDomainId(
            queryName, verifyResult.user.user_id
        );
        if (!domain_id_check) {
            return res.status(403).send('Forbidden');
        }

        // クエリを実行
        let params = req.body;
        let result = await modelManager.execQuery(queryName, params);
        res.send(result);

    });

    return QueryController;
}

export {
    createQueryController
};
