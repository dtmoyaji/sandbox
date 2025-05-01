import fs from 'fs';
import * as credential from './controllers/credential.mjs';

import dotenv from 'dotenv';
import { exit } from 'process';
import { ModelManager } from './controllers/model-manager.mjs';
import { Connection } from './models/connection.mjs';

dotenv.config();

let conn = new Connection();
await conn.connect();

let modelManager = new ModelManager();
await modelManager.reloadModels();

for (const model of modelManager.models) {
    console.log(model.table_name);
    await model.dropTable();
    await model.createTable();
}
// create system domain
let userDomain = await modelManager.getModel('user_domain');
let userDomainTemplate = await userDomain.getJsonTemplate();

delete userDomainTemplate.domain_user_id;
userDomainTemplate.domain_type = 'system';
userDomainTemplate.domain_name = 'system';
userDomainTemplate.domain_description = 'System domain';

await userDomain.put(userDomainTemplate);
console.log("System domain created.");
let userDomainData = await userDomain.get({ domain_name: 'system' });
let systemDomainId = userDomainData[0].user_domain_id;

// create lineworks bot controller domain
userDomainTemplate = await userDomain.getJsonTemplate();
delete userDomainTemplate.domain_user_id;
userDomainTemplate.domain_type = 'user';
userDomainTemplate.domain_name = process.env.USER_DOMAIN_NAME;
userDomainTemplate.domain_description = `Domain of ${userDomainTemplate.domain_name}`;
await userDomain.put(userDomainTemplate);
console.log(`Domain ${userDomainTemplate.domain_name} created.`);
let targetUserDomain = await userDomain.get({ domain_name: userDomainTemplate.domain_name });
let userDomainId = targetUserDomain[0].user_domain_id;

