import { existsSync, readdirSync, realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * モデルマネージャーのシングルトンインスタンス
 * @type {Object|undefined}
 */
let modelManager;

/**
 * アプリケーションの起動処理を行う
 * @param {Object} manager - モデルマネージャーのインスタンス
 * @returns {Promise<void>}
 */
export async function bootApplications(manager) {
    modelManager = manager;
    console.log('アプリケーション起動開始');
    
    // applicationsディレクトリの存在確認
    if (!existsSync('./applications')) {
        console.log('applications ディレクトリが見つかりません');
        return;
    }

    const appDirs = readdirSync('./applications');
    
    // 各アプリケーションディレクトリを並列処理
    await Promise.all(appDirs.map(async (appDir) => {
        try {
            console.log(`アプリケーション起動: ${appDir}`);
            const dirRealPath = realpathSync(`./applications/${appDir}`);
            const appJsonPath = path.join(dirRealPath, 'application.json');
            
            // アプリケーション登録処理
            let applicationId;
            if (existsSync(appJsonPath)) {
                applicationId = await registerApplication(appJsonPath);
                
                // モデルのインストール
                if (existsSync(path.join(dirRealPath, 'models'))) {
                    await installModel(applicationId, path.join(dirRealPath, 'models'));
                }
                
                // ドメインリンク登録
                await registerApplicationDomainLink(applicationId, 1);
            }
            
            // スクリプト登録処理
            if (existsSync(path.join(dirRealPath, 'scripts'))) {
                await registerScripts(applicationId, dirRealPath);
            }
            
            // データリストア処理
            if (existsSync(path.join(dirRealPath, 'data_restore'))) {
                await restoreApplicationDataFromDirectory(manager, path.join(dirRealPath, 'data_restore'));
            }
        } catch (error) {
            console.error(`アプリケーション ${appDir} の起動中にエラーが発生しました:`, error);
        }
    }));
    
    console.log('すべてのアプリケーションが起動しました');
}

/**
 * スクリプトの登録処理
 * @param {number} applicationId - アプリケーションID
 * @param {string} dirRealPath - アプリケーションディレクトリの実パス
 * @returns {Promise<void>}
 */
async function registerScripts(applicationId, dirRealPath) {
    const scriptsDir = path.join(dirRealPath, 'scripts');
    const scriptFiles = readdirSync(scriptsDir).filter(file => file.endsWith('.mjs'));

    await Promise.allSettled(scriptFiles.map(async (scriptFile) => {
        try {
            console.log(`スクリプト登録: ${scriptFile}`);
            const scriptFullPath = path.resolve(dirRealPath, 'scripts', scriptFile);
            const scriptUrl = pathToFileURL(scriptFullPath).href;
            
            // スクリプトモジュールのインポート
            let script;
            try {
                const importedModule = await import(scriptUrl);
                script = importedModule.default;
                
                // スクリプトのメタデータが正しくエクスポートされているか確認
                if (!script || !script.script_name) {
                    throw new Error(`スクリプト ${scriptFile} にはscript_nameが含まれていません`);
                }
            } catch (importError) {
                console.error(`スクリプト ${scriptFile} のインポート中にエラーが発生しました:`, importError);
                return; // このスクリプトの処理をスキップ
            }

            const scriptTable = await modelManager.getModel('script');
            const currentScript = await scriptTable.get({ script_name: script.script_name });
            const scriptTemplate = await scriptTable.getJsonTemplate();

            // スクリプト情報をテンプレートに設定
            Object.assign(scriptTemplate, {
                application_id: applicationId,
                script_name: script.script_name,
                bind_module: JSON.stringify(script.bind_module),
                script: script.script.replace(/\r?\n/g, '\\n'),
                parameters: JSON.stringify(script.parameters),
                description: script.description
            });

            // 既存スクリプトの更新または新規作成
            if (currentScript.length === 0) {
                delete scriptTemplate.script_id;
                await scriptTable.put(scriptTemplate);
            } else {
                scriptTemplate.script_id = currentScript[0].script_id;
                await scriptTable.post(scriptTemplate);
            }
        } catch (error) {
            console.error(`スクリプト ${scriptFile} の登録中にエラーが発生しました:`, error);
        }
    }));
}

/**
 * ディレクトリ内の全データファイルをリストア
 * @param {Object} manager - モデルマネージャーのインスタンス
 * @param {string} dirPath - データリストアディレクトリのパス
 * @returns {Promise<void>}
 */
async function restoreApplicationDataFromDirectory(manager, dirPath) {
    const restoreFiles = readdirSync(dirPath);
    
    await Promise.all(restoreFiles.map(async (restoreFile) => {
        try {
            console.log(`データリストア: ${restoreFile}`);
            const restoreFilePath = realpathSync(path.join(dirPath, restoreFile));
            await restoreApplicationData(manager, restoreFilePath);
        } catch (error) {
            console.error(`データ ${restoreFile} のリストア中にエラーが発生しました:`, error);
        }
    }));
}

/**
 * アプリケーションのデータをリストアする
 * @param {Object} manager - モデルマネージャーのインスタンス
 * @param {string} filePath - リストア対象のファイルパス
 * @returns {Promise<void>}
 */
export async function restoreApplicationData(manager, filePath) {
    if (!existsSync(filePath)) {
        console.log('アプリケーションデータが見つかりません');
        return;
    }
    
    try {
        if (filePath.endsWith('.json')) {
            await restoreApplicationJsonData(manager, filePath);
        } else if (filePath.endsWith('.csv')) {
            await restoreApplicationCsvData(manager, filePath);
        } else {
            console.log(`サポートされていないファイル形式: ${path.extname(filePath)}`);
        }
    } catch (error) {
        console.error(`データリストア中にエラーが発生しました (${filePath}):`, error);
    }
}

/**
 * JSONファイルからアプリケーションデータをリストアする
 * @param {Object} manager - モデルマネージャーのインスタンス
 * @param {string} filePath - JSONファイルのパス
 * @returns {Promise<void>}
 */
export async function restoreApplicationJsonData(manager, filePath) {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    const tableName = path.basename(filePath, '.json');
    const table = await manager.getModel(tableName);
    
    // バルクインサートの最適化のため、全テンプレートを先に取得
    const template = await table.getJsonTemplate();
    
    // データを一括処理
    const rows = data.map(row => {
        const newRow = { ...template };
        return Object.assign(newRow, row);
    });
    
    // バルク挿入（table.putBulkがある場合）、または個別挿入
    if (typeof table.putBulk === 'function') {
        await table.putBulk(rows);
    } else {
        for (const row of rows) {
            await table.put(row);
        }
    }
}

/**
 * CSVファイルからアプリケーションデータをリストアする
 * @param {Object} manager - モデルマネージャーのインスタンス
 * @param {string} filePath - CSVファイルのパス
 * @returns {Promise<void>}
 */
export async function restoreApplicationCsvData(manager, filePath) {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const rows = fileContent.split('\n');
    const headers = rows[0].split(',').map(header => header.trim());
    
    const tableName = path.basename(filePath, '.csv');
    const table = await manager.getModel(tableName);
    const rowCount = await table.getCount({});
    console.log(`${table.table_name}: ${rowCount}件のレコードが存在します`);
    
    // テーブルにデータがない場合のみインポート
    if (rowCount == 0) {
        const template = await table.getJsonTemplate();
        const dataRows = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            
            const values = row.split(',').map(value => value.trim());
            const newRow = { ...template };
            
            headers.forEach((header, j) => {
                newRow[header] = values[j];
            });
            
            dataRows.push(newRow);
        }
        
        // バルク挿入（table.putBulkがある場合）、または個別挿入
        if (typeof table.putBulk === 'function') {
            await table.putBulk(dataRows);
        } else {
            for (const row of dataRows) {
                await table.put(row);
            }
        }
    }
}

