import { Table } from '../../models/table.mjs';
import * as credential from '../credential.mjs';

/**
 * RESTful APIユーティリティクラス
 * セキュリティとアクセス制御の機能を提供
 */
class RestUtil {
    // アクセス制御用の定数
    static SYSTEM_DOMAIN_ID = 1;
    static INFO_SYSTEM_DOMAIN_USER = 'System domain user';
    static INFO_DOMAIN_USER = 'Domain user';

    // アクセスモード
    static ACCESS_MODE_READ = 'read';
    static ACCESS_MODE_WRITE = 'write';
    static ACCESS_MODE_ADMIN = 'admin';

    /**
     * @type {import('../model-manager.mjs').default}
     * @private
     */
    #modelManager = null;

    /**
     * @param {import('../model-manager.mjs').default} modelManager モデルマネージャインスタンス
     */
    constructor(modelManager) {
        this.#modelManager = modelManager;
    }

    /**
     * アクセストークンを検証する関数
     * @param {object} req - HTTPリクエストオブジェクト
     * @param {object} res - HTTPレスポンスオブジェクト
     * @param {object} [options={}] - 検証オプション
     * @param {boolean} [options.requireAdmin=false] - 管理者権限を要求するか
     * @param {boolean} [options.refreshToken=true] - トークンを自動更新するか
     * @returns {Promise<object>} 検証結果
     */
    async verifyToken(req, res, options = {}) {
        const { requireAdmin = false, refreshToken = true } = options;

        try {
            // トークンとユーザー情報の取得（複数の場所から）
            const token = this.getRequestParameter(req, 'x-access-token') || 
                          req.headers['authorization']?.replace('Bearer ', '');
                          
            const username = this.getRequestParameter(req, 'x-user');

            if (!token) {
                return { 
                    auth: false, 
                    message: 'No token provided',
                    code: 'TOKEN_MISSING'
                };
            }

            if (!username) {
                return { 
                    auth: false, 
                    message: 'No user information provided',
                    code: 'USER_MISSING'
                };
            }

            // ユーザー情報を取得
            const userTable = await this.#modelManager.getModel('user');
            const users = await userTable.get({ "user_name": username });

            if (users.length === 0) {
                return { 
                    auth: false, 
                    message: 'User not found',
                    code: 'USER_NOT_FOUND'
                };
            }

            const user = users[0];
            const secretKey = user.secret_key;

            // トークン検証
            const verifyResult = await credential.verifyJWT(secretKey, token);
            if (!verifyResult.auth) {
                return {
                    auth: false,
                    message: verifyResult.message,
                    code: verifyResult.code || 'INVALID_TOKEN'
                };
            }

            // トークンの種類チェック
            if (verifyResult.decoded.type !== 'access_token') {
                return {
                    auth: false,
                    message: 'Invalid token type',
                    code: 'INVALID_TOKEN_TYPE'
                };
            }

            // ユーザー情報の一致確認
            if (verifyResult.decoded.username !== user.user_name) {
                return {
                    auth: false,
                    message: 'Token does not match user',
                    code: 'USER_MISMATCH'
                };
            }

            // 管理者権限チェック（必要な場合）
            if (requireAdmin && (!user.admin_flag || user.admin_flag !== 1)) {
                return {
                    auth: false,
                    message: 'Admin privileges required',
                    code: 'ADMIN_REQUIRED'
                };
            }

            // ユーザードメイン情報の取得
            const userDomains = await this.#getUserDomains(user.id);
            
            // 認証成功
            const result = {
                auth: true,
                message: 'Token authenticated',
                user,
                user_domains: userDomains,
                decoded: verifyResult.decoded
            };

            // トークン自動更新（レスポンスヘッダーがまだ送信されていない場合）
            if (refreshToken && !res.headersSent) {
                try {
                    // 新しいアクセストークンを生成
                    const payload = {
                        userId: user.id,
                        username: user.user_name,
                        roles: user.roles || [],
                        type: 'access_token'
                    };
                    
                    const newAccessToken = credential.generateToken(payload, secretKey, '1d');
                    
                    // HTTPOnlyクッキーとして設定
                    res.cookie('x-access-token', newAccessToken, { 
                        httpOnly: true, 
                        sameSite: 'Strict',
                        maxAge: 24 * 60 * 60 * 1000 // 1日
                    });
                    
                    // レスポンスヘッダーにも設定
                    res.setHeader('X-New-Access-Token', newAccessToken);
                } catch (refreshErr) {
                    console.error('Failed to refresh token:', refreshErr);
                    // トークン更新エラーは認証自体の失敗ではないので無視
                }
            }

            return result;
        } catch (err) {
            console.error('Token verification error:', err);
            return {
                auth: false,
                message: 'Authentication error',
                error: err.message,
                code: 'AUTH_ERROR'
            };
        }
    }

