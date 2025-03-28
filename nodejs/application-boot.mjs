import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

let modelManager = undefined;

export async function bootApplications(manager) {
    modelManager = manager;
    console.log('booting applications');
    // applicationsディレクトリがない場合は処理を終了
    if (!fs.existsSync('./applications')) {
        console.log('applications not found');
        return;
    }

    let appDirs = fs.readdirSync('./applications');
    let application_id = 1;
    for (let appDir of appDirs) {
        console.log('booting application:', appDir);
        let dirRealPath = fs.realpathSync('./applications/' + appDir);
        // application.jsonが存在する場合はアプリケーションとして登録
        if (fs.existsSync(dirRealPath + '/application.json')) {
            application_id = await registerApplication(dirRealPath + '/application.json');
            if (fs.existsSync(dirRealPath + '/models')) {
                await installModel(application_id, dirRealPath + '/models');
            }
            registerApplicationDomainLink(application_id, 1);
        }
        // scriptsディレクトリが存在する場合はスクリプトとして登録
        if (fs.existsSync(dirRealPath + '/scripts')) {
            let scriptFiles = fs.readdirSync(dirRealPath + '/scripts');

            // js ファイルをスクリプトとして登録
            scriptFiles = scriptFiles.filter((file) => {
                return file.endsWith('.mjs');
            });

            for (let scriptFile of scriptFiles) {
                console.log('booting script:', scriptFile);
                let scriptFullPath = path.resolve(dirRealPath, 'scripts', scriptFile);
                let scriptUrl = pathToFileURL(scriptFullPath).href;
                let scriptDef = await import(scriptUrl);
                let script = scriptDef.default;
                let scriptTable = await modelManager.getModel('script');
                let currentScript = await scriptTable.get({ script_name: script.script_name });
                let scriptTemplate = await scriptTable.getJsonTemplate();
                scriptTemplate.application_id = application_id;
                scriptTemplate.script_name = script.script_name;
                scriptTemplate.bind_module = JSON.stringify(script.bind_module);
                // 改行を\\nに置換する
                scriptTemplate.script = script.script.replace(/\r?\n/g, '\\n');
                scriptTemplate.parameters = JSON.stringify(script.parameters);
                scriptTemplate.description = script.description;
                if (currentScript.length === 0) {
                    delete scriptTemplate.script_id;
                    scriptTemplate = await scriptTable.put(scriptTemplate);
                } else {
                    scriptTemplate.script_id = currentScript[0].script_id;
                    scriptTemplate = await scriptTable.post(scriptTemplate);
                }
            }
        }

        // data_restoreディレクトリが存在する場合はデータを復元
        if (fs.existsSync(dirRealPath + '/data_restore')) {
            let restoreFiles = fs.readdirSync(dirRealPath + '/data_restore');
            for (let restorefile of restoreFiles) {
                console.log('restoring data:', restorefile);
                let restoreFilePath = fs.realpathSync(dirRealPath + '/data_restore/' + restorefile);
                await restoreApplicationData(manager, restoreFilePath);
            }
        }
    }
    console.log('applications booted');
}

// アプリケーションのデータをリストアする
export async function restoreApplicationData(manager, filePath) {
    // ファイルが存在しない場合は処理を終了
    if (!fs.existsSync(filePath)) {
        console.log('application data not found');
        return;
    }
    // ファイルがJSONの場合
    if (filePath.endsWith('.json')) {
        await restoreApplicationJsonData(manager, filePath);
    } else if (filePath.endsWith('.csv')) {
        await resotreApplicationCsvData(manager, filePath);
    }
}

// アプリケーションのデータをリストアする(JSON)
// ファイル名はテーブル名と同一で、ノード内のキーにフィールド名を記載する想定。
export async function restoreApplicationJsonData(manager, filePath) {
    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let tableName = path.basename(filePath).replace('.json', '');
    let table = await manager.getModel(tableName);
    for (let row of data) {
        let newRow = await table.getJsonTemplate();
        for (let key in row) {
            newRow[key] = row[key];
        }
        await table.put(newRow);
    }
}

// アプリケーションのデータをリストアする(CSV)
// ファイル名はテーブル名と同一で、先頭行にフィールド名を記載する想定。
export async function resotreApplicationCsvData(manager, filePath) {
    let data = fs.readFileSync(filePath, 'utf8');
    let rows = data.split('\n');
    let rowHeader = rows[0].split(',');
    // trim header
    rowHeader = rowHeader.map((header) => {
        return header.trim();
    });
    let tableName = path.basename(filePath).replace('.csv', '');
    let table = await manager.getModel(tableName);
    let rowCount = await table.getCount({});
    console.log(table.table_name, rowCount);
    if (rowCount == 0) {
        for (let i = 1; i < rows.length; i++) {
            if (rows[i] === '') {
                continue;
            }
            let row = rows[i].split(',');
            // trim row
            row = row.map((value) => {
                return value.trim();
            });
            let newRow = await table.getJsonTemplate();
            for (let j = 0; j < rowHeader.length; j++) {
                newRow[rowHeader[j]] = row[j];
            }
            await table.put(newRow);
        }
    }
}