/**
 * グローバルなデータ復元処理
 * @param {Object} manager - モデルマネージャーのインスタンス
 * @returns {Promise<void>}
 */
export async function restoreData(manager) {
    modelManager = manager;
    console.log('グローバルデータのリストア開始');
    
    if (!existsSync('./data_restore')) {
        console.log('data_restore ディレクトリが見つかりません');
        return;
    }

    const restoreFiles = readdirSync('./data_restore');
    
    await Promise.all(restoreFiles.map(async (restoreFile) => {
        try {
            console.log(`グローバルデータリストア: ${restoreFile}`);
            const filePath = realpathSync(`./data_restore/${restoreFile}`);
            const tableName = path.basename(restoreFile, '.json');
            const table = await modelManager.getModel(tableName);
            
            if (table) {
                const rowCount = await table.getCount({});
                console.log(`${table.table_name}: ${rowCount}件のレコードが存在します`);
                
                if (rowCount === '0') {
                    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    const template = await table.getJsonTemplate();
                    
                    // データを一括処理
                    for (const row of data) {
                        const newRow = { ...template };
                        Object.assign(newRow, row);
                        await table.put(newRow);
                    }
                }
            }
        } catch (error) {
            console.error(`グローバルデータ ${restoreFile} のリストア中にエラーが発生しました:`, error);
        }
    }));
    
    console.log('グローバルデータのリストアが完了しました');
}

