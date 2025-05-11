import { Table } from './table.mjs';

// Hookクラスの定義
export class Hook extends Table{

    table_name = 'hook'; // テーブル名
    
    // テーブルを作成するメソッド
    async createTable() {
        try {
            const exists = await this.connection.schema.hasTable(this.table_name);
            if (!exists) {
                await this.connection.schema.createTable(this.table_name, (table) => {
                    table.increments('id').increments();
                    table.string('key').notNullable(); // プロジェクトのキー
                    table.string('entry_id').notNullable().defaultTo('0');
                    table.string('name').notNullable();
                    table.string('method').notNullable().defaultTo('GET');
                    table.string('url').notNullable();
                    table.string('params');
                    table.text('description');
                    table.timestamp('created_at').defaultTo(this.connection.fn.now());
                    table.timestamp('deleted_at').nullable();
                });
            }
        } catch (err) {
            console.error('Create table error', err.stack);
        }
    }

    // 新しいフックを作成するメソッド
    async newHook(key, name, method, url, params, description) {
        // keyをもつフックの数を取得
        const entry_id = await this.connection(this.table_name)
            .where({ key }).count('id as count').first();

        await this.connection(this.table_name)
            .insert({ key, name, entry_id, method, url, params, description });
        return entry_id;
    }

    // フックを取得するメソッド
    async getHook(key) {
        return await this.connection(this.table_name)
            .where({ key, deleted_at: null }).first();
    }

    // フックを更新するメソッド
    async updateHook(key, name, description) {
        return await this.connection(this.table_name)
            .where({ key, deleted_at: null })
            .update({ name, description });
    }

    // フックを削除するメソッド
    async deleteHook(key) {
        return await this.connection(this.table_name)
            .where({ key })
            .update({ deleted_at: new Date() });
    }

}