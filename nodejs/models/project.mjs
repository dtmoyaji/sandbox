import { v4 as uuidv4 } from "uuid"; // uuidパッケージをインポート

// Projectクラスの定義
export class Project {
    // コンストラクタ
    constructor(connection) {
        this.table_name = "project"; // テーブル名
        this.connection = connection; // データベース接続
    }

    // テーブルを作成するメソッド
    async createTable() {
        const sql = `CREATE TABLE IF NOT EXISTS ${this.table_name} (
            id SERIAL PRIMARY KEY,
            key VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMPTZ DEFAULT NULL
        )`;
        return await this.connection.query(sql);
    }

    // 新しいプロジェクトを作成するメソッド
    async newProject(name, description) {
        const key = uuidv4(); // keyにuuidを生成して代入
        const sql = `INSERT INTO ${this.table_name} (key, name, description) VALUES ($1, $2, $3)`;
        await this.connection.query(sql, [key, name, description]);
        return key;
    }

    // プロジェクトを取得するメソッド
    async getProject(key) {
        const sql = `SELECT * FROM ${this.table_name} WHERE key = $1 AND deleted_at IS NULL`;
        return await this.connection.query(sql, [key]);
    }

    // プロジェクトを更新するメソッド
    async updateProject(key, name, description) {
        const sql = `UPDATE ${this.table_name} SET name = $2, description = $3 WHERE key = $1 AND deleted_at IS NULL`;
        return await this.connection.query(sql, [key, name, description]);
    }

    // プロジェクトを削除するメソッド
    async deleteProject(key) {
        const sql = `UPDATE ${this.table_name} SET deleted_at = CURRENT_TIMESTAMP WHERE key = $1 AND deleted_at IS NULL`;
        return await this.connection.query(sql, [key]);
    }

    // 全てのプロジェクトを取得するメソッド
    async getAllProjects() {
        const sql = `SELECT * FROM ${this.table_name} WHERE deleted_at IS NULL`;
        return await this.connection.query(sql);
    }

    // 全てのプロジェクトを削除するメソッド
    async trunacateTable() {
        const sql = `TRUNCATE TABLE ${this.table_name}`;
        return await this.connection.query(sql);
    }

    // keyからプロジェクトを取得するメソッド
    async getProjectByKey(key) {
        const sql = `SELECT * FROM ${this.table_name} WHERE key = $1 AND deleted_at IS NULL`;
        return await this.connection.query(sql, [key]);
    }

    // idからプロジェクトを取得するメソッド
    async getProjectById(id) {
        const sql = `SELECT * FROM ${this.table_name} WHERE id = $1 AND deleted_at IS NULL`;
        return await this.connection.query(sql, [id]);
    }

    // nameからプロジェクトを取得するメソッド
    async getProjectByName(name) {
        const sql = `SELECT * FROM ${this.table_name} WHERE name = $1 AND deleted_at IS NULL`;
        return await this.connection.query(sql, [name]);
    }
    
}