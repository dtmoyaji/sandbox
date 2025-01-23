import express from 'express';
import jwt from 'jsonwebtoken';
import * as credential from '../credential.mjs';

let modelManager = undefined;

function createAuthController(manager) {
    const AuthController = express.Router();
    modelManager = manager;

    /**
     * リフレッシュトークンを使用して新しいアクセストークンを取得するエンドポイント
     */
    AuthController.post('/refresh-token', async (req, res) => {
        const user_name = req.headers['x-user'];
        const refreshToken = req.cookies['refreshToken'];

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
            res.cookie('refreshToken', newRefreshToken, { sameSite: 'Strict' });
            res.cookie('message', 'Refresh token updated', { secure: true, sameSite: 'Strict' });
            res.send({ accessToken: newAccessToken });

        } catch (err) {
            console.error('Refresh token error', err.stack);
            res.status(400).send('Invalid refresh token');
        }
    });

    return AuthController;
}

export { createAuthController };
