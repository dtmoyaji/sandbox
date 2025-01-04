import { Connection } from './connection.mjs'; // Connectionクラスをインポート

// Projectクラスの定義
export class Table {

    table_name = 'table'; // テーブル名

    // コンストラクタ
    constructor(connection) {
        if (!connection) {
            this.connection = new Connection();
        } else {
            this.connection = connection.knex; // データベース接続
        }
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

    // 抽象メソッドのように振る舞うメソッド
    async createTable() {
        throw new Error('createTable method must be implemented');
    }

    // テーブルを空にするメソッド
    async truncateTable() {
        await this.connection(this.table_name)
            .truncate();
    }

    // テーブルを削除するメソッド
    async dropTable() {
        await this.connection.schema.dropTable(this.table_name);
    }

}
