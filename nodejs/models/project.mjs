import { v4 as uuidv4 } from 'uuid'; // uuidパッケージをインポート

// Projectクラスの定義
export class Project {
    // コンストラクタ
    constructor(connection) {
        this.connection = connection.knex; // データベース接続
        this.table_name = 'project'; // テーブル名
    }

    // 接続を開くメソッド
    async connect() {
        try {
            await this.knex.raw('SELECT 1+1 AS result'); // データベースに接続を確認するためのクエリ
            console.log('Connected to PostgreSQL database');
        } catch (err) {
            console.error('Failed to connect to PostgreSQL database', err);
        }
    }

    // 接続を閉じるメソッド
    async disconnect() {
        try {
            await this.knex.destroy(); // データベース接続を閉じる
            console.log('Disconnected from PostgreSQL database');
        } catch (err) {
            console.error('Failed to disconnect from PostgreSQL database', err);
        }
    }

    // テーブルを作成するメソッド
    async createTable() {
        try {
            const exists = await this.connection.schema.hasTable(this.table_name);
            if (!exists) {
                await this.connection.schema.createTable(this.table_name, (table) => {
                    table.increments('id').primary();
                    table.string('key').notNullable();
                    table.string('name').notNullable();
                    table.text('description');
                    table.timestamp('created_at').defaultTo(this.connection.fn.now());
                    table.timestamp('deleted_at').nullable();
                });
            }
        } catch (err) {
            console.error('Create table error', err.stack);
        }
    }

    // テーブルを空にするメソッド
    async truncateTable() {
        await this.connection(this.table_name)
            .truncate();
    }

    // 新しいプロジェクトを作成するメソッド
    async newProject(name, description) {
        const key = uuidv4();
        await this.connection(this.table_name)
            .insert({ key, name, description });
        return key;
    }

    // プロジェクトを取得するメソッド
    async getProject(key) {
        return await this.connection(this.table_name)
            .where({ key, deleted_at: null }).first();
    }

    // プロジェクトを更新するメソッド
    async updateProject(key, name, description) {
        return await this.connection(this.table_name)
            .where({ key, deleted_at: null })
            .update({ name, description });
    }

    // プロジェクトを削除するメソッド
    async deleteProject(key) {
        return await this.connection(this.table_name)
            .where({ key })
            .update({ deleted_at: new Date() });
    }

    // すべてのプロジェクトを取得するメソッド
    async getAllProjects() {
        return await this.connection(this.table_name)
            .where({ deleted_at: null });
    }

    // keyからプロジェクトを取得するメソッド
    async getProjectByKey(key) {
        return await this.connection(this.table_name)
            .where({ key, deleted_at: null })
            .first();
    }

    // idからプロジェクトを取得するメソッド
    async getProjectById(id) {
        return await this.connection(this.table_name)
            .where({ id, deleted_at: null })
            .first();
    }

    // nameからプロジェクトを取得するメソッド
    async getProjectByName(name) {
        return await this.connection(this.table_name)
            .where({ name, deleted_at: null })
            .first();
    }

}
