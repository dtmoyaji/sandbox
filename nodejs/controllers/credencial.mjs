import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

/**
 * JWTトークンを検証する非同期関数
 * @param {string} token - 検証するJWTトークン
 * @returns {Promise<object>} 検証結果を含むオブジェクト
 */
export async function verifyJWT(secretKey, token) {
    let result = {};
    if (!token) {
        result = { auth: false, message: 'No token provided.' };
        return result;
    }

    try {
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, secretKey, (err, decoded) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            });
        });

        // トークンが有効な場合、リクエストにユーザー情報を追加
        result = { auth: true, message: 'Token authenticated.', decoded };
    } catch (err) {
        result = { auth: false, message: 'Failed to authenticate token.', error: err.message };
    }

    return result;
}

/**
 * JWTトークンを生成する関数
 * @param {object} payload - トークンに含めるペイロード
 * @param {string} [expiresIn='1h'] - トークンの有効期限（デフォルトは1時間）
 * @returns {string} 生成されたJWTトークン
 */
export function generateToken(payload, secretKey, expiresIn = '1d') {
    return jwt.sign(payload, secretKey, { expiresIn });
}

/**
 * パスワードを使って秘密鍵を生成する関数
 * @param {string} password - パスワード
 * @param {number} keyLength - 生成する鍵の長さ
 * @returns {Promise<string>} 生成された秘密鍵
 */
export async function generateSecretKey(password, keyLength = 16) {
    const iterations = 100000;
    let salt = crypto.randomBytes(keyLength).toString('hex');
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, keyLength, 'sha1', (err, derivedKey) => {
            if (err) reject(err);
            resolve(derivedKey.toString('hex').slice(0, keyLength)); // 切り詰める
        });
    });
}


/**
 * パスワードをハッシュ化する非同期関数
 * @param {string} password - ハッシュ化するパスワード
 * @returns {Promise<string>} ハッシュ化されたパスワード
 */
export async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

/**
 * パスワードを検証する非同期関数
 * @param {string} password - 検証するパスワード
 * @param {string} hash - ハッシュ化されたパスワード
 * @returns {Promise<boolean>} パスワードが一致する場合はtrue、一致しない場合はfalse
 */
export async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

