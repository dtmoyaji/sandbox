import { v4 as uuidv4 } from 'uuid'; // uuidパッケージをインポート
import { Table } from './table.mjs';

// Projectクラスの定義
export class Project extends Table {

    table_name = 'project'; // テーブル名
    
    // テーブルを作成するメソッド
    async createTable() {
        try {
            const exists = await this.knex.schema.hasTable(this.table_name);
            if (!exists) {
                await this.knex.schema.createTable(this.table_name, (table) => {
                    table.increments('id').primary();
                    table.string('key').notNullable();
                    table.string('name').notNullable();
                    table.text('description');
                    table.timestamp('created_at').defaultTo(this.knex.fn.now());
                    table.timestamp('deleted_at').nullable();
                });
            }
        } catch (err) {
            console.error('Create table error', err.stack);
        }
    }

    // 新しいプロジェクトを作成するメソッド
    async newProject(name, description) {
        const key = uuidv4();
        await this.knex(this.table_name)
            .insert({ key, name, description });
        return key;
    }

    // プロジェクトを取得するメソッド
    async getProject(key) {
        return await this.knex(this.table_name)
            .where({ key, deleted_at: null }).first();
    }

    // プロジェクトを更新するメソッド
    async updateProject(key, name, description) {
        return await this.knex(this.table_name)
            .where({ key, deleted_at: null })
            .update({ name, description });
    }

    // プロジェクトを削除するメソッド
    async deleteProject(key) {
        return await this.knex(this.table_name)
            .where({ key })
            .update({ deleted_at: new Date() });
    }

    // すべてのプロジェクトを取得するメソッド
    async getAllProjects() {
        return await this.knex(this.table_name)
            .where({ deleted_at: null });
    }

    // keyからプロジェクトを取得するメソッド
    async getProjectByKey(key) {
        return await this.knex(this.table_name)
            .where({ key, deleted_at: null })
            .first();
    }

    // idからプロジェクトを取得するメソッド
    async getProjectById(id) {
        return await this.knex(this.table_name)
            .where({ id, deleted_at: null })
            .first();
    }

    // nameからプロジェクトを取得するメソッド
    async getProjectByName(name) {
        return await this.knex(this.table_name)
            .where({ name, deleted_at: null })
            .first();
    }

}
