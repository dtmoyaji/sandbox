import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Connection } from './connection.mjs'; // Connectionクラスをインポート
import { Table } from './table.mjs';


export class ModelManager {
    constructor() {
        this.__dirname = path.dirname(fileURLToPath(import.meta.url));
        this.Connection = new Connection();
        this.knex = this.Connection.knex;
        this.models = [];
    }

    // モデルを読み込むメソッド
    async reloadModels() {
        this.models = [];
        const tableDefDir = path.join(this.__dirname, 'tabledef');
        let modelFiles = fs.readdirSync(tableDefDir);
        for (let modelFile of modelFiles) {
            let modelDef = JSON.parse(fs.readFileSync(path.join(tableDefDir, modelFile), 'utf8'));
            let model = new Table(this.Connection);
            await model.createTable(modelDef);
            this.models.push(model);
        }
    }

    async getModel(name) {
        let matched = this.models.filter(model => model.table_name === name);
        return matched.length > 0 ? matched[0] : null;
    }
}