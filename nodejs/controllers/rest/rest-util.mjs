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

        let verfyResult = await this.modelManager.verifyToken(token, user, 'access_token');

        if (verfyResult.auth) {
            if (!res.headersSent) {
                const newAccessToken = await credential.generateToken(
                    { user, password: verfyResult.user.user_password, type: 'access_token' }
                    , verfyResult.user.secret_key, '1d');
                res.cookie('x-access-token', newAccessToken, { sameSite: 'Strict' });
            }
        }
        return verfyResult;
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
     * @param {*} model_domain_id 
     * @param {*} user_id 
     * @returns 
     */
    async isAccessibleModel(model_domain_id, user_id) {
        let result = { accessible: false, info: '', admin_flag: 0, user_domain_ids: [] };

        let userTable = await this.modelManager.getModel('user');
        let user = (await userTable.get({ user_id: user_id }))[0];
        if (!user) {
            result.accessible = false;
            result.info = 'User not found';
            result.admin_flag = 0;
        } else {
            let user_domain_link = await this.modelManager.getModel('user_domain_link');
            let user_domains = await user_domain_link.get({ user_id: user_id });
            result.admin_flag = user.admin_flag;

            // 権限が強い方の情報を残すため、ループは２つに分ける
            // ユーザーの所属ドメインに一致するモデルかどうか
            for (let user_domain of user_domains) {
                if (user_domain.user_domain_id === model_domain_id) {
                    result.accessible = true;
                    result.info = RestUtil.INFO_DOMAIN_USER;
                }
                result.user_domain_ids.push(user_domain);
            }
            // ユーザーがシステムドメインに所属するかどうか
            for (let user_domain of user_domains) {
                if (user_domain.user_domain_id === RestUtil.SYSTEM_DOMAIN_ID) {
                    result.accessible = true;
                    result.info = RestUtil.INFO_SYSTEM_DOMAIN_USER;
                    break;
                }
            }
        }
        return result;
    }

}

export {
    RestUtil
};
