import dotenv from 'dotenv';
import ejs from 'ejs';
import express from 'express';

dotenv.config();

const app = express();
const port = process.env.PORT;

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
    ejs.renderFile('views/admin.ejs', { title: 'Home' }, (err, str) => {
        if (err) {
            res.status(500).send(err.message);
        } else {
            res.send(str);
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});