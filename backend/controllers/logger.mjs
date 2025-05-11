/**
 * アプリケーションのログを処理するためのLoggerクラス。
 */
export class Logger {
    /**
     * @type {Object} modelManager - モデルとやり取りするためのモデルマネージャーインスタンス。
     */
    modelManager = undefined;

    /**
     * Loggerクラスのインスタンスを作成します。
     * @param {Object} modelManager - モデルマネージャーインスタンス。
     */
    constructor(modelManager) {
        this.modelManager = modelManager;
    }

    /**
     * システムログにメッセージを記録します。
     * @param {string} message - ログメッセージ。
     * @param {string} [level='info'] - ログレベル（例: 'info', 'warn', 'error'）。
     * @param {string} [application_name='system'] - ログを生成するアプリケーション名。
     * @returns {Promise<void>} ログが保存されたときに解決されるPromise。
     */
    async log(message, level = 'info', application_name = 'system') {
        const logEntry = {
            log_date: new Date().toISOString(),
            application_name,
            level,
            log: message,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        try {
            // コンソールにログを出力
            console.log(`[${logEntry.log_date}] [${logEntry.level.toUpperCase()}] [${logEntry.application_name}] ${logEntry.log}`);

            // モデルマネージャーを使用してログを保存
            if (this.modelManager) {
                const logModel = await this.modelManager.getModel('syslog');
                await logModel.put(logEntry);
            }
        } catch (error) {
            console.error('ログの保存中にエラーが発生しました:', error);
        }
    }

    /**
     * 情報メッセージをログに記録します。
     * @param {string} message - ログメッセージ。
     * @param {string} [application_name='system'] - ログを生成するアプリケーション名。
     * @returns {Promise<void>} ログが保存されたときに解決されるPromise。
     */
    async info(message, application_name = 'system') {
        await this.log(message, 'info', application_name);
    }

    /**
     * 警告メッセージをログに記録します。
     * @param {string} message - ログメッセージ。
     * @param {string} [application_name='system'] - ログを生成するアプリケーション名。
     * @returns {Promise<void>} ログが保存されたときに解決されるPromise。
     */
    async warn(message, application_name = 'system') {
        await this.log(message, 'warn', application_name);
    }

    /**
     * エラーメッセージをログに記録します。
     * @param {string} message - ログメッセージ。
     * @param {Error|null} [error=null] - ログに含めるオプションのエラーオブジェクト。
     * @param {string} [application_name='system'] - ログを生成するアプリケーション名。
     * @returns {Promise<void>} ログが保存されたときに解決されるPromise。
     */
    async error(message, error = null, application_name = 'system') {
        const errorMessage = error ? `${message} - ${error.stack || error}` : message;
        await this.log(errorMessage, 'error', application_name);
    }
}


