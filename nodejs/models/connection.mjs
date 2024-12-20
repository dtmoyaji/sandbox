import dotenv from 'dotenv'; // dotenvパッケージをインポート
import pkg from 'pg'; // pgパッケージをインポート
const { Client } = pkg; // Clientクラスをデフォルトエクスポートから取得

dotenv.config(); // .envファイルの内容を読み込む

// PostgreSQLの接続情報を定義するクラス
export class Connection {
    // コンストラクタ
    constructor() {
        this.config = {
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        }; // 接続設定
        this.client = new Client(this.config); // クライアントインスタンスを作成
    }

    // 接続を開くメソッド
    async connect() {
        try {
            await this.client.connect(); // データベースに接続
            console.log('Connected to PostgreSQL database');
        } catch (err) {
            console.error('Connection error', err.stack);
            throw err; // エラーを再スロー
        }
    }

    // クエリを実行するメソッド
    async query(sql, params) {
        try {
            const res = await this.client.query(sql, params); // クエリを実行
            return res;
        } catch (err) {
            console.error('Query error', err.stack);
            throw err; // エラーを再スロー
        }
    }

    // 接続を閉じるメソッド
    async close() {
        try {
            await this.client.end(); // 接続を閉じる
            console.log('Disconnected from PostgreSQL database');
        } catch (err) {
            console.error('Disconnection error', err.stack);
            throw err; // エラーを再スロー
        }
    }
}
