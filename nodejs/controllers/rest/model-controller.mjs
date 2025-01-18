import express from 'express';
import { ModelManager } from '../model-manager.mjs';

export const ModelController = express.Router();
const modelManager = new ModelManager();
await modelManager.reloadModels();

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

        if (!model) {
            return res.status(404).send({ message: 'Model not found' });
        }

        if (model.tableDefinition.scope !== 'public') {
            const user = req.headers['x-user'];
            const token = req.headers['x-access-token'];
            const result = await modelManager.verifyAccessToken(token, user);

            if (!result.auth) {
                return res.status(401).send(result);
            }
        }

        const queryParams = req.query;
        const filter = {};

        for (const [key, value] of Object.entries(queryParams)) {
            filter[key] = value.split('|');
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
        const user = req.headers['x-user'];
        const token = req.headers['x-access-token'];
        const verifyResult = await modelManager.verifyAccessToken(token, user);

        if (!verifyResult.auth) {
            return res.status(401).send(result);
        }

        const path = req.params[0];
        const nameParts = path.split('/');
        const modelName = nameParts[0];
        const model = await modelManager.getModel(modelName);

        if (!model) {
            return res.status(404).send({ message: 'Model not found' });
        }

        const payload = req.body;
        const result = await model.put(payload);
        res.json(result);
    } catch (err) {
        console.error('Error updating model data:', err);
        res.status(500).send({ message: 'Internal server error' });
    }
});
