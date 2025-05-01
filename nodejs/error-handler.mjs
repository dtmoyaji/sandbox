class ErrorHandler {
    // プライベートフィールド
    static #logger = console;

    /**
     * カスタムロガーを設定
     * @param {Object} customLogger - カスタムロガーオブジェクト (console互換)
     */
    static setLogger(customLogger) {
        this.#logger = customLogger || console;
    }

    /**
     * エラーを処理してログ出力
     * @param {Error} error - 処理するエラー
     */
    static handleError(error) {
        const timestamp = new Date().toISOString();
        this.#logger.error(`[${timestamp}] [Error]: ${error.message}`);
        if (error.stack) {
            this.#logger.error(`[${timestamp}] [Stack Trace]: ${error.stack}`);
        }
    }

    /**
     * 非同期関数のエラーハンドリングラッパー
     * @param {Function} fn - 非同期関数
     * @returns {Function} ラップされた非同期関数
     */
    static handleAsyncError(fn) {
        return async (...args) => {
            try {
                await fn(...args);
            } catch (error) {
                this.handleError(error);
            }
        };
    }

    /**
     * プロセス全体のエラーハンドリングを設定
     * @param {number} exitCode - プロセス終了コード
     */
    static handleProcessErrors(exitCode = 1) {
        process.on('uncaughtException', (error) => {
            this.#logger.error('[Uncaught Exception]');
            this.handleError(error);

            // クリーンアップ処理を追加
            this.#cleanupAndExit(exitCode);
        });

        process.on('unhandledRejection', (reason) => {
            this.#logger.error('[Unhandled Rejection]');
            if (reason instanceof Error) {
                this.handleError(reason);
            } else {
                this.#logger.error(`[Unhandled Rejection] Reason: ${JSON.stringify(reason)}`);
                this.handleError(new Error(String(reason)));
            }
        });
    }

    /**
     * プロセス終了前のクリーンアップ処理
     * @param {number} exitCode - プロセス終了コード
     */
    static #cleanupAndExit(exitCode) {
        // 必要に応じてリソースのクリーンアップ処理をここに追加
        this.#logger.info('Performing cleanup before exiting...');
        process.exit(exitCode);
    }
}

export default ErrorHandler;