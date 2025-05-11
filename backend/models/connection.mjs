import dotenv from 'dotenv'; // dotenvパッケージをインポート
import knex from 'knex'; // knexパッケージをインポート

dotenv.config(); // .envファイルの内容を読み込む

// PostgreSQLの接続情報を定義するクラス
export class Connection {
    // コンストラクタ
    constructor() {
        this.config = {
            client: process.env.DB_CLIENT,
            connection: {
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                database: process.env.DB_DATABASE,
                password: process.env.DB_PASSWORD,
                port: process.env.DB_PORT,
            },
        }; // 接続設定
        this.knex = knex(this.config); // knexインスタンスを作成
    }

    // クエリを実行するメソッド
    async query(sql, params) {
        try {
            const res = await this.knex.raw(sql, params); // クエリを実行
            return res;
        } catch (err) {
            console.error('Query error', err.stack);
            throw err; // エラーを再スロー
        }
    }

    // 接続を開くメソッド
    async connect() {
        try {
            await this.knex.raw('SELECT 1+1 AS result'); // データベースに接続を確認するためのクエリ
            console.log('Connected to PostgreSQL database');
        } catch (err) {
            if (err instanceof AggregateError) {
                for (const individualError of err.errors) {
                    console.error('Failed to connect to PostgreSQL database', individualError);
                }
            } else {
                console.error('Failed to connect to PostgreSQL database', err);
            }
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
}

export default new Connection();
