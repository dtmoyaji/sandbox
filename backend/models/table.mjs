import { Connection } from './connection.mjs'; // Connectionクラスをインポート

/**
 * Tableクラスは、データベーステーブルの操作を行うためのクラスです。
 * テーブルの作成、削除、データの挿入、更新、取得などの機能を提供します。
 */
export class Table {

    // 公開テーブル、非公開テーブルのスコープ
    static MODEL_SCOPE_PUBLIC = 'public'; // 公開テーブル
    static MODEL_SCOPE_PROTECTED = 'protected'; // 非公開テーブル(アクセス権はユーザースコープに従う)

    // ユーザーのスコープ(ユーザー、ユーザー管理者による読み書きはuser_domain_idが一致するレコードに限定される)
    static USER_SCOPE_SYSTEM_ADMIN_READWRITE = 'system_admin_readwrite'; // システム管理者のみ読み書き可能
    static USER_SCOPE_ADMIN_READONLY = 'user_admin_readonly'; // ユーザー管理者のみ読み取り可能
    static USER_SCOPE_ADMIN_READWRITE = 'user_admin_readwrite'; // ユーザー管理者のみ読み書き可能
    static USER_SCOPE_USER_READONLY = 'user_readonly'; // ユーザーのみ読み取り可能
    static USER_SCOPE_USER_READWRITE = 'user_readwrite'; // ユーザーのみ読み書き可能

    application_id = 1; // テーブルのドメイン
    table_name = 'table'; // テーブル名
    connection;
    knex;

    /**
     * コンストラクタ
     * @param {Connection} [connection] - データベース接続オブジェクト。指定しない場合は新しい接続を作成します。
     */
    constructor(connection) {
        this.connection = connection || new Connection();
        this.knex = this.connection.knex;
    }

    /**
     * テーブルのセキュリティレベルを取得するメソッド
     * @returns {string} - テーブルのセキュリティレベル
     */
    async getScope() {
        if (this.tableDefinition.scope) {
            return this.tableDefinition.scope;
        } else {
            return Table.MODEL_SCOPE_UNKNOWN;
        }
    }

    /**
     * テーブルが存在するか確認するメソッド
     * @returns {Promise<boolean>} - テーブルが存在する場合はtrue、存在しない場合はfalseを返します。
     */
    async exists() {
        try {
            const result = await this.knex.schema.hasTable(this.table_name);
            return result;
        } catch (err) {
            console.error(`Error checking if table '${this.table_name}' exists:`, err);
            if(err.errors && err.errors.length > 0) {
                for(let error of err.errors) {
                    console.error(`Error: ${error.message}`);
                }
            }
            return false;
        }
    }

