import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Connection } from '../models/connection.mjs'; // Connectionクラスをインポート
import { Table } from '../models/table.mjs';
import { verifyJWT } from './credential.mjs'; // verifyJWT関数をインポート

export class ModelManager {

    constructor() {
        this.__dirname = path.dirname(fileURLToPath(import.meta.url));
        this.__rootDir = path.join(this.__dirname, '..');
        this.Connection = new Connection();
        this.knex = this.Connection.knex;
        this.models = [];
    }

    // モデルを読み込むメソッド
    async reloadModels() {
        this.models = [];

        // システムテーブルの読み込み
        const tableDefDir = path.join(this.__rootDir, 'models', 'tabledef');
        let modelFiles = fs.readdirSync(tableDefDir);
        for (let modelFile of modelFiles) {
            let modelDef = JSON.parse(fs.readFileSync(path.join(tableDefDir, modelFile), 'utf8'));
            let model = new Table(this.Connection);
            await model.createTable(modelDef);
            model.application_id = 1; // システムドメインID
            this.models.push(model);
        }

        // アプリケーションテーブルの読み込み
        const applicationTables = await this.knex('application_tabledef').select('*');
        for (let domainTable of applicationTables) {
            let domainTableDef = JSON.parse(domainTable.tabledef);
            let model = new Table(this.Connection);
            await model.createTable(domainTableDef);
            model.application_id = domainTable.application_id;
            this.models.push(model);
        }
    }

    async getModel(name) {
        let matched = this.models.filter(model => model.table_name === name);
        return matched.length > 0 ? matched[0] : null;
    }

    /**
     * アクセストークンを検証する関数
     * @param {string} token - 検証するアクセストークン
     * @param {string} user - ユーザー名
     * @param {string} type - トークンの種類
     * @returns {Promise<object>} 検証結果
     */
    async verifyToken(token, user, type = 'access_token') {
        if (!token || !user) {
            return { auth: false, message: 'Authorization required' };
        }

        // ユーザー情報を取得
        const userTable = await this.getModel('user');
        const userRecord = await userTable.get({ user_name: user });

        if (userRecord.length === 0) {
            return {
                auth: false,
                message: 'Invalid user'
            };
        }

        // トークンを検証
        const secretKey = userRecord[0].secret_key;
        const result = await verifyJWT(secretKey, token);

        // トークンが無効な場合、エラーメッセージを返す
        if (!result.auth) {
            return result;
        }

        // タイプの異なるトークン代用は許可しない
        if (result.decoded.type !== type) {
            return { auth: false, message: 'Invalid token type' };
        }

        const password = result.decoded.password;

        // パスワードが一致しない場合、エラーメッセージを返す
        if (password !== userRecord[0].user_password) {
            return { auth: false, message: 'Invalid password' };
        }

        // ユーザーの所属ドメインIDを返す
        let userDomainLink = await this.getModel('user_domain_link');
        let userDomain = await userDomainLink.get({ user_id: userRecord[0].user_id });
        let userDomainIds = userDomain.map(ud => ud.user_domain_id);

        return { auth: true, user: userRecord[0], user_domains: userDomainIds };
    }

    // 事前登録したクエリを実行する
    async execQuery(queryName, params) {
        const query_template = await this.getModel('query_template');
        const query = await query_template.get({ name: queryName });
        let result = {};
        if (query.length > 0) {
            result = await this.knex.raw(query[0].query, params);
            result = result.rows;
        }
        return result;
    }

    // クエリのドメインIDをチェックする
    async checkQueryDomainId(queryName, user_id) {
        const query_template = await this.getModel('query_template');
        const query = await query_template.get({ name: queryName });
        const userDomainLink = await this.getModel('user_domain_link');
        const user = await userDomainLink.get({ user_id: user_id });
        const userDomainId = user[0].user_domain_id;
        if (query.length > 0) {
            if (query[0].user_domain_id !== userDomainId) {
                return false;
            }
        }
        return true;
    }

}

// モデルマネージャーをエクスポート
export default ModelManager;
