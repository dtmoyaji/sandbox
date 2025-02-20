import { Table } from '../../models/table.mjs';
import * as credential from '../credential.mjs';

class RestUtil {

    static SYSTEM_DOMAIN_ID = 1;
    static INFO_SYSTEM_DOMAIN_USER = 'System domain user';
    static INFO_DOMAIN_USER = 'Domain user';

    modelManager = null;

    constructor(modelManager) {
        this.modelManager = modelManager;
    }

    /**
     * アクセストークンを検証する関数
     * @param {*} req 
     * @param {*} res 
     * @returns {Promise<object>} 検証結果
     */
    async verifyToken(req, res) {
        let user = this.getRequestParameter(req, 'x-user');
        let token = this.getRequestParameter(req, 'x-access-token');

        let verifyResult = await this.modelManager.verifyToken(token, user, 'access_token');

        if (verifyResult.auth) {
            if (!res.headersSent) {
                const newAccessToken = await credential.generateToken(
                    { user, password: verifyResult.user.user_password, type: 'access_token' }
                    , verifyResult.user.secret_key, '1d');
                res.cookie('x-access-token', newAccessToken, { sameSite: 'Strict' });
            }
        }
        return verifyResult;
    }

    /**
     * ヘッダーまたはクッキーからリクエストパラメータを取得する
     * @param {*} req
     * @param {*} name 
     * @returns パラメータ。見つからない場合はundefined
     */
    getRequestParameter(req, name) {
        let value = req.headers[name];
        if (!value) {
            value = req.cookies[name];
        }
        return value;
    }

    /**
     * ユーザーが指定されたモデルにアクセス可能かどうかを判定する.
     * テーブル上のuser_scopeによってアクセス権を判定する.
     * @param {*} application_id 
     * @param {*} verifyResult
     * @returns {boolean} アクセス可能な場合はtrue, それ以外はfalse
     */
    async isAccessibleModel(model, verifyResult, mode='read') {
        let isSystemUser = verifyResult.user_domains.includes(RestUtil.SYSTEM_DOMAIN_ID);
        let isAdmin = verifyResult.user.admin_flag === 1;
        
        // システムユーザーは全てのモデルにアクセス可能
        if(isSystemUser) {
            return true;
        }

        // 管理者ユーザーはmodel.user_scopeが
        // USER_SCOPE_SYSTEM_ADMIN_READWRITEを覗く全てのモデルにアクセス可能
        if(isAdmin) {
            if(model.tableDefinition.user_scope !== Table.USER_SCOPE_SYSTEM_ADMIN_READWRITE) {
                return true;
            }
        }
        // その他のユーザーは、USER_SCOPE_READONLY, USER_SCOPE_READWRITEのモデルにアクセス可能
        else{
            // mode == 'read'の場合
            if(mode === 'read' 
                && (model.tableDefinition.user_scope === Table.USER_SCOPE_USER_READONLY
                || model.tableDefinition.user_scope === Table.USER_SCOPE_USER_READWRITE)
            ) {
                return true;
            }
            // mode == 'write'の場合
            if(mode === 'write' && model.tableDefinition.user_scope === Table.USER_SCOPE_USER_READWRITE) {
                return true;
            }
        }
        return false;
    }
}

export {
    RestUtil
};
