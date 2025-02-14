import fs from 'fs';

let modelManager = undefined;

export async function bootApplications(manager) {
    modelManager = manager;
    console.log('booting applications');
    let appDirs = fs.readdirSync('./applications');
    for (let appDir of appDirs) {
        console.log('booting application:', appDir);
        let dirRealPath = fs.realpathSync('./applications/' + appDir);
        // application.jsonが存在する場合はアプリケーションとして登録
        if (fs.existsSync(dirRealPath + '/application.json')) {
            let application_id = await registApplication(dirRealPath + '/application.json');
            if (fs.existsSync(dirRealPath + '/models')) {
                await installModel(application_id, dirRealPath + '/models');
            }
            registApplicationDomainLink(application_id, 1);
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
async function registApplicationDomainLink(application_id, user_domain_id) {
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
 * @param {string} applicatonDefFile - アプリケーション定義ファイル
 * @returns {number} application_id
 */
async function registApplication(applicatonDefFile) {
    let applicationInfo = JSON.parse(fs.readFileSync(applicatonDefFile, 'utf8'));
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
        let mdelDef = fs.readFileSync(applicationModelPath + '/' + modelFile, 'utf8');
        let model = JSON.parse(mdelDef);
        let application_tabledef = await modelManager.getModel('application_tabledef');
        let currentTabledef = await application_tabledef.get({ table_logical_name: model.name });
        let tabledef = await application_tabledef.getJsonTemplate();
        delete tabledef.tabledef_id;
        tabledef.application_id = application_id;
        tabledef.table_logical_name = model.name;
        tabledef.table_physical_name = model.name;
        tabledef.tabledef = JSON.stringify(model);
        tabledef.description = model.description;
        if (currentTabledef.length === 0) {
            tabledef = await application_tabledef.put(tabledef);
        } else {
            tabledef.tabledef_id = currentTabledef[0].tabledef_id;
            tabledef = await application_tabledef.post(tabledef);
        }
    }

}