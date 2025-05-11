/**
 * エラーレスポンスを整形する関数
 * @param {Error} err - エラーオブジェクト
 * @param {boolean} isDevelopment - 開発環境かどうか
 * @returns {Object} 整形されたエラーレスポンス
 */
export function formatError(err, isDevelopment = false) {
    // エラー応答の基本フォーマット
    const errorResponse = {
        error: err.name || 'Error',
        message: err.message || 'サーバー内部でエラーが発生しました',
        code: err.code || 'INTERNAL_ERROR'
    };
    
    // 開発環境では追加情報を含める
    if (isDevelopment) {
        errorResponse.stack = err.stack;
        errorResponse.details = err.details || null;
    }
    
    // バリデーションエラーの場合は検証エラーの詳細を含める
    if (err.name === 'ValidationError' && err.validationErrors) {
        errorResponse.validationErrors = err.validationErrors;
    }
    
    return errorResponse;
}

/**
 * 特定のエラーコードを持つエラーを生成する
 * @param {string} message - エラーメッセージ
 * @param {string} code - エラーコード
 * @param {number} statusCode - HTTPステータスコード
 * @returns {Error} 拡張されたエラーオブジェクト
 */
export function createError(message, code = 'INTERNAL_ERROR', statusCode = 500) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

/**
 * 認証エラーを生成する
 * @param {string} message - エラーメッセージ
 * @param {string} code - エラーコード
 * @returns {Error} 認証エラーオブジェクト
 */
export function createAuthError(message, code = 'UNAUTHORIZED') {
    const error = new Error(message || '認証に失敗しました');
    error.name = 'UnauthorizedError';
    error.code = code;
    error.statusCode = 401;
    return error;
}

/**
 * アクセス権限エラーを生成する
 * @param {string} message - エラーメッセージ
 * @param {string} code - エラーコード
 * @returns {Error} アクセス権限エラーオブジェクト
 */
export function createForbiddenError(message, code = 'FORBIDDEN') {
    const error = new Error(message || 'このリソースにアクセスする権限がありません');
    error.name = 'ForbiddenError';
    error.code = code;
    error.statusCode = 403;
    return error;
}

/**
 * リソース未検出エラーを生成する
 * @param {string} resource - リソースの種類
 * @param {string|number} id - リソースのID
 * @returns {Error} 未検出エラーオブジェクト
 */
export function createNotFoundError(resource, id) {
    const message = id 
        ? `${resource} ID: ${id} が見つかりません` 
        : `${resource}が見つかりません`;
    
    const error = new Error(message);
    error.name = 'NotFoundError';
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    error.resource = resource;
    error.resourceId = id;
    return error;
}

/**
 * バリデーションエラーを生成する
 * @param {string} message - エラーメッセージ
 * @param {Array|Object} validationErrors - バリデーションエラーの詳細
 * @returns {Error} バリデーションエラーオブジェクト
 */
export function createValidationError(message, validationErrors) {
    const error = new Error(message || 'データ検証に失敗しました');
    error.name = 'ValidationError';
    error.code = 'VALIDATION_FAILED';
    error.statusCode = 400;
    error.validationErrors = validationErrors;
    return error;
}