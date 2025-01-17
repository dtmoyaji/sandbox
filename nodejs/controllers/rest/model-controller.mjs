import express from 'express';
import { ModelManager } from '../../models/model-manager.mjs';

let ModelController = express.Router();
let modelManager = new ModelManager();
modelManager.reloadModels();

/**
 * モデルのリストを取得するAPI
 * GET /models/[model_name]?[query_params]
 * フィルタ条件はの値はparam1=value|value&param2=value|valueの形式で指定
 * @param {string} model_name - モデル名
 * @param {object} query_params - フィルター条件
 */
ModelController.get('/*', async (req, res) => {
    let path = req.params[0];
    let nameParts = path.split('/');
    let modelName = nameParts[0];
    let model = modelManager.getModel(modelName);
    if (model) {
        let queryParams = req.query;
        // queryParamsの要素をフィルターに変換
        let filter = {};
        for (const [key, value] of Object.entries(queryParams)) {
            // valueを|で分割して配列に変換
            let splitedValue = value.split('|');
            filter[key] = splitedValue;
        }
        let result = await model.get(filter);
        res.send(result);
    } else {
        res.status(404).send('Requested model not found');
    }
});

export { ModelController };

