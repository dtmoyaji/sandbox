# コールとレシーブの連携一覧

## フロントエンドとバックエンドのAPI連携

このテーブルは、フロントエンドからバックエンドへのAPIコールとその受信側の対応関係を示しています。

開発者がアプリケーションの通信フローを理解し、デバッグやメンテナンスを容易にするための参照資料です。

| フロントエンド (コール) | フロントエンドファイル | バックエンド (レシーブ) | バックエンドファイル | 説明 |
|-------------------------|------------------------|-------------------------|--------------------|------|
| `/api/auth/login` | `backend/views/auth/login.ejs` | `/api/auth/login` | `backend/controllers/rest/auth-controller.mjs` | ユーザーログイン認証API |
| `/api/auth/logout` | `backend/views/controls/topBar/topBar.ejs` | `/api/auth/logout` | `backend/controllers/rest/auth-controller.mjs` | ログアウト処理を行うAPI |
| `/api/auth/token` | `backend/views/controls/centerPanel/scriptPanel.ejs`, `backend/views/controls/centerPanel/queryPanel.ejs`, `backend/views/controls/centerPanel/tablePanel.ejs`, `backend/views/controls/centerPanel/applicationPanel.ejs`, `backend/views/controls/centerPanel/applicationListPanel.ejs`, `backend/views/controls/topBar/topBar.ejs`, `backend/views/auth/login.ejs` | `/api/auth/token` | `backend/controllers/rest/auth-controller.mjs` | アクセストークンを更新するAPI |
| `/api/import` | `backend/views/controls/centerPanel/tablePanel.ejs`, `backend/views/controls/centerPanel/applicationPanel.ejs`, `backend/views/controls/centerPanel/applicationListPanel.ejs`, `backend/views/controls/centerPanel/queryPanel.ejs`, `backend/views/controls/centerPanel/scriptPanel.ejs` | `/api/import` | `backend/controllers/file/import-csv.mjs` | CSVデータをインポートするAPI |
| `/api/models` | `backend/views/controls/centerPanel/tableListPanel.ejs`, `backend/views/controls/centerPanel/tablePanel.ejs`, `backend/views/controls/genericTable/recordEditPane.ejs` | `/api/models` | `backend/controllers/rest/resolver.mjs` | モデルに関連するGET, POST, PUT, DELETEのリゾルバAPI |
| `/api/models/<tableName>` (GET/POST/PUT/DELETE) | `backend/views/controls/centerPanel/tablePanel.ejs` | `/api/models/<tableName>` (CRUD) | `backend/controllers/rest/resolver.mjs` | 任意テーブルのCRUD操作API。GET:取得、POST:新規作成、PUT:更新、DELETE:削除 |
| `/api/models/<tableName>/definition` | `backend/views/controls/centerPanel/tablePanel.ejs` | `/api/models/<tableName>/definition` | `backend/controllers/rest/model-controller.mjs` | テーブル定義情報のみを取得するAPI |
| `/api/models/application` | `backend/views/controls/centerPanel/applicationListPanel.ejs` | `/api/models/application` | `backend/controllers/rest/resolver.mjs` | アプリケーション一覧を取得するAPI |
| `/api/models/application_table_def` | `backend/views/controls/centerPanel/applicationPanel.ejs` | `/api/models/application_table_def` | `backend/controllers/rest/resolver.mjs` | アプリケーションに紐づくテーブル定義一覧を取得するAPI |
| `/api/models/query_template?name=<queryName>` | `backend/views/controls/centerPanel/queryPanel.ejs` | `/api/models/query_template` | `backend/controllers/rest/resolver.mjs` | クエリテンプレート情報を取得するAPI |
| `/api/models/script` (POST/PUT/DELETE) | `backend/views/controls/centerPanel/scriptPanel.ejs` | `/api/models/script` (CRUD) | `backend/controllers/rest/resolver.mjs` | スクリプトの新規作成・更新・削除API |
| `/api/models/script?script_name=<scriptName>` | `backend/views/controls/centerPanel/scriptPanel.ejs` | `/api/models/script?script_name=<scriptName>` | `backend/controllers/rest/resolver.mjs` | スクリプト情報を取得するAPI |
| `/api/models/tableDefinition/<targetTable>` | `backend/views/controls/genericTable/recordEditPane.ejs` | `/api/models/tableDefinition/<targetTable>` | `backend/controllers/rest/resolver.mjs` | テーブル定義を取得するAPI |
| `/api/models/table_def` | `backend/views/controls/centerPanel/tableListPanel.ejs` | `/api/models/table_def` | `backend/controllers/rest/resolver.mjs` | テーブル一覧情報を取得するAPI |
| `/api/projects/all` | `backend/views/controls/projects/projectSidePane.ejs` | `/api/projects/all` | `backend/controllers/app/userApplication.mjs` | プロジェクトリストを取得するAPI |
| `/api/projects/keys/<projectKey>` | `backend/views/controls/projects/projectPane.ejs` | `/api/projects/keys/<projectKey>` | `backend/controllers/app/userApplication.mjs` | 特定のプロジェクト情報を取得するAPI |
| `/api/query/exec` | `backend/views/controls/centerPanel/queryPanel.ejs` | `/api/query/exec` | `backend/controllers/rest/query-controller.mjs` | クエリを実行するAPI |
| `/api/query/logs?name=<queryName>` | `backend/views/controls/centerPanel/queryPanel.ejs` | `/api/query/logs` | `backend/controllers/rest/query-controller.mjs` | クエリ実行ログを取得するAPI（※実装状況に応じて） |
| `/api/renderer/centerPanel` | `backend/views/page/page.ejs` | `/api/renderer/centerPanel` | `backend/main.mjs` | センターパネルのレンダリングを行うAPI |
| `/api/renderer/centerPanel` (GET) | `backend/views/page/page.ejs` | `/api/renderer/centerPanel` (GET) | `backend/main.mjs` | センターパネルのレンダリングを行うGET API |
| `/api/renderer/centerPanel` (POST) | `backend/views/page/page.ejs` | `/api/renderer/centerPanel` (POST) | `backend/main.mjs` | センターパネルのレンダリングを行うPOST API |
| `/api/script/exec` | `backend/views/controls/centerPanel/scriptPanel.ejs` | `/api/script/exec` | `backend/controllers/script/script-executer.mjs` | スクリプトを実行するAPI |
| `/ws` | `backend/views/controls/websocket/websocket.ejs` | `/ws` | `backend/controllers/websocket/websocket.mjs` | WebSocketによるリアルタイム通信を行うエンドポイント |

