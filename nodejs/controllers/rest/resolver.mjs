import express from 'express';
import { Table } from '../../models/table.mjs';
import { RestUtil } from './rest-util.mjs';

/**
 * リゾルバークラス
 */
class Resolver {

    reouter = undefined;
    resolvInfos = undefined;
    modelManager = undefined;
    restUtil = undefined;

    constructor(modelManager) {
        this.modelManager = modelManager;
        this.restUtil = new RestUtil(modelManager);
        this.router = express.Router();
        this.resolvInfos = [];
    }

    async initializeResolvers() {
        // テーブルのget, post, put, delete のリゾルバを登録
        let models = this.modelManager.models;
        for (let model of models) {
            let resolvInfo = {
                path: model.table_name,
                parameters: {
                    model_name: model.table_name,
                    type: 'table'
                },
            }
            this.resolvInfos.push(resolvInfo);
        }
        this.resolvInfos.push({
            path: 'all',
            parameters: {
                model_name: 'all',
                type: 'tablelist'
            },
        });
        this.router.get('/*', async (req, res) => {
            let paths = req.params[0].split('/');
            let path = '';
            if (paths.length > 0) {
                path = paths[0];
            }
            let resolvInfo = await this.getResolveInfo(path);
            console.log('PATH: ', path);
            switch (path) {
                case 'tableDefinition':
                    return this.tableDefinitionGet(resolvInfo, req, res);
                    break;
                default:
                    return this.tableGet(resolvInfo, req, res);
            }
        });
        this.router.post('/*', async (req, res) => {
            let path = '';
            if (req.params[0] !== undefined) {
                path = req.params[0].split('/')[0];
            }
            let resolvInfo = await this.getResolveInfo(path);
            return this.tablePost(resolvInfo, req, res);
        });
        this.router.put('/*', async (req, res) => {
            let path = '';
            if (req.params[0] !== undefined) {
                path = req.params[0].split('/')[0];
            }
            let resolvInfo = await this.getResolveInfo(path);
            return this.tablePut(resolvInfo, req, res);
        });
        this.router.delete('/*', async (req, res) => {
            let path = '';
            if (req.params[0] !== undefined) {
                path = req.params[0].split('/')[0];
            }
            let resolvInfo = await this.getResolveInfo(path);
            return this.tableDelete(resolvInfo, req, res);
        });
    }

    async getResolveInfo(path) {
        let result = {};
        if (path !== undefined) {
            for (let resolvInfo of this.resolvInfos) {
                if (resolvInfo.path === path) {
                    result = resolvInfo;
                    break;
                }
            }
        }
        return result;
    }

    async tableDefinitionGet(resolvInfo, req, res) {
        let verifyResult = await this.restUtil.verifyToken(req, res);
        if(!verifyResult.auth) {
            return res.status(401).send(verifyResult);
        }
        let params = req.params[0].split('/');
        if (params.length < 2) {
            return {};
        }

        console.log('tableDefinitionGet', params[1]);
        let targetTable = this.modelManager.models.find(model => model.table_name === params[1]);
        if (!targetTable) {
            return res.status(404).send({ message: 'Model not found' });
        }
        let result = targetTable.tableDefinition
        return res.send(result);
    }

    async tableGet(resolvInfo, req, res) {
        if(req.path === '/'){
            return res.json({});
        }
        let verifyResult = await this.restUtil.verifyToken(req, res);
        const modelName = resolvInfo.parameters.model_name;

        // ユーザーモデルの場合は、特別な処理を行う
        if (modelName === 'user') {
            return await this.getUser(req, res);
        }

        // all の場合は、全てのモデルを取得する
        let result = {};
        if (resolvInfo.path === 'all') {
            result = this.modelManager.models;
            result = await this.filterByUserDomainId(result, verifyResult.user_domains);
            for (let model of result) { // connectionは外部に出さない
                delete model.connection;
            };
            return res.json(result);
        }

        const model = await this.modelManager.getModel(modelName);
        const model_user_domain_id = model.user_domain_id;

        if (!model) {
            return res.status(404).send({ message: 'Model not found' });
        }

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
        let accessRight = await this.restUtil.isAccessibleModel(
            model_user_domain_id, verifyResult.user.user_id
        );
        if (!accessRight.accessible) {
            let value = [];
            for (let domain_id of verifyResult.user_domains) {
                value.push(domain_id);
            }
            filter['user_domain_id'] = value;
        }
        result = await model.get(filter);

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

    }

    async tablePost(resolvInfo, req, res) {
        console.log('tablePost', resolvInfo.path);
        res.send(resolvInfo);
    }

    async tablePut(resolvInfo, req, res) {
        console.log('tablePut', resolvInfo.path);
        res.send(resolvInfo);
    }

    async tableDelete(resolvInfo, req, res) {
        console.log('tableDelete', resolvInfo.path);
        res.send(resolvInfo);
    }

    async getUser(req, res) {
        try {
            const path = req.params[0];
            const nameParts = path.split('/');
            const modelName = nameParts[0];
            const model = await this.modelManager.getModel('user');

            const verifyResult = await this.restUtil.verifyToken(req, res);
            if (!verifyResult.auth) {
                return res.status(401).send(verifyResult);
            }
            let userDomainIds = verifyResult.user_domains;
            let userDomainLinkTable = await this.modelManager.getModel('user_domain_link');

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

    async filterByUserDomainId(data, userDomainIds) {
        let result = [];
        for (let record of data) {
            if (userDomainIds.includes(record.user_domain_id)) {
                result.push(record);
            }
        }
        return result;
    }

}

export { Resolver };
