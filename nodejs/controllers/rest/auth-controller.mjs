import express from 'express';
import jwt from 'jsonwebtoken';
import * as credential from '../credential.mjs';
import { RestUtil } from './rest-util.mjs';

let modelManager = undefined;
let restUtil = undefined;

function createAuthController(manager) {
    const AuthController = express.Router();
    modelManager = manager;
    restUtil = new RestUtil(manager);

    /**
     * リフレッシュトークンを使用して新しいアクセストークンを取得するエンドポイント
     */
    AuthController.post('/refresh-token', async (req, res) => {
        const user_name = req.headers['x-user'];
        const refreshToken = req.cookies['x-refresh-token'];

        if (!refreshToken) {
            return res.status(400).send('Refresh token is required');
        }

        if (!user_name) {
            return res.status(400).send('User information is required');
        }

        try {
            const userTable = await modelManager.getModel('user');
            const user = await userTable.get({ "user_name": user_name });

            if (user.length === 0) {
                return res.status(404).send('User not found');
            }

            const secretKey = user[0].secret_key;
            const decoded = jwt.verify(refreshToken, secretKey);
            const password = user[0].user_password;

            if (decoded.user !== user_name || decoded.password !== password) {
                return res.status(401).send('Invalid refresh token');
            }

            const newAccessToken = credential.generateToken({ user: user_name, password, type: 'access_token' }, secretKey, '1d');
            const newRefreshToken = credential.generateToken({ user: user_name, password, type: 'refresh_token' }, secretKey, '90d');

            // 新しいリフレッシュトークンをHTTP Only Cookieに設定
            res.cookie('x-refresh-token', newRefreshToken, { sameSite: 'Strict' });
            res.cookie('x-access-token', newAccessToken, { sameSite: 'Strict' });
            res.cookie('x-user', user_name, { sameSite: 'Strict' });
            res.send({ accessToken: newAccessToken });

        } catch (err) {
            console.error('Refresh token error', err.stack);
            res.status(400).send('Invalid refresh token');
        }
    });

    AuthController.get('/encrypt-password', async (req, res) => {
        let verifyResult = await restUtil.verifyToken(req, res);
        if(!verifyResult.auth) {
            return res.status(401).send('Unauthorized');
        }
        const password = req.query.password;
        if (!password) {
            return res.status(400).send('Password is required');
        }

        const encrypted = await credential.hashPassword(password);
        res.send({ encrypted });
    });

    return AuthController;
}

export { createAuthController };