    /**
     * カラムを作成するヘルパーメソッド
     * @param {object} table - Knexテーブルビルダーオブジェクト
     * @param {string} fieldName - カラム名
     * @param {object} fieldDef - カラム定義オブジェクト
     */
    createColumn(table, fieldName, fieldDef) {
        let column;
        switch (fieldDef.type) {
            case 'INTEGER':
                column = fieldDef.autoIncrement ? table.increments(fieldName) : table.integer(fieldName);
                break;
            case 'SMALLINT':
                column = fieldDef.autoIncrement ? table.increments(fieldName) : table.smallint(fieldName);
                break;
            case 'VARCHAR':
            case 'STRING':
                column = table.string(fieldName, fieldDef.length || 255);
                break;
            case 'TEXT':
                column = table.text(fieldName);
                break;
            case 'DATETIME':
                column = table.timestamp(fieldName).defaultTo(this.knex.fn.now());
                break;
            case 'BOOLEAN':
                column = table.boolean(fieldName);
                break;
            case 'FLOAT':
                column = table.float(fieldName);
                break;
            case 'DOUBLE':
                column = table.double(fieldName);
                break;
            case 'NUMERIC':
            case 'DECIMAL':
                column = table.decimal(fieldName, fieldDef.precision, fieldDef.scale);
                break;
            case 'JSON':
                column = table.json(fieldName);
                break;
            case 'JSONB':
                column = table.jsonb(fieldName);
                break;
            default:
                throw new Error(`Unsupported column type: ${fieldDef.type}`);
        }        if (fieldDef.primaryKey) column.primary();
        if (fieldDef.notNull) column.notNullable();
        if (fieldDef.defaultValue) column.defaultTo(this.knex.raw(fieldDef.defaultValue));
        if (fieldDef.default !== undefined) {
            if (fieldDef.type === 'BOOLEAN') {
                column.defaultTo(fieldDef.default);
            } else if (fieldDef.default === 'CURRENT_TIMESTAMP') {
                column.defaultTo(this.knex.fn.now());
            } else {
                column.defaultTo(fieldDef.default);
            }
        }
        if (fieldDef.nullable) column.nullable();
        if (fieldDef.unique) column.unique();
    }    /**
     * JSON定義からテーブルを作成するメソッド
     * @param {object} jsonData - テーブル定義のJSONオブジェクト
     */
    async createTable(jsonData) {
        try {
            if (jsonData) {
                this.tableDefinition = jsonData;
                this.table_name = this.tableDefinition.name;
            }
            if (!this.tableDefinition) {
                throw new Error(`Table '${this.table_name}' definition not found`);
            }
            
            const exists = await this.exists();
            
            if (!exists) {
                try {
                    await this.knex.schema.createTable(this.tableDefinition.name, (table) => {
                        for (const fieldDef of this.tableDefinition.fields) {
                            this.createColumn(table, fieldDef.name, fieldDef);
                        }
                    });
                    console.log(`Table '${this.table_name}' created`);
                } catch (createErr) {
                    // テーブル作成中にエラーが発生した場合、関連オブジェクトを確認
                    console.error(`Error creating table '${this.table_name}':`, createErr);
                    
                    // シーケンスの存在を確認
                    const sequenceName = `${this.table_name}_${this.tableDefinition.fields.find(f => f.primaryKey)?.name}_seq`;
                    const sequenceExists = await this.knex.raw(`
                        SELECT 1 FROM pg_class WHERE relname = ? AND relkind = 'S'
                    `, [sequenceName])
                        .then(result => result.rows.length > 0)
                        .catch(() => false);
                    
                    if (sequenceExists) {
                        console.warn(`シーケンス '${sequenceName}' がすでに存在します。同名の古いテーブルの残骸かもしれません。`);
                        console.warn(`手動クリーンアップのために 'drop-tables.mjs' スクリプトを実行することをお勧めします。`);
                    }
                    
                    throw createErr; // エラーを再スロー
                }
            } else {
                console.log(`Table '${this.table_name}' already exists`);
            }
        } catch (err) {
            console.error(`Error creating table '${this.table_name}':`, err);
            throw err; // エラーを上位に伝播させる
        }
    }

    /**
     * 接続を開くメソッド
     */
    async connect() {
        try {
            await this.knex.raw('SELECT 1+1 AS result'); // データベースに接続を確認するためのクエリ
            console.log('Connected to PostgreSQL database');
        } catch (err) {
            console.error('Failed to connect to PostgreSQL database', err);
        }
    }

    /**
     * 接続を閉じるメソッド
     */
    async disconnect() {
        try {
            await this.knex.destroy(); // データベース接続を閉じる
            console.log('Disconnected from PostgreSQL database');
        } catch (err) {
            console.error('Failed to disconnect from PostgreSQL database', err);
        }
    }

    /**
     * テーブルを空にするメソッド
     */
    async truncateTable() {
        try {
            await this.knex(this.table_name).truncate();
        } catch (err) {
            console.error('Truncate table error', err.stack);
        }
    }

    /**
     * テーブルを削除するメソッド
     */
    async dropTable() {
        try {
            let exists = await this.exists();
            if (exists) {
                await this.knex.schema.dropTable(this.table_name);
                console.log(`Table '${this.table_name}' dropped`);
            } else {
                console.log(`Table '${this.table_name}' does not exist`);
            }
        } catch (err) {
            console.error('Drop table error', err.stack);
        }
    }

    /**
     * テーブルの定義から新規データのひな形をJSONで作成するメソッド
     * @returns {object} - 新規データのひな形
     */
    async getJsonTemplate() {
        let template = {};
        for (const fieldDef of this.tableDefinition.fields) {
            const fieldName = fieldDef.name;
            if (fieldDef.defaultValue) {
                // デフォルト値がCURRENT_TIMESTAMPの場合は現在時刻を設定
                if (fieldDef.defaultValue === 'CURRENT_TIMESTAMP') {
                    template[fieldName] = new Date();
                } else {
                    // デフォルト値がその他の場合はその値を設定
                    template[fieldName] = fieldDef.defaultValue;
                }
            } else {
                // notNullが設定されている場合はnullを設定
                if (fieldDef.notNull) {
                    template[fieldName] = null;
                }
            }
            // deleted_atカラムをnullに設定
            if (fieldName === 'deleted_at') {
                template[fieldName] = null;
            }
        }
        return template;
    }

