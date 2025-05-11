// コメント: WebSocketクラスは、WebSocket接続を管理するためのクラスです。
// コメント: express-wsを使用してWebSocketを初期化します。
import expressWs from 'express-ws';

export class WebSocket {
    // コメント: expressアプリケーションのインスタンス
    express = undefined;
    // コメント: WebSocketのインスタンス
    websocket = undefined;
    // コメント: 接続中のクライアントを管理するMap
    clients = new Map();
    // コメント: ログ出力用のオブジェクト
    logger = undefined;

    /**
     * WebSocketクラスのコンストラクタ。
     * @param {Object} express - expressアプリケーションのインスタンス。
     * @param {Object} [logger=undefined] - ログ出力用のオブジェクト。
     */
    constructor(express, logger = undefined) {
        // コメント: expressとloggerを初期化
        this.logger = logger;
        this.express = express;
        this.websocket = expressWs(express);
    }

    /**
     * WebSocketのエンドポイントをバインドします。
     * クライアントからの接続を受け付け、メッセージの送受信や接続の管理を行います。
     */
    async bindWebSocket() {
        // コメント: WebSocketのエンドポイントをバインド
        this.express.ws('/ws', (ws, req) => {
            const currentUser = req.query.currentUser; // コメント: クエリパラメータから現在のユーザーを取得
            const applicationName = req.query.application_name; // コメント: クエリパラメータからアプリケーション名を取得

            if (!this.clients.has(currentUser)) {
                this.clients.set(currentUser, []); // コメント: ユーザーごとのWebSocketリストを初期化
            }
            this.clients.get(currentUser).push(ws); // コメント: WebSocket接続をリストに追加

            this.logger?.log(
                `WebSocket was opened for ${currentUser}. Clients: ${this.clients.size}`,
                'info',
                applicationName
            );

            ws.on('message', (msg) => {
                // コメント: クライアントからのメッセージを受信
                try {
                    const msgObj = JSON.parse(msg);
                    ws.send(JSON.stringify(msgObj)); // コメント: メッセージをそのまま送り返す
                } catch (error) {
                    this.logger?.log(`Error parsing message: ${error.message}`, 'error', applicationName);
                }
            });

            ws.on('close', () => {
                // コメント: WebSocket接続が閉じられたときの処理
                const userSockets = this.clients.get(currentUser)?.filter(socket => socket !== ws) || [];

                if (userSockets.length > 0) {
                    this.clients.set(currentUser, userSockets);
                } else {
                    this.clients.delete(currentUser);
                }

                this.logger?.log(
                    `WebSocket was closed. Clients: ${this.clients.size}`,
                    'info',
                    applicationName
                );
            });
        });
        console.log('WebSocket bound');
    }

    /**
     * 特定のユーザーにメッセージを送信します。
     * @param {string} userName - メッセージを送信する対象のユーザー名。
     * @param {Object} message - 送信するメッセージオブジェクト。
     */
    sendToUser(userName, message) {
        // コメント: 特定のユーザーにメッセージを送信
        const matchedClients = this.clients.get(userName);

        matchedClients?.forEach(ws => {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                this.logger?.log(`Error sending message: ${error.message}`, 'error');
            }
        });
    }
}

