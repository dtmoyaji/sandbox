// 問題のテーブルとシーケンスを削除するスクリプト
import { Connection } from './models/connection.mjs';

const tableName = 'symptom_product';
const sequenceName = `${tableName}_symptom_product_id_seq`;

async function dropTableAndSequence() {
  try {
    const connection = new Connection();
    const knex = connection.knex;
    
    console.log(`テーブル '${tableName}' の存在をチェック中...`);
    const tableExists = await knex.schema.hasTable(tableName);
    
    if (tableExists) {
      console.log(`テーブル '${tableName}' を削除中...`);
      await knex.schema.dropTable(tableName);
      console.log(`テーブル '${tableName}' を削除しました`);
    } else {
      console.log(`テーブル '${tableName}' は存在しません`);
    }
    
    // シーケンスの確認と削除
    console.log(`シーケンス '${sequenceName}' の存在をチェック中...`);
    const sequenceExists = await knex.raw(`
      SELECT 1 
      FROM pg_class 
      WHERE relname = ? AND relkind = 'S'
    `, [sequenceName])
      .then(result => result.rows.length > 0)
      .catch(err => {
        console.error('シーケンス確認エラー:', err);
        return false;
      });
    
    if (sequenceExists) {
      console.log(`シーケンス '${sequenceName}' を削除中...`);
      await knex.raw(`DROP SEQUENCE IF EXISTS "${sequenceName}" CASCADE`);
      console.log(`シーケンス '${sequenceName}' を削除しました`);
    } else {
      console.log(`シーケンス '${sequenceName}' は存在しません`);
    }
    
    // すべての関連オブジェクトをチェック
    console.log('テーブル関連のすべてのオブジェクトをチェック中...');
    const relatedObjects = await knex.raw(`
      SELECT c.relname, c.relkind 
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname LIKE ? AND n.nspname = 'public'
    `, [`${tableName}%`])
      .then(result => result.rows)
      .catch(err => {
        console.error('関連オブジェクト確認エラー:', err);
        return [];
      });
    
    if (relatedObjects.length > 0) {
      console.log('関連するオブジェクト:');
      for (const obj of relatedObjects) {
        console.log(`- ${obj.relname} (型: ${obj.relkind})`);
      }
    } else {
      console.log('関連するオブジェクトは見つかりませんでした');
    }
    
    await connection.disconnect();
    console.log('完了!');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

dropTableAndSequence();
