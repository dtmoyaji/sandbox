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
        this.models = {};
    }

    // モデルを読み込むメソッド
    reloadModels() {
        this.models = {};
        const tableDefDir = path.join(this.__dirname, 'tabledef');
        let modelFiles = fs.readdirSync(tableDefDir);
        for (let modelFile of modelFiles) {
            let modelDef = JSON.parse(fs.readFileSync(path.join(tableDefDir, modelFile), 'utf8'));
            let modelName = modelDef.name;
            let model = new Table();
            model.createTable(modelDef);
            this.addModel(modelName, model);
        }
    }

    // モデルを追加するメソッド
    addModel(modelName, model) {
        this.models[modelName] = model;
    }

    // モデルを取得するメソッド
    getModel(modelName) {
        return this.models[modelName];
    }

    // モデルを削除するメソッド
    removeModel(modelName) {
        delete this.models[modelName];
    }

    // モデルのリストを取得するメソッド
    getModelList() {
        return Object.keys(this.models);
    }

    // SQLを直接実行するメソッド
    async raw(sql) {
        return await this.knex.raw(sql);
    }

}