    /**
     * ページング情報を取得するメソッド
     * @param {*} filter - データ検索フィルター
     * @param {*} recordLimit - 1ページあたりの表示件数
     * @param {*} page - 現在のページ番号
     * @returns {Object} ページング情報
     */
    async getPagingInfo(filter, recordLimit, page) {
        if (recordLimit < 1) {
            recordLimit = 20;
        }
        if (page < 1) {
            page = 1;
        }
        let count = await this.getCount(filter);
        let pages = Math.ceil(count / recordLimit);
        if (pages < 1) pages = 1; // 最低1ページは表示
        
        let offset = (page - 1) * recordLimit;
        if (page > pages) { // ページ数が最大ページ数を超える場合は最大ページ数に設定
            page = pages;
            offset = (page - 1) * recordLimit;
        }
        return {
            totalItems: count,
            count: count, // 後方互換性のため残す
            pages: pages,
            currentPage: page,
            offset: offset,
            recordsPerPage: recordLimit,
            hasNext: page < pages,
            hasPrevious: page > 1
        };
    }

    /**
     * フィルタ条件に一致するデータの件数を取得するメソッド
     * @param {*} filter 
     * @returns 
     */
    async getCount(filter) {
        try {
            let query = this.knex(this.table_name).where({ deleted_at: null }).count({ count: '*' });
            // フィルターからキャッシュ回避用パラメータなどを除外
            const cleanedFilter = this.cleanFilter(filter);
            
            if (cleanedFilter) {
                // テキスト検索のための特殊処理
                const textSearchValue = cleanedFilter.name || cleanedFilter.search;
                if (textSearchValue) {
                    // テキスト検索を適用するために、テーブル定義からテキスト型のカラムを取得
                    const textColumns = this.getTextSearchColumns();
                    
                    if (textColumns.length > 0) {
                        // フィルタから検索用パラメータを削除（個別に処理するため）
                        delete cleanedFilter.name;
                        delete cleanedFilter.search;
                        
                        // 複数カラムに対するOR条件で検索
                        query = query.where(function() {
                            const builder = this;
                            textColumns.forEach((column, index) => {
                                if (index === 0) {
                                    builder.where(column, 'like', `%${textSearchValue}%`);
                                } else {
                                    builder.orWhere(column, 'like', `%${textSearchValue}%`);
                                }
                            });
                        });
                    }
                }
                
                // 残りのフィルタを適用
                for (const [key, value] of Object.entries(cleanedFilter)) {
                    if (Array.isArray(value)) {
                        if (value.length === 0) {
                            continue; // 空の配列はスキップ
                        }
                        if (typeof value[0] === 'string' && value[0].includes('|')) {
                            for (let i = 0; i < value.length; i++) {
                                if (value[i] && value[i].includes('|')) {
                                    const values = value[i].split('|');
                                    if (values.length === 2) {
                                        query = query.where(key, values[0], values[1]);
                                    }
                                }
                            }
                        } else {
                            // 配列から undefined や null を除外
                            const filteredValues = value.filter(item => item !== undefined && item !== null);
                            if (filteredValues.length > 0) {
                                query = query.whereIn(key, filteredValues);
                            }
                        }
                    } else if (typeof value === 'string' && value.includes('|')) {
                        const values = value.split('|');
                        if (values.length === 2) {
                            query = query.where(key, values[0], values[1]);
                        } else {
                            query = query.where(key, value);
                        }
                    } else {
                        if (value === null) {
                            query = query.whereNull(key);
                            continue;
                        }
                        if (value === undefined) {
                            continue; // undefined 値はスキップ
                        }
                        const lowerValue = typeof value === 'string' ? value.toLowerCase() : value;
                        if (lowerValue === 'is not null') {
                            query = query.whereNotNull(key);
                        } else if (lowerValue === 'is null') {
                            query = query.whereNull(key);
                        } else {
                            query = query.where(key, value);
                        }
                    }
                }
            }
            let result = await query;
            // console.log(`query: ${query.toString()}`); // デバッグ用
            let recordCount = result[0].count;
            return recordCount;
        } catch (err) {
            console.error('Count data error', err.stack);
            throw err;
        }
    }

