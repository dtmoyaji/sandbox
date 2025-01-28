import fs from 'fs';
import * as credential from './controllers/credential.mjs';

import dotenv from 'dotenv';
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
let userDomainId = userDomainData[0].user_domain_id;

// create linworks bot controller domain
userDomainTemplate = await userDomain.getJsonTemplate();
delete userDomainTemplate.domain_user_id;
userDomainTemplate.domain_type = 'user';
userDomainTemplate.domain_name = 'linworks_bot_controller';
userDomainTemplate.domain_description = 'LINWORKSのボットにメッセージを送信するためのドメイン';
await userDomain.put(userDomainTemplate);
console.log("Linworks bot controller domain created.");
let linworksBotDomain = await userDomain.get({ domain_name: 'linworks_bot_controller' });
let linworksBotDomainId = linworksBotDomain[0].user_domain_id;

let userTable = await modelManager.getModel('user');
let user = await userTable.get();
if(user.length === 0) {
    // create admin user
    let userTemplate = await userTable.getJsonTemplate();

    delete userTemplate.id;
    userTemplate.user_email = process.env.ADMIN_MAIL;
    userTemplate.user_password = await credential.hashPassword(process.env.ADMIN_PASSWORD);
    userTemplate.user_name = process.env.ADMIN_USER;
    userTemplate.secret_key = await credential.generateSecretKey(userTemplate.user_password);
    userTemplate.user_domain_id = userDomainId;
    userTemplate.admin_flag = 1;
    await userTable.put(userTemplate);

    userTemplate.access_token = credential.generateToken({ user: userTemplate.user_name, password: userTemplate.user_password, type: 'access_token' }, userTemplate.secret_key, '1d');
    userTemplate.refresh_token = credential.generateToken({ user: userTemplate.user_name, password: userTemplate.user_password, type: 'refresh_token' }, userTemplate.secret_key, '90d');
    fs.writeFileSync('token.txt', JSON.stringify(userTemplate, null, 2));
    console.log('********************************');
    console.log('token.txt created.');
    console.log('this file conains admin user info,');
    console.log('initial access_token and refresh_token.');
    console.log('********************************');
    let result = await credential.verifyJWT(userTemplate.secret_key, userTemplate.access_token);
    
    // create linworks bot controller domain
    userTemplate = await userTable.getJsonTemplate();
    delete userTemplate.id;
    userTemplate.user_email = process.env.LINWORKS_BOT_ADMIN_MAIL;
    userTemplate.user_password = await credential.hashPassword(process.env.LINWORKS_BOT_ADMIN_PASSWORD);
    userTemplate.user_name = process.env.LINWORKS_BOT_ADMIN_USER;
    userTemplate.secret_key = await credential.generateSecretKey(userTemplate.user_password);
    userTemplate.user_domain_id = linworksBotDomainId;
    userTemplate.admin_flag = 1;
    await userTable.put(userTemplate);

}

await conn.disconnect();
