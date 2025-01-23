import express from 'express';
import * as credential from '../credential.mjs';

let modelManager = undefined;

async function createModelController(manager) {
    const ModelController = express.Router();
    modelManager = manager;

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
                const result = await verfyToken(req, res);
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
            const verifyResult = await verfyToken(req, res);

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

            const payload = req.body;
            const result = await model.put(payload);
            res.json(result);
        } catch (err) {
            console.error('Error updating model data:', err);
            res.status(500).send({ message: 'Internal server error' });
        }
    });

    ModelController.post('/*', async (req, res) => {
        try {
            const verifyResult = await verfyToken(req, res);
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

            const payload = req.body;
            const result = await model.post(payload);
            res.json(result);
        } catch (err) {
            console.error('Error creating model data:', err);
            res.status(500).send({ message: 'Internal server error' });
        }
    });

    ModelController.delete('/*', async (req, res) => {
        try {
            const verifyResult = await verfyToken(req, res);

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

/**
 * アクセストークンを検証する関数
 * @param {*} req 
 * @param {*} res 
 * @returns {Promise<object>} 検証結果
 */
async function verfyToken(req, res){
    let user = req.headers['x-user'];
    let token = req.headers['x-access-token'];
    let verfyResult = await modelManager.verifyToken(token, user, 'access_token');

    if (!verfyResult.auth) {
        user = req.cookies['x-user'];
        let refreshToken = req.cookies['refreshToken'];
        if (refreshToken) {
            const refreshResult = await modelManager.verifyToken(refreshToken, user, 'refresh_token');
            if (refreshResult.auth) {
                const newAccessToken = await credential.generateToken({ user, password: refreshResult.user.user_password, type: 'access_token' }, refreshResult.user.secret_key, '1d');
                res.cookie('accessToken', newAccessToken, { sameSite: 'Strict' });
            }
            return refreshResult
        }
    }
    return verfyResult;
}

export {
    createModelController
};