## ミドルウェアからバックエンドへのコール一覧

| ミドルウェア (コール) | 呼び出し箇所 | バックエンド (レシーブ) | バックエンドファイル | 説明 |
|----------------------|----------------|-------------------------|--------------------|------|
| `unifiedRenderer.l10nRenderer.getMiddleware()` | `backend/main.mjs` | 多言語対応ミドルウェア | `backend/views/renderer/l10n-renderer.mjs` | 多言語対応のためのリクエストローカライズ |
| `authMiddleware` | `backend/main.mjs` | 認証ミドルウェア | `backend/main.mjs` | アクセストークン等の認証チェック |
| `logger` | `backend/main.mjs` | リクエストロギング | `backend/controllers/logger.mjs` | リクエストのログ出力 |
| `errorHandler()` | `backend/main.mjs` | エラーハンドリング | `backend/error-handler.mjs` | グローバルエラーハンドラ |
| `initialize()` | `backend/initialize.mjs` | 初期データ投入 | `backend/initialize.mjs` | DB初期化・データ投入 |
| `restoreData()` | `backend/application-boot.mjs` | データリストア | `backend/application-boot.mjs` | バックアップデータのリストア |
| `scheduler` | `backend/controllers/scheduler.mjs` | バッチ・定期実行 | `backend/controllers/scheduler.mjs` | 定期バッチ・ジョブスケジューラ |