/**
 * アプリケーションとドメインをリンクする
 * @param {number} applicationId - アプリケーションID
 * @param {number} userDomainId - ユーザードメインID
 * @returns {Promise<Object>} 登録済みのアプリケーションドメインリンク情報
 */
async function registerApplicationDomainLink(applicationId, userDomainId) {
    const applicationDomainLink = await modelManager.getModel('application_domain_link');
    const template = await applicationDomainLink.getJsonTemplate();
    
    // リンク情報を設定
    template.application_id = applicationId;
    template.user_domain_id = userDomainId;
    
    // 既存のリンク情報を確認
    const existingLinks = await applicationDomainLink.get(template);
    
    // リンクが存在しない場合は作成、存在する場合はそのまま返す
    if (existingLinks.length === 0) {
        return await applicationDomainLink.put(template);
    } else {
        return existingLinks[0];
    }
}

/**
 * アプリケーションを登録する
 * @param {string} applicationDefFile - アプリケーション定義ファイルのパス
 * @returns {Promise<number>} 登録されたアプリケーションID
 */
async function registerApplication(applicationDefFile) {
    const fileContent = await fs.readFile(applicationDefFile, 'utf8');
    const applicationInfo = JSON.parse(fileContent);
    const applicationTable = await modelManager.getModel('application');
    
    // アプリケーション名でアプリケーションを検索
    const applicationName = applicationInfo.application_name;
    const existingApps = await applicationTable.get({ application_name: applicationName });
    
    let application;
    
    if (existingApps.length === 0) { 
        // 登録がないので新規登録
        console.log(`新規アプリケーション登録: ${applicationName}`);
        const template = await applicationTable.getJsonTemplate();
        
        const newApp = {
            ...template,
            application_name: applicationName,
            application_protection: applicationInfo.application_protection,
            application_description: applicationInfo.application_description
        };
        
        delete newApp.application_id;
        application = await applicationTable.put(newApp);
    } else { 
        // 登録があるので更新
        console.log(`アプリケーション更新: ${applicationName}`);
        const appToUpdate = {
            ...existingApps[0],
            application_protection: applicationInfo.application_protection,
            application_description: applicationInfo.application_description
        };
        
        await applicationTable.post(appToUpdate);
        const updatedApps = await applicationTable.get({ application_name: applicationName });
        application = updatedApps[0];
    }
    
    return application.application_id;
}

/**
 * アプリケーションのモデル定義をインストールする
 * @param {number} applicationId - アプリケーションID
 * @param {string} modelPath - モデル定義ファイルが存在するディレクトリパス
 * @returns {Promise<void>}
 */
async function installModel(applicationId, modelPath) {
    console.log('モデル定義のインストール開始');
    const modelFiles = readdirSync(modelPath);
    
    await Promise.all(modelFiles.map(async (modelFile) => {
        try {
            console.log(`モデル登録: ${modelFile}`);
            const modelDef = await fs.readFile(path.join(modelPath, modelFile), 'utf8');
            const model = JSON.parse(modelDef);
            const tableDefTable = await modelManager.getModel('application_table_def');
            
            // 既存のテーブル定義を検索
            const currentTableDef = await tableDefTable.get({ table_logical_name: model.name });
            const template = await tableDefTable.getJsonTemplate();
            
            // テーブル定義情報を設定
            const tableDef = {
                ...template,
                application_id: applicationId,
                table_logical_name: model.name,
                table_physical_name: model.name,
                table_def: JSON.stringify(model),
                description: model.description
            };
            
            delete tableDef.application_table_def_id;
            
            // 既存のテーブル定義がない場合は新規作成、ある場合は更新
            if (currentTableDef.length === 0) {
                await tableDefTable.put(tableDef);
            } else {
                tableDef.application_table_def_id = currentTableDef[0].application_table_def_id;
                await tableDefTable.post(tableDef);
            }
        } catch (error) {
            console.error(`モデル ${modelFile} のインストール中にエラーが発生しました:`, error);
        }
    }));
    
    console.log('モデル定義のインストールが完了しました');
}