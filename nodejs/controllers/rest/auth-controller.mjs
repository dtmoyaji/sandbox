import express from 'express';
import * as credential from '../credential.mjs';
import { RestUtil } from './rest-util.mjs';

/**
 * 認証コントローラーを作成する関数
 * @param {object} manager - モデルマネージャーインスタンス
 * @returns {express.Router} 認証用Expressルーター
 */
function createAuthController(manager) {
    const AuthController = express.Router();
    const modelManager = manager;
    const restUtil = new RestUtil(manager);

    /**
     * ログイン認証エンドポイント
     */
    AuthController.post('/login', async (req, res) => {
        try {
            const username = req.body.username;
            const password = req.body.password;

            if (!username || !password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ユーザー名とパスワードは必須です' 
                });
            }

            const userTable = await modelManager.getModel('user');
            const users = await userTable.get({ "user_name": username });

            if (users.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    message: '認証に失敗しました。ユーザー名またはパスワードが正しくありません。' 
                });
            }

            const user = users[0];
            const passwordMatch = await credential.verifyPassword(password, user.user_password);

            if (!passwordMatch) {
                return res.status(401).json({ 
                    success: false, 
                    message: '認証に失敗しました。ユーザー名またはパスワードが正しくありません。' 
                });
            }

            // セキュリティ向上のため、パスワードやその他の機密データはペイロードに含めない
            const payload = { 
                userId: user.user_id,
                username: user.user_name,
                roles: user.roles || [],
                type: 'access_token'
            };

            // secret_keyが存在しない場合は新しく生成する
            let secretKey = user.secret_key;
            
            if (!secretKey) {
                const secretKeyObj = await credential.generateSecretKey(user.user_password);
                // generateSecretKeyが返すオブジェクトからkeyプロパティを取得
                if (typeof secretKeyObj === 'object' && secretKeyObj !== null && secretKeyObj.key) {
                    secretKey = secretKeyObj.key;
                } else {
                    // オブジェクトでない場合はそのまま使用
                    secretKey = secretKeyObj;
                }
                
                // 文字列に変換して長さを制限
                if (typeof secretKey !== 'string') {
                    secretKey = String(secretKey);
                }
                secretKey = secretKey.substring(0, 255);
                
                // secret_keyをユーザーレコードに保存
                await userTable.put({
                    user_id: user.user_id,
                    secret_key: secretKey
                });
            } else if (typeof secretKey === 'object' && secretKey !== null) {
                // 既存のsecret_keyがオブジェクトの場合はkeyプロパティを使用
                if (secretKey.key) {
                    secretKey = secretKey.key;
                } else {
                    secretKey = JSON.stringify(secretKey);
                }
                // 長さを制限
                secretKey = secretKey.substring(0, 255);
            }
            
            const accessToken = credential.generateToken(payload, secretKey, '1d');
            
            // リフレッシュトークンには最小限の情報のみを含める
            const refreshToken = credential.generateToken({ 
                userId: user.user_id, 
                type: 'refresh_token' 
            }, secretKey, '90d');

            // HTTPOnly + SecureオプションでCookieを設定（本番環境ではSecure: trueを推奨）
            res.cookie('x-refresh-token', refreshToken, { 
                httpOnly: true, 
                sameSite: 'Strict',
                maxAge: 90 * 24 * 60 * 60 * 1000 // 90日
            });
            
            res.cookie('x-access-token', accessToken, { 
                httpOnly: true, 
                sameSite: 'Strict',
                maxAge: 24 * 60 * 60 * 1000 // 1日
            });
            
            // ユーザー名はhttpOnlyでないCookieに設定（UIでの表示用）
            res.cookie('x-user', username, { 
                sameSite: 'Strict',
                maxAge: 90 * 24 * 60 * 60 * 1000 // 90日
            });

            res.json({ 
                success: true, 
                accessToken,
                user: {
                    id: user.user_id,
                    username: user.user_name,
                    roles: user.roles || []
                }
            });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ 
                success: false, 
                message: 'サーバーエラーが発生しました' 
            });
        }
    });

    /**
     * リフレッシュトークンを使用して新しいアクセストークンを取得するエンドポイント
     */
    AuthController.post('/refresh-token', async (req, res) => {
        try {
            // クッキーまたはヘッダーからリフレッシュトークンを取得
            const refreshToken = req.cookies['x-refresh-token'] || 
                                req.headers['x-refresh-token'] || 
                                restUtil.getRequestParameter(req, 'x-refresh-token');
            
            const username = req.cookies['x-user'] || 
                            req.headers['x-user'] || 
                            restUtil.getRequestParameter(req, 'x-user');

            if (!refreshToken) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Refresh token is required' 
                });
            }

            if (!username) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'User information is required' 
                });
            }

            const userTable = await modelManager.getModel('user');
            const users = await userTable.get({ "user_name": username });

            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }

            const user = users[0];
            const secretKey = user.secret_key;

            // リフレッシュトークンを検証
            const verifyResult = await credential.verifyJWT(secretKey, refreshToken);
            if (!verifyResult.auth) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid refresh token',
                    code: verifyResult.code
                });
            }

            // トークンタイプを検証
            if (verifyResult.decoded.type !== 'refresh_token') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid token type' 
                });
            }

            // ユーザーIDの一致を確認
            if (verifyResult.decoded.userId !== user.id) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token does not match user' 
                });
            }

            // 新しいアクセストークンとリフレッシュトークンを生成
            const payload = { 
                userId: user.id,
                username: user.user_name,
                roles: user.roles || [],
                type: 'access_token'
            };
            
            const newAccessToken = credential.generateToken(payload, secretKey, '1d');
            const newRefreshToken = credential.generateToken({ 
                userId: user.id, 
                type: 'refresh_token' 
            }, secretKey, '90d');

            // HTTPOnly + SecureオプションでCookieを設定
            res.cookie('x-refresh-token', newRefreshToken, { 
                httpOnly: true, 
                sameSite: 'Strict',
                maxAge: 90 * 24 * 60 * 60 * 1000 // 90日
            });
            
            res.cookie('x-access-token', newAccessToken, { 
                httpOnly: true, 
                sameSite: 'Strict',
                maxAge: 24 * 60 * 60 * 1000 // 1日
            });

            res.json({ 
                success: true, 
                accessToken: newAccessToken 
            });
        } catch (err) {
            console.error('Refresh token error:', err);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error' 
            });
        }
    });

    /**
     * ログアウトエンドポイント
     */
    AuthController.post('/logout', (req, res) => {
        // すべての認証関連Cookieをクリア
        res.clearCookie('x-refresh-token');
        res.clearCookie('x-access-token');
        res.clearCookie('x-user');
        
        res.json({ success: true, message: 'Logged out successfully' });
    });

    /**
     * パスワードをハッシュ化するエンドポイント（管理者専用）
     */
    AuthController.get('/encrypt-password', async (req, res) => {
        try {
            // トークン検証（管理者権限確認が必要）
            const verifyResult = await restUtil.verifyToken(req, res);
            if (!verifyResult.auth) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Unauthorized' 
                });
            }

            // 管理者権限チェック（実装例）
            if (!verifyResult.decoded.roles || !verifyResult.decoded.roles.includes('admin')) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Forbidden: Admin access required' 
                });
            }

            const password = req.query.password;
            if (!password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Password is required' 
                });
            }

            // より安全なソルトラウンドを使用
            const encrypted = await credential.hashPassword(password, 12);
            res.json({ success: true, encrypted });
        } catch (err) {
            console.error('Encrypt password error:', err);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error' 
            });
        }
    });

    /**
     * パスワードをリセットするためのトークンを生成するエンドポイント
     */
    AuthController.post('/generate-reset-token', async (req, res) => {
        try {
            const username = req.body.username;
            if (!username) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Username is required' 
                });
            }

            const userTable = await modelManager.getModel('user');
            const users = await userTable.get({ "user_name": username });

            if (users.length === 0) {
                // セキュリティのため、ユーザーが存在しなくても同じレスポンスを返す
                return res.json({ 
                    success: true, 
                    message: 'If the user exists, a reset token has been generated' 
                });
            }

            const user = users[0];
            // ランダムリセットトークンの生成
            const resetToken = credential.generateRandomToken(32);
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 1); // 1時間有効

            // リセットトークンをデータベースに保存（実装例）
            await userTable.update(
                { id: user.id },
                { 
                    reset_token: resetToken,
                    reset_token_expiry: tokenExpiry.toISOString() 
                }
            );

            // 本番環境では、ここでメール送信処理を実装

            res.json({ 
                success: true, 
                message: 'Reset token has been generated',
                // 開発環境でのみトークンを返す
                token: process.env.NODE_ENV === 'development' ? resetToken : undefined
            });
        } catch (err) {
            console.error('Generate reset token error:', err);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error' 
            });
        }
    });

    return AuthController;
}

export { createAuthController };