    /**
     * テーブルのデータを取得するメソッド
     * @param {object} [filter] - データ取得のためのフィルタオブジェクト
     * @param {number} [limit] - 取得するデータの最大数。デフォルトは-1(全て)
     * @param {number} [offset] - 取得するデータのオフセット。デフォルトは0(先頭)
     * @returns {Promise<object[]>} - 取得したデータの配列
     */
    async get(filter, limit = -1, offset = 0) {
        try {
            let query = this.knex(this.table_name).where({ deleted_at: null });
            if (limit > 0) {
                query = query.limit(limit).offset(offset);
            }
            
            // フィルターからキャッシュ回避用パラメータなどを除外
            const cleanedFilter = this.cleanFilter(filter);
            
            if (cleanedFilter) {
                // テキスト検索のための特殊処理
                const textSearchValue = cleanedFilter.name || cleanedFilter.search;
                if (textSearchValue) {
                    // テキスト検索を適用するために、テーブル定義からテキスト型のカラムを取得
                    const textColumns = this.getTextSearchColumns();
                    
                    if (textColumns.length > 0) {
                        // フィルタから検索用パラメータを削除（個別に処理するため）
                        delete cleanedFilter.name;
                        delete cleanedFilter.search;
                        
                        // 複数カラムに対するOR条件で検索
                        query = query.where(function() {
                            const builder = this;
                            textColumns.forEach((column, index) => {
                                if (index === 0) {
                                    builder.where(column, 'like', `%${textSearchValue}%`);
                                } else {
                                    builder.orWhere(column, 'like', `%${textSearchValue}%`);
                                }
                            });
                        });
                    }
                }
                
                // 残りのフィルタを適用
                for (const [key, value] of Object.entries(cleanedFilter)) {
                    if (Array.isArray(value)) {
                        if (value.length === 0) {
                            continue; // 空の配列はスキップ
                        }
                        if (typeof value[0] === 'string' && value[0].includes('|')) {
                            for (let i = 0; i < value.length; i++) {
                                if (value[i] && value[i].includes('|')) {
                                    const values = value[i].split('|');
                                    if (values.length === 2) {
                                        query = query.where(key, values[0], values[1]);
                                    }
                                }
                            }
                        } else {
                            // 配列から undefined や null を除外
                            const filteredValues = value.filter(item => item !== undefined && item !== null);
                            if (filteredValues.length > 0) {
                                query = query.whereIn(key, filteredValues);
                            }
                        }
                    } else if (typeof value === 'string' && value.includes('|')) {
                        const values = value.split('|');
                        if (values.length === 2) {
                            query = query.where(key, values[0], values[1]);
                        } else {
                            query = query.where(key, value);
                        }
                    } else {
                        if (value === null) {
                            query = query.whereNull(key);
                            continue;
                        }
                        if (value === undefined) {
                            continue; // undefined 値はスキップ
                        }
                        const lowerValue = typeof value === 'string' ? value.toLowerCase() : value;
                        if (lowerValue === 'is not null') {
                            query = query.whereNotNull(key);
                        } else if (lowerValue === 'is null') {
                            query = query.whereNull(key);
                        } else {
                            query = query.where(key, value);
                        }
                    }
                }
            }
            
            // コンソールログにクエリを出力（デバッグ用）
            console.log(`SQL query: ${query.toString()}`);
            
            let result = await query;
            return result;
        } catch (err) {
            console.error('Get data error', err.stack);
            return [{
                result: '500',
                message: 'Get data error',
                error: err.stack
            }];
        }
    }
    
    /**
     * テキスト検索に使用できるカラムのリストを取得する
     * @returns {string[]} 検索可能なテキスト型カラムの配列
     */
    getTextSearchColumns() {
        if (!this.tableDefinition || !this.tableDefinition.fields) {
            return [];
        }
        
        const textTypes = ['VARCHAR', 'STRING', 'TEXT'];
        return this.tableDefinition.fields
            .filter(field => textTypes.includes(field.type))
            .map(field => field.name);
    }

