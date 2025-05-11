import { formatError } from './error-formatter.mjs';

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

/**
 * エラーハンドリングを提供するミドルウェア
 * @param {Object} logger - ロガーインスタンス
 * @param {boolean} isDevelopment - 開発環境かどうか
 * @returns {Function} Express エラーハンドリングミドルウェア
 */
export function createErrorHandler(logger, isDevelopment = false) {
    return (err, req, res, next) => {
        // エラー内容の詳細ロギング
        logger.error('未処理エラー:', {
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            body: req.body ? (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body) : null,
            params: req.params,
            query: req.query,
            user: req.user
        });
        
        // エラーの種類によって適切なステータスコードを設定
        let statusCode = 500;
        if (err.statusCode) statusCode = err.statusCode;
        else if (err.name === 'ValidationError') statusCode = 400;
        else if (err.name === 'UnauthorizedError') statusCode = 401;
        else if (err.name === 'ForbiddenError') statusCode = 403;
        else if (err.name === 'NotFoundError') statusCode = 404;
        
        // エラーレスポンスを整形
        const response = formatError(err, isDevelopment);
        
        res.status(statusCode).json(response);
    };
}

/**
 * 特定のルートが見つからない場合のミドルウェア
 * @param {Object} logger - ロガーインスタンス
 * @returns {Function} 404エラーを処理するミドルウェア
 */
export function createNotFoundHandler(logger) {
    return (req, res) => {
        logger.warn(`Route not found: ${req.originalUrl}`);
        res.status(404).json({ 
            error: 'Not Found', 
            code: 'ROUTE_NOT_FOUND',
            path: req.originalUrl 
        });
    };
}

export default ErrorHandler;