    /**
     * ユーザーのドメイン情報を取得する
     * @param {number|string} userId - ユーザーID
     * @returns {Promise<number[]>} ユーザードメインIDの配列
     * @private
     */
    async #getUserDomains(userId) {
        try {
            const userDomainLinkTable = await this.#modelManager.getModel('user_domain_link');
            const links = await userDomainLinkTable.get({ user_id: userId });
            return links.map(link => link.domain_id);
        } catch (err) {
            console.error('Error getting user domains:', err);
            return [];
        }
    }

    /**
     * ヘッダーまたはクッキーからリクエストパラメータを取得する
     * @param {object} req - HTTPリクエストオブジェクト
     * @param {string} name - パラメータ名
     * @returns {string|undefined} パラメータ値。見つからない場合はundefined
     */
    getRequestParameter(req, name) {
        // 優先順位: ヘッダー > クッキー > クエリ > ボディ
        return req.headers[name] || 
               req.cookies?.[name] || 
               req.query?.[name] || 
               req.body?.[name];
    }

    /**
     * ユーザーが指定されたモデルにアクセス可能かどうかを判定する
     * @param {object} model - アクセスするモデル
     * @param {object} verifyResult - トークン検証結果
     * @param {string} [mode='read'] - アクセスモード ('read'|'write'|'admin')
     * @returns {Promise<boolean>} アクセス可能な場合はtrue、それ以外はfalse
     */
    async isAccessibleModel(model, verifyResult, mode = RestUtil.ACCESS_MODE_READ) {
        if (!verifyResult || !verifyResult.auth || !verifyResult.user) {
            return false;
        }
        
        const isSystemUser = verifyResult.user_domains?.includes(RestUtil.SYSTEM_DOMAIN_ID) || false;
        const isAdmin = verifyResult.user.admin_flag === 1;
        
        // システムドメインユーザーは全てのモデルにアクセス可能
        if (isSystemUser) {
            return true;
        }

        // 管理者権限チェック
        if (isAdmin) {
            // 管理者モードでのアクセスチェック
            if (mode === RestUtil.ACCESS_MODE_ADMIN) {
                return model.tableDefinition.user_scope !== Table.USER_SCOPE_SYSTEM_ADMIN_READWRITE;
            }
            
            // 管理者は一般ユーザーが読み書き可能なモデルにもアクセス可能
            return true;
        }

        // 一般ユーザーのアクセス権チェック
        const userScope = model.tableDefinition.user_scope;
        
        // 読み取りモード
        if (mode === RestUtil.ACCESS_MODE_READ) {
            return userScope === Table.USER_SCOPE_USER_READONLY || 
                   userScope === Table.USER_SCOPE_USER_READWRITE;
        }
        
        // 書き込みモード
        if (mode === RestUtil.ACCESS_MODE_WRITE) {
            return userScope === Table.USER_SCOPE_USER_READWRITE;
        }
        
        // 管理者モード（一般ユーザーはアクセス不可）
        return false;
    }

    /**
     * レスポンスにエラーを設定して返す
     * @param {object} res - HTTPレスポンスオブジェクト
     * @param {number} statusCode - HTTPステータスコード
     * @param {string} message - エラーメッセージ
     * @param {string} [code] - エラーコード
     * @param {object} [details] - 追加のエラー詳細（開発環境のみ）
     */
    sendError(res, statusCode, message, code = null, details = null) {
        const response = {
            success: false,
            message
        };
        
        if (code) {
            response.code = code;
        }
        
        // 開発環境のみ詳細なエラー情報を含める
        if (details && process.env.NODE_ENV === 'development') {
            response.details = details;
        }
        
        res.status(statusCode).json(response);
    }
}

export { RestUtil };