    /**
     * テーブルにデータを挿入するメソッド
     * @param {object} data - 挿入するデータオブジェクト
     * @returns {Promise<number[]>} - 挿入されたデータにID列を補完して返す
     */
    async put(data, onConflict = 'ignore') {
        try {

            // tableDefinitionからuniqueを取得
            let definition = this.tableDefinition.fields;
            let unique = definition.filter((field) => field.unique === true);
            let uniqueKeys = unique.map((field) => field.name);

            if (uniqueKeys.length > 0) {
                if (onConflict === 'ignore') {
                    await this.knex(this.table_name).insert(data)
                        .onConflict(uniqueKeys)
                        .ignore();
                } else {
                    await this.knex(this.table_name).insert(data)
                        .onConflict(uniqueKeys)
                        .merge();
                }
            } else {
                await this.knex(this.table_name).insert(data);
            }

            // dataからfilterを作成
            let filter = {};
            for (const [key, value] of Object.entries(data)) {
                filter[key] = value;
            }

            let records = await this.get(filter);
            return records[0];
        } catch (err) {
            console.error('Insert data error: ', err.stack);
            throw err;
        }
    }

    /**
     * テーブルのデータを更新するメソッド
     * @param {object} data - 更新するデータオブジェクト
     * @returns {Promise<number>} - 更新された行数
     */
    async post(data) {
        try {
            if (!await this.hasPrimaryKey(data)) {
                throw new Error(`post data error: table "${this.tableDefinition.name}" primary key not found`);
            }

            // primaryKeyを取得
            let definition = this.tableDefinition.fields;
            let primaryKey = definition.filter((field) => field.primaryKey === true);
            let where = {};
            for (let i = 0; i < primaryKey.length; i++) {
                where[primaryKey[i].name] = data[primaryKey[i].name];
                delete data[primaryKey[i].name];
            }
            data.updated_at = new Date();
            let updatedCount = await this.knex(this.table_name).where(where).update(data);
            let result = {
                result: '200',
                message: `${updatedCount} rows updated.`
            }
            return result;
        } catch (err) {
            console.error('Update data error', err.stack);
            throw err;
        }
    }

    /**
     * テーブルのデータを削除するメソッド
     * @param {object} filter - 削除するデータのフィルタオブジェクト
     * @returns {Promise<number>} - 削除された行数
     */
    async delete(filter) {
        if (!await this.hasPrimaryKey(filter)) {
            throw new Error('delete data error: primary key not found');
        }
        let deletedCount = await this.knex(this.table_name).where(filter)
            .update({ deleted_at: new Date() });
        let result = {
            result: '200',
            message: `${deletedCount} rows deleted.`
        }
        return result;
    };

    /**
     * データがprimaryKeyを持つか確認するメソッド
     */
    async hasPrimaryKey(data) {
        let definition = this.tableDefinition.fields;
        let primaryKey = definition.filter((field) => field.primaryKey === true);
        let hasPrimaryKey = false;
        for (let i = 0; i < primaryKey.length; i++) {
            if (data[primaryKey[i].name]) {
                hasPrimaryKey = true;
                break;
            }
        }
        return hasPrimaryKey;
    }

    /**
     * 任意のSQLクエリを実行するメソッド.
     * 複雑なSQLの発行や、複数のテーブルを結合する場合に使用します.
     *
     * @param {string} query - 実行するSQLクエリ
     * @param {object} [params] - クエリに渡すパラメータ
     * @returns {Promise<object>} - クエリの実行結果
     */
    async executeRawQuery(query, params) {
        try {
            const result = await this.knex.raw(query, params);
            return result;
        } catch (err) {
            console.error('Execute raw query error', err.stack);
            throw err;
        }
    }

    /**
     * キャッシュ回避やUI表示用の特殊なパラメータを除外するヘルパーメソッド
     * @param {object} filter - 元のフィルターオブジェクト
     * @returns {object} - 特殊パラメータを除外したフィルターオブジェクト
     */
    cleanFilter(filter) {
        if (!filter) return filter;
        
        const cleanedFilter = {};
        // キャッシュ回避や特殊用途のパラメータリスト
        const excludedParams = [
            't', '_', 'timestamp', 'cache', 
            'page', 'limit',  // クライアント側から送信されるページネーションパラメータ
            'page_size', 'current_page' // サーバー側で使用するページネーションパラメータ
        ]; 
        
        for (const [key, value] of Object.entries(filter)) {
            // 除外リストに含まれるパラメータは無視
            if (!excludedParams.includes(key)) {
                cleanedFilter[key] = value;
            }
        }
        
        return cleanedFilter;
    }
}