/**
 * データを復元する
 * @param {*} manager 
 */
export async function restoreData(manager) {
    modelManager = manager;
    console.log('restoring data');
    // data_restoreディレクトリがない場合は処理を終了
    if (!fs.existsSync('./data_restore')) {
        console.log('data_restore not found');
        return;
    }

    let restoreFiles = fs.readdirSync('./data_restore');
    for (let restorefile of restoreFiles) {
        console.log('restoring data:', restorefile);
        let dirRealPath = fs.realpathSync('./data_restore/' + restorefile);
        // ファイル名とテーブル名が一致する場合はデータを復元
        let tableName = restorefile.replace('.json', '');
        let table = await modelManager.getModel(tableName);
        // データが存在しない場合のみ復元
        if (table) {
            let rowCount = await table.getCount({});
            console.log(table.table_name, rowCount);
            if (rowCount === '0') {
                let data = JSON.parse(fs.readFileSync(dirRealPath, 'utf8'));
                for (let row of data) {
                    let newRow = await table.getJsonTemplate();
                    for (let key in row) {
                        newRow[key] = row[key];
                    }
                    await table.put(newRow);
                }
            }
        }

    }
    console.log('data restored');
}

/**
 * アプリケーションとドメインをリンクする
 * @param {*} application_id 
 * @param {*} user_domain_id 
 */
async function registerApplicationDomainLink(application_id, user_domain_id) {
    let adl = await modelManager.getModel('application_domain_link');
    let application_domain_link = await modelManager.getModel('application_domain_link');
    let applicationDomainTemplate = await application_domain_link.getJsonTemplate();
    applicationDomainTemplate.application_id = application_id;
    applicationDomainTemplate.user_domain_id = user_domain_id;
    let adlData = await adl.get(applicationDomainTemplate);
    if (adlData.length === 0) {
        applicationDomainTemplate = await application_domain_link.put(applicationDomainTemplate);
    } else {
        applicationDomainTemplate = adl[0];
    }
    return applicationDomainTemplate;
}

/**
 *  アプリケーションを登録する
 * @param {string} applicationDefFile - アプリケーション定義ファイル
 * @returns {number} application_id
 */
async function registerApplication(applicationDefFile) {
    let applicationInfo = JSON.parse(fs.readFileSync(applicationDefFile, 'utf8'));
    let applicationTable = await modelManager.getModel('application');
    // upsert application
    let application_name = applicationInfo.application_name;
    let application = await applicationTable.get({ application_name: application_name });
    if (application.length === 0) { // 登録がないので新規登録
        console.log('registering new application:', application_name);
        let applicationTmp = await applicationTable.getJsonTemplate();
        delete applicationTmp.application_id;
        applicationTmp.application_name = application_name;
        applicationTmp.application_protection = applicationInfo.application_protection;
        applicationTmp.application_description = applicationInfo.application_description;
        application = await applicationTable.put(applicationTmp);
    } else { // 登録があるので更新
        console.log('update application:', application_name);
        application[0].application_protection = applicationInfo.application_protection;
        application[0].application_description = applicationInfo.application_description;
        application = await applicationTable.post(application[0]);
        application = await applicationTable.get({ application_name: application_name });
        application = application[0];
    }
    return application.application_id;
}

async function installModel(application_id, applicationModelPath) {
    console.log('booting models');
    let modelFiles = fs.readdirSync(applicationModelPath);
    for (let modelFile of modelFiles) {
        console.log('booting model:', modelFile);
        let modelDef = fs.readFileSync(applicationModelPath + '/' + modelFile, 'utf8');
        let model = JSON.parse(modelDef);
        let application_table_def = await modelManager.getModel('application_table_def');
        let currentTableDef = await application_table_def.get({ table_logical_name: model.name });
        let table_def = await application_table_def.getJsonTemplate();
        delete table_def.application_table_def_id;
        table_def.application_id = application_id;
        table_def.table_logical_name = model.name;
        table_def.table_physical_name = model.name;
        table_def.table_def = JSON.stringify(model);
        table_def.description = model.description;
        if (currentTableDef.length === 0) {
            table_def = await application_table_def.put(table_def);
        } else {
            table_def.application_table_def_id = currentTableDef[0].application_table_def_id;
            table_def = await application_table_def.post(table_def);
        }
    }

}