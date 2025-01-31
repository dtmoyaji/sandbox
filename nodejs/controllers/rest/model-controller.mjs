import express from 'express';
import { Table } from '../../models/table.mjs';
import { RestUtil } from './rest-util.mjs';

let restUtil = undefined;
let modelManager = undefined;

async function createModelController(manager) {
    const ModelController = express.Router();

    restUtil = new RestUtil(manager);
    modelManager = manager;

    ModelController.get('/all', async (req, res) => {
        try {
            const verifyResult = await restUtil.verifyToken(req, res);
            if (!verifyResult.auth) {
                return res.status(401).send(verifyResult);
            }

            let result = await modelManager.models;
            if (result.length > 0) {
                let buf = [];
                for (let model of result) {
                    let accessRight = await restUtil.isAccessibleModel(
                        model.user_domain_id, verifyResult.user.user_id
                    );
                    if (accessRight.accessible) {
                        buf.push(model);
                    }
                }
                result = buf;
                // result.name でソートする
                result.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return 0;
                });
            }
            res.json(result);
        } catch (err) {
            console.error('Error fetching model data:', err);
            res.status(500).send({ message: 'Internal server error' });
        }
    });

    /**
     * モデルのリストを取得するAPI
     * GET /models/[model_name]?[query_params]
     * フィルタ条件の値はparam1=value|value&param2=value|valueの形式で指定
     * @param {string} model_name - モデル名
     * @param {object} query_params - フィルター条件
     */
    ModelController.get('/*', async (req, res) => {
        try {
            const path = req.params[0];
            const nameParts = path.split('/');
            const modelName = nameParts[0];
            const model = await modelManager.getModel(modelName);
            const model_user_domain_id = model.user_domain_id;

            if (!model) {
                return res.status(404).send({ message: 'Model not found' });
            }

            let verifyResult = await restUtil.verifyToken(req, res);;
            if (model.tableDefinition.scope !== Table.TABLE_SCOPE_PUBLIC) {
                // アクセストークンの検証
                if (!verifyResult.auth) {
                    return res.status(401).send(verifyResult);
                }
            }

            const queryParams = req.query;
            const filter = {};
            for (const [key, value] of Object.entries(queryParams)) {
                filter[key] = value.split('|');
            }

            // アクセス権の確認
            let accessRight = await restUtil.isAccessibleModel(
                model_user_domain_id, verifyResult.user.user_id
            );
            if (!accessRight.accessible) {
                let value = [];
                for (let domain_id of verifyResult.user_domains) {
                    value.push(domain_id);
                }
                filter['user_domain_id'] = value;
            }
            const result = await model.get(filter);

            // modelのtableDefinitionのfieldsに、secret=trueを持つフィールドがある場合、そのフィールドをマスクする
            if (model.tableDefinition.fields.some(field => field.secret)) {
                result.forEach(record => {
                    model.tableDefinition.fields.forEach(field => {
                        if (field.secret) {
                            record[field.name] = '********';
                        }
                    });
                });
            }

            res.json(result);
        } catch (err) {
            console.error('Error fetching model data:', err);
            res.status(500).send({ message: 'Internal server error' });
        }
    });

    ModelController.put('/*', async (req, res) => {
        try {
            const verifyResult = await restUtil.verifyToken(req, res);

            if (!verifyResult.auth) {
                return res.status(401).send(verifyResult);
            }

            const path = req.params[0];
            const nameParts = path.split('/');
            const modelName = nameParts[0];
            const model = await modelManager.getModel(modelName);

            if (!model) {
                return res.status(404).send({ message: 'Model not found' });
            }

            // 管理者は、システムドメインのデータのうち、所属ドメイン以外のデータを更新できない
            // ただし、システムドメインの管理者は、全てのデータを更新できる
            if (!restUtil.isAccessibleModel(
                model.user_domain_id,
                verifyResult.user.user_id)
            ) {
                return res.status(403).send({ message: 'Forbidden' });
            }

            const payload = req.body;
            const result = await model.put(payload);
            res.json(result);
        } catch (err) {
            console.error('Error updating model data:', err);
            res.status(500).send(err);
        }
    });

    ModelController.post('/*', async (req, res) => {
        try {
            const verifyResult = await restUtil.verifyToken(req, res);
            if (!verifyResult.auth) {
                return res.status(401).send(verifyResult);
            }

            const path = req.params[0];
            const nameParts = path.split('/');
            const modelName = nameParts[0];
            const model = await modelManager.getModel(modelName);

            if (!model) {
                return res.status(404).send({ message: 'Model not found' });
            }

            let accessRight = await restUtil.isAccessibleModel(
                model.user_domain_id, verifyResult.user.user_id
            );
            if (!accessRight.accessible) {
                return res.status(403).send({ message: 'Forbidden' });
            }

            const payload = req.body;
            const result = await model.post(payload);
            res.json(result);
        } catch (err) {
            console.error('Error creating model data:', err);
            res.status(500).send(err);
        }
    });

    ModelController.delete('/*', async (req, res) => {
        try {
            const verifyResult = await restUtil.verifyToken(req, res);

            if (!verifyResult.auth) {
                return res.status(401).send(verifyResult);
            }

            const path = req.params[0];
            const nameParts = path.split('/');
            const modelName = nameParts[0];
            const model = await modelManager.getModel(modelName);

            if (!model) {
                return res.status(404).send({ message: 'Model not found' });
            }

            // 管理者でないユーザーは、他のユーザードメインのデータを更新できない
            if (
                model.user_domain_id !== verifyResult.user.user_domain_id
                && verifyResult.user.admin_flag !== 1
            ) {
                return res.status(403).send({ message: 'Forbidden' });
            }

            // 管理者は、システムドメインのデータのうち、所属ドメイン以外のデータを更新できない
            // ただし、システムドメインの管理者は、全てのデータを更新できる
            if (
                model.user_domain_id === 1
                && verifyResult.user.admin_flag === 1
                && req.body.user_domain_id !== verifyResult.user.user_domain_id
                && verifyResult.user.user_domain_id === 1
            ) {
                return res.status(403).send({ message: 'Forbidden' });
            }

            const payload = req.body;
            const result = await model.delete(payload);
            res.json(result);
        } catch (err) {
            console.error('Error creating model data:', err);
            res.status(500).send({ message: 'Internal server error' });
        }
    });

    return ModelController;
}

export {
    createModelController
};

