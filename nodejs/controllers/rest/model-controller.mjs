import express from 'express';
import { ModelManager } from '../../models/model-manager.mjs';
import { verifyJWT } from '../credencial.mjs';

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
            const result = await verifyAccessToken(token, user);

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

/**
 * アクセストークンを検証する関数
 * @param {string} token - 検証するアクセストークン
 * @param {string} user - ユーザー名
 * @returns {Promise<object>} 検証結果
 */
export async function verifyAccessToken(token, user) {
    if (!token || !user) {
        return { auth: false, message: 'Authorization required' };
    }

    // ユーザー情報を取得
    const userTable = await modelManager.getModel('user');
    const userRecord = await userTable.get({ user_name: user });

    if (userRecord.length === 0) {
        return { auth: false, message: 'Invalid user' };
    }

    // トークンを検証
    const secretKey = userRecord[0].secret_key;
    const result = await verifyJWT(secretKey, token);

    // トークンが無効な場合、エラーメッセージを返す
    if (!result.auth) {
        return { auth: false, message: 'Invalid token' };
    }

    const password = result.decoded.password;

    // パスワードが一致しない場合、エラーメッセージを返す
    if (password !== userRecord[0].user_password) {
        return { auth: false, message: 'Invalid password' };
    }

    return { auth: true, user: userRecord[0] };
}