let userTable = await modelManager.getModel('user');
let user = await userTable.get();
if (user.length === 0) {
    // create admin user
    let userTemplate = await userTable.getJsonTemplate();

    delete userTemplate.user_id;
    userTemplate.user_email = process.env.ADMIN_MAIL || "admin@localhost";
    userTemplate.user_password = await credential.hashPassword(process.env.ADMIN_PASSWORD || "admin");
    userTemplate.user_name = process.env.ADMIN_USER || "admin";
    userTemplate.user_display_name = process.env.ADMIN_DISPLAY_NAME || "システム管理者";
    
    // secret_keyを適切に生成
    try {
        let secretKeyValue = await credential.generateSecretKey(userTemplate.user_password);
        // 生成された値がオブジェクトや配列の場合、JSON文字列に変換
        if (typeof secretKeyValue === 'object') {
            secretKeyValue = JSON.stringify(secretKeyValue);
        }
        // 文字列でない場合、文字列に変換
        if (typeof secretKeyValue !== 'string') {
            secretKeyValue = String(secretKeyValue);
        }
        // 長さ制限
        userTemplate.secret_key = secretKeyValue.substring(0, 255);
        
        console.log(`Admin secret_key created (${userTemplate.secret_key.length} chars)`);
    } catch (error) {
        console.error("Error creating admin secret_key:", error);
        // エラー時のフォールバック値
        userTemplate.secret_key = "admin_default_secret_key_" + Date.now();
    }
    
    userTemplate.admin_flag = 1;
    userTemplate = await userTable.put(userTemplate);

    // create system domain link
    let systemDomainLinkTable = await modelManager.getModel('user_domain_link');
    let systemDomainLinkTemplate = await systemDomainLinkTable.getJsonTemplate();
    systemDomainLinkTemplate.user_id = userTemplate.user_id;
    systemDomainLinkTemplate.user_domain_id = systemDomainId;
    await systemDomainLinkTable.put(systemDomainLinkTemplate);

    // systemをアプリケーションに登録
    let applicationTable = await modelManager.getModel('application');
    let applicationTemplate = await applicationTable.getJsonTemplate();
    delete applicationTemplate.application_id;
    applicationTemplate.application_name = 'system';
    applicationTemplate.application_protection = 'protected';
    applicationTemplate.application_description = 'system application';
    applicationTemplate = await applicationTable.put(applicationTemplate);

    // application_domain_linkに登録
    let applicationDomainLinkTable = await modelManager.getModel('application_domain_link');
    let applicationDomainLinkTemplate = await applicationDomainLinkTable.getJsonTemplate();
    applicationDomainLinkTemplate.application_id = applicationTemplate.application_id;
    applicationDomainLinkTemplate.user_domain_id = systemDomainId;
    await applicationDomainLinkTable.put(applicationDomainLinkTemplate);

    userTemplate.access_token = credential.generateToken(
        { 
            user: userTemplate.user_name, 
            password: userTemplate.user_password, 
            type: 'access_token' 
        }, 
        // secret_keyが文字列でない場合は.keyプロパティを使用
        typeof userTemplate.secret_key === 'string' 
            ? userTemplate.secret_key 
            : userTemplate.secret_key.key || userTemplate.secret_key, 
        '1d'
    );
    
    userTemplate.refresh_token = credential.generateToken(
        { 
            user: userTemplate.user_name, 
            password: userTemplate.user_password, 
            type: 'refresh_token' 
        }, 
        // secret_keyが文字列でない場合は.keyプロパティを使用
        typeof userTemplate.secret_key === 'string' 
            ? userTemplate.secret_key 
            : userTemplate.secret_key.key || userTemplate.secret_key, 
        '90d'
    );
    
    // token.txtに書き込む前にsecret_keyが文字列になっていることを確認
    const tokenData = {...userTemplate};
    if (typeof tokenData.secret_key === 'object' && tokenData.secret_key !== null) {
        // オブジェクトの場合はkeyプロパティを使用
        tokenData.secret_key = tokenData.secret_key.key || JSON.stringify(tokenData.secret_key);
    }
    
    fs.writeFileSync('token.txt', JSON.stringify(tokenData, null, 2));
    console.log('********************************');
    console.log('token.txt created.');
    console.log('this file contains admin user info,');
    console.log('initial access_token and refresh_token.');
    console.log('********************************');
    
    // verifyJWTも同様に修正
    const secretKeyForVerify = typeof userTemplate.secret_key === 'string' 
        ? userTemplate.secret_key 
        : userTemplate.secret_key.key || userTemplate.secret_key;
    
    let result = await credential.verifyJWT(secretKeyForVerify, userTemplate.access_token);

    // create lineworks bot controller domain
    userTemplate = await userTable.getJsonTemplate();
    delete userTemplate.user_id;
    userTemplate.user_email = process.env.USER_ADMIN_MAIL || "user_admin@localhost";
    userTemplate.user_password = await credential.hashPassword(process.env.USER_ADMIN_PASSWORD || "user_admin");
    userTemplate.user_name = process.env.USER_ADMIN_USER || "user_admin";
    userTemplate.user_display_name = process.env.USER_ADMIN_DISPLAY_NAME || "ドメイン管理者";
    
    // secret_keyを適切に生成
    try {
        let secretKeyValue = await credential.generateSecretKey(userTemplate.user_password);
        // 生成された値がオブジェクトや配列の場合、JSON文字列に変換
        if (typeof secretKeyValue === 'object') {
            secretKeyValue = JSON.stringify(secretKeyValue);
        }
        // 文字列でない場合、文字列に変換
        if (typeof secretKeyValue !== 'string') {
            secretKeyValue = String(secretKeyValue);
        }
        // 長さ制限
        userTemplate.secret_key = secretKeyValue.substring(0, 255);
        
        console.log(`User admin secret_key created (${userTemplate.secret_key.length} chars)`);
    } catch (error) {
        console.error("Error creating user admin secret_key:", error);
        // エラー時のフォールバック値
        userTemplate.secret_key = "user_admin_default_secret_key_" + Date.now();
    }
    
    userTemplate.admin_flag = 1;
    userTemplate = await userTable.put(userTemplate);

    // create user domain link
    let userDomainLink = await systemDomainLinkTable.getJsonTemplate();
    userDomainLink.user_id = userTemplate.user_id;
    userDomainLink.user_domain_id = userDomainId;
    await systemDomainLinkTable.put(userDomainLink);

    // user domain general user
    userTemplate = await userTable.getJsonTemplate();
    delete userTemplate.user_id;
    userTemplate.user_email = 'general_user@localhost';
    userTemplate.user_password = await credential.hashPassword('general_user');
    userTemplate.user_name = 'general_user';
    userTemplate.user_display_name = 'General User';
    
    // secret_keyを適切に生成
    try {
        let secretKeyValue = await credential.generateSecretKey(userTemplate.user_password);
        // 生成された値がオブジェクトや配列の場合、JSON文字列に変換
        if (typeof secretKeyValue === 'object') {
            secretKeyValue = JSON.stringify(secretKeyValue);
        }
        // 文字列でない場合、文字列に変換
        if (typeof secretKeyValue !== 'string') {
            secretKeyValue = String(secretKeyValue);
        }
        // 長さ制限
        userTemplate.secret_key = secretKeyValue.substring(0, 255);
        
        console.log(`General user secret_key created (${userTemplate.secret_key.length} chars)`);
    } catch (error) {
        console.error("Error creating general user secret_key:", error);
        // エラー時のフォールバック値
        userTemplate.secret_key = "general_user_default_secret_key_" + Date.now();
    }
    
    userTemplate.admin_flag = 0;
    userTemplate = await userTable.put(userTemplate);

    // create general user domain link
    userDomainLink = await systemDomainLinkTable.getJsonTemplate();
    userDomainLink.user_id = userTemplate.user_id;
    userDomainLink.user_domain_id = userDomainId;
    await systemDomainLinkTable.put(userDomainLink);

    // query_templateのサンプル実装
    let queryTemplate = await modelManager.getModel('query_template');
    let queryTemplateJson = await queryTemplate.getJsonTemplate();
    delete queryTemplateJson.id;
    queryTemplateJson.user_scope = 'user_readonly';
    queryTemplateJson.name = 'sample_query';
    queryTemplateJson.query = `
        SELECT * FROM "user" usr
        inner join user_domain_link udl on usr.user_id = udl.user_id
        inner join user_domain ud on udl.user_domain_id = ud.user_domain_id
        where usr.user_name = :user_name`;
    queryTemplateJson.parameters = '{ user_name: "string" }';
    queryTemplateJson.description = 'サンプルクエリ';
    queryTemplateJson.application_id = 1;
    await queryTemplate.put(queryTemplateJson);
}

await conn.disconnect();
exit(0);
