import fs from 'fs';

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
    for (let appDir of appDirs) {
        console.log('booting application:', appDir);
        let dirRealPath = fs.realpathSync('./applications/' + appDir);
        // application.jsonが存在する場合はアプリケーションとして登録
        if (fs.existsSync(dirRealPath + '/application.json')) {
            let application_id = await registerApplication(dirRealPath + '/application.json');
            if (fs.existsSync(dirRealPath + '/models')) {
                await installModel(application_id, dirRealPath + '/models');
            }
            registerApplicationDomainLink(application_id, 1);
        }
    }
    console.log('applications booted');
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
    if (application.length === 0) {
        application = await applicationTable.getJsonTemplate();
        application.application_name = application_name;
        application.application_description = applicationInfo.application_description;
        application = await applicationTable.put(application);
    } else {
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