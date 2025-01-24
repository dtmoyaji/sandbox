import { Connection } from './connection.mjs'; // Connectionクラスをインポート

/**
 * Tableクラスは、データベーステーブルの操作を行うためのクラスです。
 * テーブルの作成、削除、データの挿入、更新、取得などの機能を提供します。
 */
export class Table {

    static MODEL_SCOPE_PUBLIC = 'public';
    static MODEL_SCOPE_PROTECTED = 'protected';

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
            console.error('Table exists error', err.stack);
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
        }
        if (fieldDef.primaryKey) column.primary();
        if (fieldDef.notNull) column.notNullable();
        if (fieldDef.defaultValue) column.defaultTo(this.knex.raw(fieldDef.defaultValue));
        if (fieldDef.nullable) column.nullable();
    }

    /**
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
            if (!await this.exists()) {
                await this.knex.schema.createTable(this.tableDefinition.name, (table) => {
                    for (const fieldDef of this.tableDefinition.fields) {
                        this.createColumn(table, fieldDef.name, fieldDef);
                    }
                });
                console.log(`Table '${this.table_name}' created`);
            } else {
                console.log(`Table '${this.table_name}' already exists`);
            }
        } catch (err) {
            console.error(`Error creating table '${this.table_name}':`, err);
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
     * テーブルのデータを取得するメソッド
     * @param {object} [filter] - データ取得のためのフィルタオブジェクト
     * @returns {Promise<object[]>} - 取得したデータの配列
     */
    async get(filter) {
        try {
            let query = this.knex(this.table_name).where({ deleted_at: null });
            if (filter) {
                for (const [key, value] of Object.entries(filter)) {
                    if (Array.isArray(value) && value.length === 2) {
                        query = query.where(key, value[0], value[1]);
                    } else {
                        if (value === null) {
                            query = query.whereNull(key);
                            continue;
                        }
                        const lowerValue = typeof value[0] === 'string' ? value[0].toLowerCase() : value;
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

            return result;
        } catch (err) {
            console.error('Get data error', err.stack);
            throw err;
        }
    }

    /**
     * テーブルにデータを挿入するメソッド
     * @param {object} data - 挿入するデータオブジェクト
     * @returns {Promise<number[]>} - 挿入されたデータのID配列
     */
    async put(data) {
        try {

            await this.knex(this.table_name).insert(data);

            // dataからfilterを作成
            let filter = {};
            for (const [key, value] of Object.entries(data)) {
                filter[key] = value;
            }

            let record = await this.get(filter);
            let result = {
                result: '200',
                new_id: record[0].id
            };
            return result;
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
            if(!await this.hasPrimaryKey(data)) {
                throw new Error('post data error: primary key not found');
            }

            // primarykeyを取得
            let definition = this.tableDefinition.fields;
            let primarykey = definition.filter((field) => field.primaryKey === true);
            let where = {};
            for (let i = 0; i < primarykey.length; i++) {
                where[primarykey[i].name] = data[primarykey[i].name];
                delete data[primarykey[i].name];
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
        if(!await this.hasPrimaryKey(filter)) {
            throw new Error('delete data error: primary key not found');
        }
        let deltedCount = await this.knex(this.table_name).where(filter)
            .update({ deleted_at: new Date() });
        let result = {
            result: '200',
            message: `${deltedCount} rows deleted.`
        }
        return result;
    };

    /**
     * データがprimarykeyを持つか確認するメソッド
     */
    async hasPrimaryKey(data) {
        let definition = this.tableDefinition.fields;
        let primarykey = definition.filter((field) => field.primaryKey === true);
        let hasPrimaryKey = false;
        for (let i = 0; i < primarykey.length; i++) {
            if (data[primarykey[i].name]) {
                hasPrimaryKey = true;
                break;
            }
        }
        return hasPrimaryKey;
    }

    /**
     * 任意のSQLクエリを実行するメソッド
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
}
