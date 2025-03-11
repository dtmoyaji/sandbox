import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import request from 'request';

dotenv.config();

class LineworksJWT {

    user_domain_id = -1;
    modelManager = undefined;
    router = undefined;
    debug_log = false;

    constructor(modelManager) {
        this.modelManager = modelManager
    }

    async getLineWorksBotSetting(user_domain_id) {
        let lineworks_bot_setting = await this.modelManager.getModel('lineworks_bot_setting');
        let lineworksBotSetting = await lineworks_bot_setting.get({ user_domain_id: user_domain_id });
        if (lineworksBotSetting.length === 0) {
            console.log("lineworks_bot_setting is not found.");
            return undefined;
        }
        return lineworksBotSetting[0];
    }

    /**
     * デバッグモードの時にログを出力する。
     * @param {*} message 
     */
    debugLog(message) {
        if (this.debug_log) {
            if (message !== undefined) {
                console.log(message);
            } else {
                console.log();
            }
        }
    }

    /**
     * jwtでアクセストークンを取得する。
     * privatekeyはDBから取得する。
     * ハッシュアルゴリズムはRS256を用いる。
     * @return {Promise<string>} アクセストークン
     */
    async getAccessToken(lineworks_bot_setting) {
        let jwtHeader = { "alg": "RS256", "typ": "JWT" };
        this.debugLog("JWT_HEADER:");
        this.debugLog(JSON.stringify(jwtHeader));
        this.debugLog();

        let jwtClaimSet = {
            "iss": lineworks_bot_setting.lineworks_client_id,
            "sub": lineworks_bot_setting.lineworks_service_account_id,
            "iat": Math.floor(Date.now() / 1000),
            "exp": Math.floor(Date.now() / 1000) + 60 * 60
        };

        this.debugLog("JWT_CLAIMSET:");
        this.debugLog(JSON.stringify(jwtClaimSet));
        this.debugLog();

        // DBから秘密鍵を取得
        let privateKey = lineworks_bot_setting.lineworks_private_key;
        // 改行コードを置換
        privateKey = privateKey.replace(/\\n/g, '\n');

        this.debugLog("PRIVATE_KEY:");
        this.debugLog(privateKey);
        this.debugLog();

        // \nを改行に変換する。
        let assertion = jwt.sign(
            jwtClaimSet,
            privateKey,
            { algorithm: 'RS256', header: jwtHeader }
        );
        this.debugLog("ASSERTION:");
        this.debugLog(assertion);
        this.debugLog();

        // LineworksにPOSTし、アクセストークンを取得する。
        let options = {
            url: 'https://auth.worksmobile.com/oauth2/v2.0/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                "assertion": assertion,
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "client_id": lineworks_bot_setting.lineworks_client_id,
                "client_secret": lineworks_bot_setting.lineworks_client_secret,
                "scope": lineworks_bot_setting.lineworks_scope
            }
        };
        this.debugLog("POST_OPTIONS:");
        this.debugLog(JSON.stringify(options));
        this.debugLog();
        return new Promise((resolve, reject) => {
            request.post(options, (error, response, body) => {
                this.debugLog("POST_RESPONSE:");
                this.debugLog(JSON.stringify(response));
                this.debugLog();
                if (error) {
                    reject(error);
                } else {
                    this.debugLog("POST_BODY:");
                    this.debugLog(body);
                    this.debugLog();
                    try {
                        const parsedBody = JSON.parse(body);
                        if (parsedBody.access_token) {
                            resolve(parsedBody.access_token);
                        } else {
                            reject(new Error('Access token not found in response'));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse response body'));
                    }

                }
            });
        });
    }
}

export default LineworksJWT;

