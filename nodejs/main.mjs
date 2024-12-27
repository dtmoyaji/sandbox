import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Scheduler, Task } from './controllers/scheduler.mjs';

dotenv.config();

const app = express();
const port = process.env.PORT;

// __dirname を ES モジュールで使用できるように設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 静的ファイルを提供するためのミドルウェアを設定
app.use('/theme', express.static(path.join(__dirname, process.env.THEME)));

app.get('/', (req, res) => {
    let result = {
        "system:": "sandbox",
        "version:": "1.0.0"
    }
    res.send(result);
});

app.get('/api/*', (req, res) => {
    const path = req.params[0];
    const nameParts = path.split('/');
    if (nameParts[0]) {
        let result = {
            "params": nameParts
        };
        res.send(result);
    } else {
        res.status(404).send('Not Found');
    }
});

app.get('/admin', (req, res) => {
    ejs.renderFile('views/admin/admin.ejs', { title: 'Home' }, (err, str) => {
        if (err) {
            res.status(500).send(err.message);
        } else {
            res.send(str);
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/admin`);
});

let scheduler = new Scheduler();
// 毎秒実行
let task = new Task('simpleClock', '* * * * * *', 'timerStub');
scheduler.addTask(task);
scheduler.start();
