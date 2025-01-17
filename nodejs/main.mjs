import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelController } from './controllers/rest/model-controller.mjs';
import { ModelManager } from './models/model-manager.mjs';

dotenv.config();

const port = process.env.PORT;
const modelManager = new ModelManager();

// __dirname を ES モジュールで使用できるように設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 静的ファイルを提供するためのミドルウェアを設定
app.use('/theme', express.static(path.join(__dirname, process.env.THEME)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// プロジェクトのリゾルバを設定
app.use('/api/models', ModelController); 

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

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/api/models/project?name=like|My%&created_at=%3E=|%272024-01-01%27`);
});

//let scheduler = new Scheduler();
// 毎秒実行
//let task = new Task('simpleClock', '* * * * * *', 'timerStub');
//scheduler.addTask(task);
//scheduler.start();
