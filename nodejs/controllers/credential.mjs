import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

/**
 * JWTトークンを検証する非同期関数
 * @param {string} secretKey - トークン検証に使用する秘密鍵
 * @param {string} token - 検証するJWTトークン
 * @returns {Promise<object>} 検証結果を含むオブジェクト
 * @throws {Error} トークン検証中にエラーが発生した場合
 */
export async function verifyJWT(secretKey, token) {
    if (!token) {
        return { auth: false, message: 'No token provided.' };
    }

    try {
        const decoded = await jwt.verify(token, secretKey);
        return { auth: true, message: 'Token authenticated.', decoded };
    } catch (err) {
        return { 
            auth: false, 
            message: 'Failed to authenticate token.', 
            error: err.message,
            code: err.name === 'TokenExpiredError' ? 'EXPIRED' : 'INVALID'
        };
    }
}

/**
 * JWTトークンを生成する関数
 * @param {object} payload - トークンに含めるペイロード
 * @param {string} secretKey - トークン生成に使用する秘密鍵
 * @param {string} [expiresIn='1d'] - トークンの有効期限（デフォルトは1日）
 * @param {object} [options={}] - 追加のJWTオプション
 * @returns {string} 生成されたJWTトークン
 */
export function generateToken(payload, secretKey, expiresIn = '1d', options = {}) {
    return jwt.sign(payload, secretKey, { expiresIn, ...options });
}

/**
 * パスワードを使って秘密鍵を生成する関数
 * @param {string} password - パスワード
 * @param {string} [salt] - ソルト（省略した場合は自動生成）
 * @param {number} [keyLength=32] - 生成する鍵の長さ
 * @param {number} [iterations=100000] - 反復回数
 * @returns {Promise<{key: string, salt: string}>} 生成された秘密鍵とソルト
 */
export async function generateSecretKey(password, salt = null, keyLength = 32, iterations = 100000) {
    // より安全なキー長とハッシュアルゴリズム（SHA-256）を使用
    const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
    
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, generatedSalt, iterations, keyLength, 'sha256', (err, derivedKey) => {
            if (err) reject(err);
            resolve({
                key: derivedKey.toString('hex'),
                salt: generatedSalt
            });
        });
    });
}

/**
 * パスワードをハッシュ化する非同期関数
 * @param {string} password - ハッシュ化するパスワード
 * @param {number} [saltRounds=12] - ソルトラウンド数（セキュリティレベル）
 * @returns {Promise<string>} ハッシュ化されたパスワード
 */
export async function hashPassword(password, saltRounds = 12) {
    return bcrypt.hash(password, saltRounds);
}

/**
 * パスワードを検証する非同期関数
 * @param {string} password - 検証するパスワード
 * @param {string} hash - ハッシュ化されたパスワード
 * @returns {Promise<boolean>} パスワードが一致する場合はtrue、一致しない場合はfalse
 */
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * 安全なランダムトークンを生成する関数
 * @param {number} [length=32] - トークンの長さ
 * @returns {string} 生成されたランダムトークン
 */
export function generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

