import express from 'express';
import { Table } from '../../models/table.mjs';
import { RestUtil } from './rest-util.mjs';

let restUtil = undefined;
let modelManager = undefined;

/**
 * @param {*} manager 
 * @returns 
 * @deprecated
 */
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
                    if (accessRight = await restUtil.isAccessibleModel(
                        model, verifyResult
                    )) {
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

            // ユーザーモデルの場合は、特別な処理を行う
            if (modelName === 'user') {
                return await getUser(req, res);
            }

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
                filter[key] = value;
            }

            // アクセス権の確認
            if (await restUtil.isAccessibleModel(
                model_user_domain_id,
                verifyResult.user.user_id
            )) {
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

    ModelController.get('/script/:scriptName', async (req, res) => {
        try {
            const verifyResult = await restUtil.verifyToken(req, res);
            if (!verifyResult.auth) {
                return res.status(401).send(verifyResult);
            }

            const scriptName = req.params.scriptName;
            if (!scriptName) {
                return res.status(400).send({ message: 'Script name is required' });
            }

            console.log(`スクリプト内容取得API - scriptName: ${scriptName}`);

            const scriptModel = await modelManager.getModel('script');
            if (!scriptModel) {
                console.error('Script model not found');
                return res.status(404).send({ message: 'Script model not found' });
            }

            // スクリプトレコードを取得
            const scriptRecords = await scriptModel.get({ script_name: scriptName });
            console.log(`スクリプトレコード取得結果 - レコード数: ${scriptRecords ? scriptRecords.length : 0}`);
            
            if (!scriptRecords || scriptRecords.length === 0) {
                console.error(`Script not found: ${scriptName}`);
                return res.status(404).send({ message: 'Script not found' });
            }

            const scriptRecord = scriptRecords[0];
            console.log(`スクリプトレコード - ID: ${scriptRecord.script_id}, Name: ${scriptRecord.script_name}`);
            
            // スクリプト内容の確認
            const hasScriptContent = scriptRecord.script && scriptRecord.script.trim().length > 0;
            console.log(`スクリプト内容の有無: ${hasScriptContent ? 'あり' : 'なし'}`);
            
            // スクリプトテーブルから直接スクリプト内容を取得
            const scriptContent = hasScriptContent 
                ? scriptRecord.script 
                : '// スクリプト内容がありません。このスクリプトは空です。';
            
            // レスポンスを返す
            res.json({
                success: true,
                data: {
                    script_id: scriptRecord.script_id,
                    script_name: scriptName,
                    script_content: scriptContent,
                    description: scriptRecord.description || '',
                    bind_module: scriptRecord.bind_module || '',
                    parameters: scriptRecord.parameters || '',
                    created_at: scriptRecord.created_at,
                    updated_at: scriptRecord.updated_at,
                    hasContent: hasScriptContent
                }
            });
        } catch (err) {
            console.error('Error fetching script content:', err);
            res.status(500).send({ 
                message: 'Internal server error', 
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
    });

    async function getUser(req, res) {
        try {
            const path = req.params[0];
            const nameParts = path.split('/');
            const modelName = nameParts[0];
            const model = await modelManager.getModel('user');

            const verifyResult = await restUtil.verifyToken(req, res);
            if (!verifyResult.auth) {
                return res.status(401).send(verifyResult);
            }
            let userDomainIds = verifyResult.user_domains;
            let userDomainLinkTable = await modelManager.getModel('user_domain_link');

            let filter = {};
            if (!userDomainIds.includes(RestUtil.SYSTEM_DOMAIN_ID)) {
                // 同じドメインのユーザーを取得
                let friends = await userDomainLinkTable.get({ user_domain_id: userDomainIds });
                let friendIds = friends.map(f => f.user_id);
                filter = { user_id: friendIds };
            }

            const queryParams = req.query;
            for (const [key, value] of Object.entries(queryParams)) {
                filter[key] = value;
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
    }

    return ModelController;
}

export {
    createModelController
};

