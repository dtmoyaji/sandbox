import * as credential from '../credential.mjs';


class RestUtil {

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

}

export {
    RestUtil
};
