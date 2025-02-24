import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { bootApplications, restoreData } from './application-boot.mjs';
import { UserApplication } from './controllers/app/userApplication.mjs';
import * as credential from './controllers/credential.mjs';
import { ImportCsvController } from './controllers/file/import-csv.mjs';
import { ModelManager } from './controllers/model-manager.mjs';
import { createAuthController } from './controllers/rest/auth-controller.mjs';
import { createModelController } from './controllers/rest/model-controller.mjs';
import { createQueryController } from './controllers/rest/query-controller.mjs';
import { Resolver } from './controllers/rest/resolver.mjs';
import { RestUtil } from './controllers/rest/rest-util.mjs';
import { ScriptExecutor } from './controllers/script/script-executer.mjs';
import { WebSocket } from './controllers/websocket/websocket.mjs';
import { PageRenderer } from './views/renderer/page-renderer.mjs';

dotenv.config();

const port = process.env.PORT;

const modelManager = new ModelManager();
await modelManager.reloadModels();

const restUtil = new RestUtil(modelManager);
const modelController = await createModelController(modelManager);
const authController = createAuthController(modelManager);
const queryController = createQueryController(modelManager);
const scriptExecutor = new ScriptExecutor(modelManager);
const userApplication = new UserApplication(modelManager);

// __dirname を ES モジュールで使用できるように設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 組込みアプリケーションのブート
await bootApplications(modelManager);
await modelManager.reloadModels();
await restoreData(modelManager);

const app = express();
const websocket = new WebSocket(app);
await websocket.bindWebSocket();

const pageRenderer = new PageRenderer(restUtil, modelManager);

// 静的ファイルを提供するためのミドルウェアを設定
app.use('/theme', express.static(path.join(__dirname, process.env.THEME)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// プロジェクトのリゾルバを設定
const resolver = new Resolver(modelManager);
await resolver.initializeResolvers();
const importCsvController = new ImportCsvController(modelManager, websocket);
await importCsvController.initializeResolvers();

app.use('/app', userApplication.router);
app.use('/api/script', scriptExecutor.router);
app.use('/api/import', importCsvController.router);
app.use('/api/models', resolver.router);
app.use('/api/auth', authController);
app.use('/api/query', queryController);
app.use('/pageRenderer', pageRenderer.pageRouter);

// リゾルバ
app.get('/', (req, res) => {
    let result = {
        "system:": "sandbox",
        "version:": "1.0.0"
    }
    res.send(result);
});

// APIはかならず変数を要求するので、*を使用してパスを取得
app.get('/api/*', (req, res) => {
    const path = req.params[0];
    const nameParts = path.split('/');
    const queryParams = req.query;
    if (nameParts[0]) {
        let result = {
            "params": nameParts,
            "query": queryParams
        };
        res.send(result);
    } else {
        res.status(404).send('Not Found');
    }
});

app.post('/api/*', (req, res) => {
    const path = req.params[0];
    const nameParts = path.split('/');
    const queryParams = req.query;
    if (nameParts[0]) {
        let result = {
            "params": nameParts,
            "query": queryParams
        };
        res.send(result);
    } else {
        res.status(404).send('Not Found');
    }
});

app.put('/api/*', (req, res) => {
    const path = req.params[0];
    const nameParts = path.split('/');
    const queryParams = req.query;
    if (nameParts[0]) {
        let result = {
            "params": nameParts,
            "query": queryParams
        };
        res.send(result);
    } else {
        res.status(404).send('Not Found');
    }
});

app.delete('/api/*', (req, res) => {
    const path = req.params[0];
    const nameParts = path.split('/');
    const queryParams = req.query;
    if (nameParts[0]) {
        let result = {
            "params": nameParts,
            "query": queryParams
        };
        res.send(result);
    } else {
        res.status(404).send('Not Found');
    }
});

// GUIを提供する場合は変数が指定されないケースを想定する。
app.get(['/admin', '/admin/*'], async (req, res) => {

    // トークンの検証
    let tokenCheck = await restUtil.verifyToken(req, res);
    if(!tokenCheck.auth) {
        res.redirect('/login');
        return;
    }

    // ページをレンダリング
    let renderResult = await pageRenderer.render(req, res);
    if (renderResult.status === 200) {
        res.send(renderResult.body);
    } else {
        res.status(500).send(renderResult.message);
    }

});

app.get('/login', (req, res) => {
    ejs.renderFile('views/auth/login.ejs',
        { title: 'Login' },
        (err, str) => {
            if (err) {
                res.status(500).send(err.message);
            } else {
                res.send(str);
            }
        });
});

app.post('/login', async (req, res) => {
    const user = req.body.username;
    const password = req.body.password;
    let userTable = await modelManager.getModel('user');
    let registeredUser = await userTable.get({ user_name: user });

    if (registeredUser.length !== 0) {
        let registeredPassword = registeredUser[0].user_password;
        if (await credential.verifyPassword(password, registeredPassword)) {
            let secretKey = registeredUser[0].secret_key;
            let refreshToken = await credential.generateToken({ user: user, password: registeredPassword, type: 'refresh_token' }, secretKey, '1d');
            let accessToken = await credential.generateToken({ user: user, password: registeredPassword, type: 'access_token'}, secretKey, '1d');
            res.cookie('x-user', user, { sameSite: 'Strict' });
            res.cookie('x-access-token', accessToken, { sameSite: 'Strict' });
            res.cookie('x-refresh-token', refreshToken, { sameSite: 'Strict' });
            // adminページにリダイレクト
            return res.redirect('/admin');
        }
    }
    return res.status(401).send('Invalid user or password');
});

app.get('/logout', (req, res) => {
    ejs.renderFile('views/auth/logout.ejs',
        { title: 'Logout' },
        (err, str) => {
            if (err) {
                res.status(500).send(err.message);
            } else {
                res.cookie('x-user', '', { sameSite: 'Strict' });
                res.cookie('x-access-token', '', { sameSite: 'Strict' });
                res.cookie('x-refresh-token', '', { sameSite: 'Strict' });
                res.send(str);
            }
        });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/login`);
});

//let scheduler = new Scheduler();
// 毎秒実行
//let task = new Task('simpleClock', '* * * * * *', 'timerStub');
//scheduler.addTask(task);
//scheduler.start();
