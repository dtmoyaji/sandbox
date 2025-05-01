import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { bootApplications, restoreData } from './application-boot.mjs';
import { UserApplication } from './controllers/app/userApplication.mjs';
import * as credential from './controllers/credential.mjs';
import { ImportCsvController } from './controllers/file/import-csv.mjs';
import { Logger } from './controllers/logger.mjs';
import { ModelManager } from './controllers/model-manager.mjs';
import { createAuthController } from './controllers/rest/auth-controller.mjs';
import { createModelController } from './controllers/rest/model-controller.mjs';
import { createQueryController } from './controllers/rest/query-controller.mjs';
import { Resolver } from './controllers/rest/resolver.mjs';
import { RestUtil } from './controllers/rest/rest-util.mjs';
import { ScriptExecutor } from './controllers/script/script-executer.mjs';
import { LineworksMessageSender } from './controllers/sns/lineworks/lineworks_message_sender.mjs';
import { WebSocket } from './controllers/websocket/websocket.mjs';
import PageRenderer from './views/renderer/page-renderer.mjs';

// 設定の読み込み
dotenv.config();
const config = {
    port: process.env.PORT || 3000,
    basePath: process.env.BASE_PATH || '',
    theme: process.env.THEME || 'default',
    environment: process.env.NODE_ENV || 'development',
    cookieSecure: process.env.NODE_ENV === 'production',
    cookieMaxAge: 86400000, // 24時間
    jwtExpiresIn: '1d'
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Application {
    constructor() {
        // Expressアプリケーションのインスタンスを作成
        this.app = express();
        this.components = null;
    }

    /**
     * アプリケーションの初期化を行う。
     * 必要なコンポーネントやコントローラーを初期化し、システムを準備する。
     */
    async initialize() {
        try {
            // モデルマネージャーの初期化
            const modelManager = new ModelManager();
            await modelManager.reloadModels();

            // 各コントローラーの初期化
            const restUtil = new RestUtil(modelManager);
            const modelController = await createModelController(modelManager);
            const authController = createAuthController(modelManager);
            const queryController = createQueryController(modelManager);

            // アプリケーションのブート処理
            await bootApplications(modelManager);
            await modelManager.reloadModels();
            await restoreData(modelManager);

            // ロガーとWebSocketの初期化
            const logger = new Logger(modelManager);
            const websocket = new WebSocket(this.app, logger);
            await websocket.bindWebSocket();

            // その他のコンポーネント初期化
            const scriptExecutor = new ScriptExecutor(modelManager, websocket);
            const pageRenderer = new PageRenderer(restUtil, modelManager);

            // 初期化したコンポーネントを保存
            this.components = {
                app: this.app,
                modelManager,
                restUtil,
                modelController,
                authController,
                queryController,
                logger,
                websocket,
                scriptExecutor,
                pageRenderer
            };

            return this.components;
        } catch (error) {
            throw new Error(`システム初期化エラー: ${error.message}`);
        }
    }

    /**
     * アプリケーションのミドルウェアを設定する。
     * セキュリティ、CORS、リクエストロギングなどを含む。
     */
    setupMiddleware() {
        const { app } = this;
        const { restUtil, logger } = this.components;

        // セキュリティ強化
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:"],
                }
            }
        }));

        // レスポンス圧縮
        app.use(compression());

        // CORS設定
        app.use(cors({
            origin: process.env.CORS_ORIGIN || '*',
            credentials: true
        }));

        // 静的ファイルの提供
        app.use(`/theme`, express.static(path.join(__dirname, config.theme)));

        // JSONとURLエンコードされたリクエストボディの解析
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // クッキーパーサーの設定
        app.use(cookieParser());

        // リクエストロギング
        app.use((req, res, next) => {
            logger.info(`${req.method} ${req.originalUrl}`);
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
            });
            next();
        });

        // 認証ミドルウェア
        const authMiddleware = async (req, res, next) => {
            try {
                const tokenCheck = await restUtil.verifyToken(req, res);
                if (!tokenCheck.auth) {
                    return res.redirect(`${config.basePath}/login`);
                }
                next();
            } catch (error) {
                logger.error('認証エラー:', error);
                res.redirect(`${config.basePath}/login`);
            }
        };

        return { authMiddleware };
    }

    /**
     * アプリケーションのルートを設定する。
     * 各エンドポイントやエラーハンドラを登録する。
     */
    async setupRoutes() {
        const { app } = this;
        const {
            modelManager,
            restUtil,
            authController,
            queryController,
            scriptExecutor,
            pageRenderer,
            logger,
            websocket
        } = this.components;

        // リゾルバの初期化
        const resolver = new Resolver(modelManager);
        await resolver.initializeResolvers();

        const importCsvController = new ImportCsvController(modelManager, websocket);
        await importCsvController.initializeResolvers();

        const userApplication = new UserApplication(restUtil, modelManager);
        await userApplication.initializeResolvers();

        // SNS関連コントローラー
        const lineworksMessageSender = new LineworksMessageSender(modelManager);

        // ミドルウェア設定
        const { authMiddleware } = this.setupMiddleware();

        // 各ルートの設定
        app.use('/app', userApplication.router);
        app.use('/api/script', scriptExecutor.router);
        app.use('/api/import', importCsvController.router);
        app.use('/api/models', resolver.router);
        app.use('/api/auth', authController);
        app.use('/api/query', queryController);
        app.use('/pageRenderer', pageRenderer.pageRouter);

        // システム情報ルート
        app.get('/', (req, res) => {
            const result = {
                system: "sandbox",
                version: process.env.APP_VERSION || "1.0.0",
                environment: config.environment
            };
            res.json(result);
        });

        // 汎用APIルート
        app.all('/api/*', this.handleApiRequest);

        // 管理画面ルート
        app.get(['/admin', '/admin/*'], authMiddleware, this.renderAdminPage(pageRenderer));

        // ログイン関連ルート
        this.setupAuthRoutes(modelManager);

        // 404ハンドラ
        app.use((req, res) => {
            logger.warn(`Route not found: ${req.originalUrl}`);
            res.status(404).json({ error: 'Not Found', path: req.originalUrl });
        });

        // グローバルエラーハンドラ
        app.use((err, req, res, next) => {
            logger.error('未処理エラー:', err);
            const response = {
                error: 'Internal Server Error',
                message: config.environment === 'development' ? err.message : undefined
            };
            res.status(500).json(response);
        });
    }

    /**
     * 汎用APIリクエストを処理する。
     * @param {Object} req - リクエストオブジェクト。
     * @param {Object} res - レスポンスオブジェクト。
     */
    handleApiRequest(req, res) {
        try {
            const path = req.params[0];
            const nameParts = path.split('/');
            const queryParams = req.query;

            if (nameParts[0]) {
                const result = {
                    params: nameParts,
                    query: queryParams,
                    body: req.body,
                    method: req.method
                };
                res.json(result);
            } else {
                res.status(404).json({ error: 'Not Found' });
            }
        } catch (error) {
            console.error('API処理エラー:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    /**
     * 管理画面をレンダリングする。
     * @param {Object} pageRenderer - ページレンダラーインスタンス。
     * @returns {Function} レンダリング関数。
     */
    renderAdminPage(pageRenderer) {
        return async (req, res) => {
            try {
                const renderResult = await pageRenderer.render(req, res);
                if (renderResult.status === 200) {
                    res.cookie('x-user', req.cookies['x-user']);
                    res.send(renderResult.body);
                } else {
                    res.status(renderResult.status || 500).send(renderResult.message || 'Internal Server Error');
                }
            } catch (error) {
                this.components.logger.error('管理画面レンダリングエラー:', error);
                res.status(500).send('Internal Server Error');
            }
        };
    }

    /**
     * 認証関連のルートを設定する。
     * @param {Object} modelManager - モデルマネージャーインスタンス。
     */
    setupAuthRoutes(modelManager) {
        const { app } = this;
        const cookieOptions = {
            httpOnly: true,
            secure: config.cookieSecure,
            sameSite: 'Strict',
            maxAge: config.cookieMaxAge
        };

        app.get('/login', (req, res) => {
            ejs.renderFile('views/auth/login.ejs',
                {
                    title: 'Login',
                    basePath: config.basePath,
                    redirectUrl: req.query.redirect || `${config.basePath}/admin`,
                    error: req.query.error || null
                },
                (err, str) => {
                    if (err) {
                        this.components.logger.error('ログインページエラー:', err);
                        res.status(500).send(err.message);
                    } else {
                        res.send(str);
                    }
                });
        });

        app.post('/login', async (req, res) => {
            try {
                console.log('ログイン処理開始:', req.body.username);
                const user = req.body.username;
                const password = req.body.password;
                const userTable = await modelManager.getModel('user');
                const registeredUser = await userTable.get({ user_name: user });
                console.log('ユーザー検索結果:', registeredUser.length > 0 ? 'ユーザー見つかりました' : 'ユーザー見つかりません');

                // リダイレクトURL設定
                let redirectUrl = req.body.redirectUrl;
                // undefined, null, 空文字の場合はデフォルトのURLを使用
                if (!redirectUrl) {
                    redirectUrl = '/admin';
                }
                
                // 先頭に / がない場合は追加
                if (!redirectUrl.startsWith('/')) {
                    redirectUrl = '/' + redirectUrl;
                }
                
                // リダイレクト先URLを設定（basePath を適切に付与）
                const fullRedirectUrl = `${config.basePath}${redirectUrl}`.replace(/\/\//g, '/');
                console.log('リダイレクト先URL:', fullRedirectUrl);

                if (registeredUser.length !== 0) {
                    const registeredPassword = registeredUser[0].user_password;
                    console.log('パスワード検証開始');
                    const passwordMatch = await credential.verifyPassword(password, registeredPassword);
                    console.log('パスワード検証結果:', passwordMatch ? '一致' : '不一致');
                    
                    if (passwordMatch) {
                        // secret_keyが存在しない場合は新しく生成する
                        let secretKey = registeredUser[0].secret_key;
                        console.log('既存のsecret_key:', secretKey ? '存在します' : '存在しません');
                        
                        if (!secretKey) {
                            // 新しいsecret_keyを生成
                            const secretKeyObj = await credential.generateSecretKey(registeredPassword);
                            
                            // オブジェクトからkeyプロパティを取得
                            if (typeof secretKeyObj === 'object' && secretKeyObj !== null && secretKeyObj.key) {
                                secretKey = secretKeyObj.key;
                            } else {
                                secretKey = secretKeyObj;
                            }
                            
                            // 文字列に変換・長さ制限
                            if (typeof secretKey !== 'string') {
                                secretKey = String(secretKey);
                            }
                            secretKey = secretKey.substring(0, 255);
                            
                            // ユーザーレコードを更新
                            await userTable.put({
                                user_id: registeredUser[0].user_id,
                                secret_key: secretKey
                            });
                            this.components.logger.info(`新しいsecret_keyを生成: ${user}`);
                        } 
                        // 既存のsecret_keyがオブジェクトの場合
                        else if (typeof secretKey === 'object' && secretKey !== null) {
                            // keyプロパティがあればそれを使用
                            if (secretKey.key) {
                                secretKey = secretKey.key;
                            } else {
                                secretKey = JSON.stringify(secretKey);
                            }
                            // 長さを制限
                            secretKey = secretKey.substring(0, 255);
                        }

                        const refreshToken = await credential.generateToken(
                            { userId: registeredUser[0].user_id, username: user, type: 'refresh_token' },
                            secretKey,
                            config.jwtExpiresIn || '90d'
                        );
                        const accessToken = await credential.generateToken(
                            { userId: registeredUser[0].user_id, username: user, type: 'access_token' },
                            secretKey,
                            config.jwtExpiresIn || '1d'
                        );

                        console.log('リフレッシュトークン生成完了');
                        
                        // Cookieの設定
                        res.cookie('x-user', user, cookieOptions);
                        res.cookie('x-access-token', accessToken, cookieOptions);
                        res.cookie('x-refresh-token', refreshToken, cookieOptions);
                        console.log('Cookieの設定完了、リダイレクトします:', fullRedirectUrl);

                        // 通常のリダイレクトに戻す
                        return res.redirect(fullRedirectUrl);
                    }
                }
                
                // ここまで来たら認証失敗
                console.log('ログイン失敗');
                return res.redirect(`${config.basePath}/login?error=ユーザー名またはパスワードが正しくありません`);
            } catch (error) {
                this.components.logger.error('ログイン処理エラー:', error);
                console.error('ログイン処理中のエラー詳細:', error.stack);
                return res.redirect(`${config.basePath}/login?error=ログイン処理中にエラーが発生しました`);
            }
        });

        app.get('/logout', (req, res) => {
            ejs.renderFile('views/auth/logout.ejs',
                { title: 'Logout', basePath: config.basePath },
                (err, str) => {
                    if (err) {
                        this.components.logger.error('ログアウトページエラー:', err);
                        res.status(500).send(err.message);
                    } else {
                        // クッキーのクリア
                        res.cookie('x-user', '', { ...cookieOptions, maxAge: 0 });
                        res.cookie('x-access-token', '', { ...cookieOptions, maxAge: 0 });
                        res.cookie('x-refresh-token', '', { ...cookieOptions, maxAge: 0 });
                        res.send(str);
                    }
                });
        });
    }

    /**
     * アプリケーションを起動する。
     * 必要な初期化を行い、サーバーを開始する。
     */
    async start() {
        try {
            console.log(`環境: ${config.environment}`);
            console.log(`BasePath: ${config.basePath}`);

            // システム初期化
            await this.initialize();

            // ルート設定
            await this.setupRoutes();

            // サーバー起動
            this.app.listen(config.port, () => {
                console.log(`サーバーが起動しました: http://localhost:${config.port}${config.basePath}/login`);
            });
        } catch (error) {
            console.error('サーバー起動エラー:', error);
            console.error('エラーのスタックトレース:', error.stack);
            process.exit(1);
        }
    }
}

// アプリケーション起動
const application = new Application();
application.start().catch(err => {
    console.error('アプリケーション起動に失敗しました:', err);
    process.exit(1);
});
