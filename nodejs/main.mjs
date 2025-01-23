import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as credential from './controllers/credential.mjs';
import { ModelManager } from './controllers/model-manager.mjs';
import { createAuthController } from './controllers/rest/auth-controller.mjs';
import { createModelController } from './controllers/rest/model-controller.mjs';

dotenv.config();

const port = process.env.PORT;

const modelManager = new ModelManager();
await modelManager.reloadModels();

const modelController = await createModelController(modelManager);
const authController = await createAuthController(modelManager);

// __dirname を ES モジュールで使用できるように設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 静的ファイルを提供するためのミドルウェアを設定
app.use('/theme', express.static(path.join(__dirname, process.env.THEME)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// プロジェクトのリゾルバを設定
app.use('/api/auth', authController);
app.use('/api/models', modelController);

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
app.get(['/admin', '/admin/*'], (req, res) => {
    const path = req.params[0] || ''; // パスがない場合は空文字列を使用
    const nameParts = path.split('/');
    const queryParams = req.query;

    //console.log(queryParams);

    ejs.renderFile('views/admin/admin.ejs',
        { title: 'Home', path: nameParts, params: queryParams },
        (err, str) => {
            if (err) {
                res.status(500).send(err.message);
            } else {
                res.send(str);
            }
        });
});

app.get('/login', (req, res) => {
    ejs.renderFile('views/admin/login.ejs',
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
    let registerdUser = await userTable.get({ user_name: user });

    if (registerdUser.length !== 0) {
        let registerdPassword = registerdUser[0].user_password;
        if (await credential.verifyPassword(password, registerdPassword)) {
            let secretKey = registerdUser[0].secret_key;
            let refreshToken = await credential.generateToken({ user: user, password: registerdPassword, type: 'refresh_token' }, secretKey, '1d');
            res.cookie('x-user', user, { sameSite: 'Strict' });
            res.cookie('refreshToken', refreshToken, { sameSite: 'Strict' });
            // adminページにリダイレクト
            res.redirect('/admin');
        }
    }
    res.status(401).send('Invalid user or password');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/login`);
});

//let scheduler = new Scheduler();
// 毎秒実行
//let task = new Task('simpleClock', '* * * * * *', 'timerStub');
//scheduler.addTask(task);
//scheduler.start();
