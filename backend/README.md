# Sandbox Node.js フレームワーク

## 概要

Sandbox は拡張性の高いWebアプリケーションフレームワークで、RESTful API、データベース管理、認証システム、スクリプト実行、多言語対応などの機能を提供します。モジュール構造により、新しいアプリケーションの追加や機能の拡張が容易に行えます。

## 主な機能

- **データベース管理**: PostgreSQLをベースとしたデータモデルシステム
- **RESTful API**: 自動生成されるAPIエンドポイント
- **認証システム**: JWTベースのセキュアな認証
- **マルチアプリケーション**: 複数のアプリケーションを一つのフレームワーク上で実行
- **スクリプト実行**: カスタムスクリプトの実行環境
- **WebSocketサポート**: リアルタイム通信機能
- **多言語対応**: 国際化対応のためのシステム
- **LINE WORKSとの連携**: メッセージ送信機能
- **CSVインポート**: データのインポート機能
- **セキュリティ**: Helmetを使用したセキュリティ強化

## ディレクトリ構造

- **applications/**: ユーザーアプリケーションのディレクトリ
  - ImapToLineworks/: IMAPからLINE WORKSへの連携アプリケーション
  - MessageToLineworks/: メッセージをLINE WORKSに送信するアプリケーション
  - OtcSearch/: 検索アプリケーション
- **controllers/**: コントローラー関連ファイル
  - app/: アプリケーションコントローラー
  - file/: ファイル操作関連
  - rest/: REST API関連
  - script/: スクリプト実行関連
  - sns/: SNS連携関連
  - websocket/: WebSocket関連
- **models/**: データモデル関連
  - table_def/: テーブル定義ファイル
  - ai/: AI連携モジュール
- **views/**: ビュー関連ファイル
- **scripts/**: カスタムスクリプト
- **themes/**: UIテーマ

## セットアップ

### 必要要件

- Node.js (v14以上)
- PostgreSQL

### インストール

```bash
# 依存パッケージのインストール
npm install

# 環境設定
cp .env.example .env
# .envファイルを編集して適切な設定を行ってください

# サーバー起動
npm start
```

## 環境設定

`.env`ファイルには以下の設定があります：

- **PORT**: サーバーのポート番号 (デフォルト: 3001)
- **DB_CLIENT**: データベースクライアント (デフォルト: pg)
- **DB_HOST**: データベースホスト (デフォルト: localhost)
- **DB_PORT**: データベースポート (デフォルト: 5432)
- **DB_DATABASE**: データベース名 (デフォルト: postgres)
- **DB_USER**: データベースユーザー (デフォルト: postgres)
- **DB_PASSWORD**: データベースパスワード
- **ADMIN_USER**: 管理者ユーザー名
- **ADMIN_PASSWORD**: 管理者パスワード
- **JWT_SECRET**: JWT用の秘密鍵
- **THEME**: 使用するテーマ (デフォルト: themes/default)
- **LANG**: 言語設定 (デフォルト: ja)

## 新しいアプリケーションの作成

1. `applications`ディレクトリに新しいアプリケーションフォルダを作成
2. `application.json`ファイルを作成して必要な設定を記述
3. 必要に応じて`models`、`scripts`、`views`ディレクトリを作成

## API

### REST API

基本的なCRUD操作は以下のエンドポイントを通じて行われます：

- `GET /api/models/:modelName`: データの取得
- `POST /api/models/:modelName`: データの更新
- `PUT /api/models/:modelName`: データの作成
- `DELETE /api/models/:modelName`: データの削除

### 認証API

- `POST /api/auth/login`: ログイン
- `POST /api/auth/token`: トークンの更新

## ライセンス

MIT