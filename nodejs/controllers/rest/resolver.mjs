import dotenv from 'dotenv';
import express from 'express';
import { Table } from '../../models/table.mjs';
import { RestUtil } from './rest-util.mjs';

dotenv.config();

/**
 * リゾルバークラス
 */
class Resolver {

    router = undefined;
    resolveInfos = undefined;
    modelManager = undefined;
    restUtil = undefined;

    constructor(modelManager) {
        this.modelManager = modelManager;
        this.restUtil = new RestUtil(modelManager);
        this.router = express.Router();
        this.resolveInfos = [];
    }

    async initializeResolvers() {
        // テーブルのget, post, put, delete のリゾルバを登録
        let models = this.modelManager.models;
        for (let model of models) {
            let resolveInfo = {
                path: model.table_name,
                parameters: {
                    model_name: model.table_name,
                    type: 'table'
                },
            }
            this.resolveInfos.push(resolveInfo);
        }
        this.resolveInfos.push({
            path: 'all',
            parameters: {
                model_name: 'all',
                type: 'table_list'
            },
        });
        this.router.get('/*', async (req, res) => {
            let paths = req.params[0].split('/');
            let path = '';
            if (paths.length > 0) {
                path = paths[0];
            }
            let resolveInfo = await this.getResolveInfo(path);
            //console.log('PATH: ', path);
            switch (path) {
                case 'tableDefinition':
                    return this.tableDefinitionGet(resolveInfo, req, res);
                    break;
                default:
                    return this.tableGet(resolveInfo, req, res);
            }
        });
        this.router.post('/*', async (req, res) => {
            let path = '';
            if (req.params[0] !== undefined) {
                path = req.params[0].split('/')[0];
            }
            let resolveInfo = await this.getResolveInfo(path);
            return this.tablePost(resolveInfo, req, res);
        });
        this.router.put('/*', async (req, res) => {
            let path = '';
            if (req.params[0] !== undefined) {
                path = req.params[0].split('/')[0];
            }
            let resolveInfo = await this.getResolveInfo(path);
            return this.tablePut(resolveInfo, req, res);
        });
        this.router.delete('/*', async (req, res) => {
            let path = '';
            if (req.params[0] !== undefined) {
                path = req.params[0].split('/')[0];
            }
            let resolveInfo = await this.getResolveInfo(path);
            return this.tableDelete(resolveInfo, req, res);
        });
    }

    async getResolveInfo(path) {
        let result = {};
        if (path !== undefined) {
            for (let resolveInfo of this.resolveInfos) {
                if (resolveInfo.path === path) {
                    result = resolveInfo;
                    break;
                }
            }
        }
        return result;
    }

    async tableDefinitionGet(resolveInfo, req, res) {
        let verifyResult = await this.restUtil.verifyToken(req, res);
        if (!verifyResult.auth) {
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

    async tableGet(resolveInfo, req, res) {
        if (req.path === '/') {
            return res.json({});
        }
        let verifyResult = await this.restUtil.verifyToken(req, res);
        if(!verifyResult.auth) {
            return res.status(401).send(verifyResult);
        }
        const modelName = resolveInfo.parameters.model_name;

        // ユーザーモデルの場合は、特別な処理を行う
        let result = {};
        const model = await this.modelManager.getModel(modelName);
        if (modelName === 'user') {
            result = await this.getUser(req, res);
        } else {

            // all の場合は、全てのモデルを取得する
            if (resolveInfo.path === 'all') {
                result = this.modelManager.models;
                result = await this.filterModelsByUser(result, verifyResult);
                for (let model of result) { // connectionは外部に出さない
                    delete model.connection;
                };
                return res.json(result);
            }

            if (!model) {
                return res.status(404).send({ message: 'Model not found' });
            }
            if (model.tableDefinition.scope !== Table.TABLE_SCOPE_PUBLIC) {
                // アクセストークンの検証
                if (!verifyResult.auth) {
                    return res.status(401).send(verifyResult);
                }
            }
        }

        const queryParams = req.query;
        const filter = {};
        for (const [key, value] of Object.entries(queryParams)) {
            // 予約語を除外（ここはあとでテーブルで管理するように変更する）
            if(key === 'current_page' || key === 'record_limit' || key === 'writeable') {
                continue;
            }
            filter[key] = value;
        }

        // アクセス権の確認(読み取り)
        let readable = await this.restUtil.isAccessibleModel(model, verifyResult, 'read');
        // アクセス権の確認(書き込み)
        let writeable = await this.restUtil.isAccessibleModel(model, verifyResult, 'write');

        if (! readable) {
            return result; // アクセス権がない場合は空の配列を返す
        }

        if (model.tableDefinition.fields.some(field => field.name === 'user_domain_id')) {
            let value = [];
            for (let domain_id of verifyResult.user_domains) {
                value.push(domain_id);
            }
            filter['user_domain_id'] = value;
        }

        // ページングの設定
        const recordLimit = queryParams.record_limit || process.env.TABLE_PAGE_LINES;
        const currentPage = queryParams.current_page || 1;

        const offset = (currentPage - 1) * recordLimit;

        // レコードの取得
        result = await model.get(
            filter, recordLimit, offset
        );

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

        // ページ情報の取得
        const pagingInfo = await model.getPagingInfo(
            filter, recordLimit, currentPage
        );

        result = {
            data: result,
            pagingInfo: pagingInfo,
            writeable: writeable,
            tableDefinition: model.tableDefinition
        };
        res.json(result);
    }

    async tablePost(resolveInfo, req, res) {
        console.log('tablePost', resolveInfo.path);
        res.send(resolveInfo);
    }

    async tablePut(resolveInfo, req, res) {
        console.log('tablePut', resolveInfo.path);
        res.send(resolveInfo);
    }

    async tableDelete(resolveInfo, req, res) {
        console.log('tableDelete', resolveInfo.path);
        res.send(resolveInfo);
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

            return result;

        } catch (err) {
            console.error('Error fetching model data:', err);
            res.status(500).send({ message: 'Internal server error' });
        }
    }


    // ユーザーがアクセス可能なモデルのみを返す
    async filterModelsByUser(data, verifyResult) {
        let isSystemUser = verifyResult.user_domains.includes(RestUtil.SYSTEM_DOMAIN_ID);
        let isAdmin = verifyResult.user.admin_flag === 1;

        // システムユーザーは全てのモデルにアクセス可能
        if (isSystemUser) {
            return data;
        }

        let result = [];

        // 管理者ユーザーはmodel.user_scopeが
        // USER_SCOPE_SYSTEM_ADMIN_READWRITEを覗く全てのモデルにアクセス可能
        if (isAdmin) {
            for (let model of data) {
                if (model.tableDefinition.user_scope !== Table.USER_SCOPE_SYSTEM_ADMIN_READWRITE) {
                    result.push(model);
                }
            }
        }

        // 通常ユーザーはmodel.user_scopeが
        // USER_SCOPE_READONLYとUSER_SCOPE_READWRITEのモデルにアクセス可能
        else {
            for (let model of data) {
                if (model.tableDefinition.user_scope === Table.USER_SCOPE_USER_READONLY
                    || model.tableDefinition.user_scope === Table.USER_SCOPE_USER_READWRITE) {
                    result.push(model);
                }
            }
        }

        return result;
    }

    // ユーザーがアクセス可能なレコードのみを返す
    async filterRecordsByUser(data, verifyResult) {
        let userDomainIds = verifyResult.user_domains

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
