#!/bin/sh
# スクリプトを実行するシェルを指定します

# /app ディレクトリの内容をリスト表示します (デバッグ用)
ls /app
# カレントディレクトリを /app に変更します
cd /app

# .installed ファイルが存在しない場合、初期化処理を実行するためのコメントアウトされたコード
# rm -rf .installed

# yarn.lock ファイルが存在しないかチェックします
if [ ! -f yarn.lock ]; then
    echo "Installing dependencies..." # 依存関係のインストールを開始するメッセージを表示します
    # 既存の node_modules やロックファイルなどを削除してクリーンな状態にします
    rm -rf node_modules
    rm -rf .pnpm-store
    rm -rf .pnpm
    rm -rf .cache
    rm -rf pnpm-lock.yaml
    rm -rf yarn.lock
    rm -rf package-lock.json
    # Yarn を使用して依存関係をインストールします (--shamefully-hoist は依存関係の解決方法を指定します)
    yarn install --shamefully-hoist
fi

# .installed ファイルが存在しないかチェックします (初回起動かどうかを確認)
if [ ! -f .installed ]; then
    # Node.js で initialize.mjs スクリプトを実行します (初回セットアップ処理)
    node initialize.mjs
    # .installed ファイルを作成し、初期化が完了したことをマークします
    touch .installed
fi

# package.json の "scripts" で定義された "start" コマンドを実行してアプリケーションを起動します
yarn run start
