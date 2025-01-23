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

let userDomain = await modelManager.getModel('user_domain');
let userDomainTemplate = await userDomain.getJsonTemplate();
delete userDomainTemplate.id;
userDomainTemplate.domain_name = 'system';
userDomainTemplate.domain_description = 'System domain';
await userDomain.put(userDomainTemplate);
console.log("System domain created.");
userDomain = await userDomain.get({ domain_name: 'system' });
let userDomainId = userDomain[0].id;

let userTable = await modelManager.getModel('user');
let user = await userTable.get();
if(user.length === 0) {
    let userTemplate = await userTable.getJsonTemplate();

    delete userTemplate.id;
    userTemplate.user_email = process.env.ADMIN_MAIL;
    userTemplate.user_password = await credential.hashPassword(process.env.ADMIN_PASSWORD);
    userTemplate.user_name = process.env.ADMIN_USER;
    userTemplate.secret_key = await credential.generateSecretKey(userTemplate.user_password);
    userTemplate.user_domain_id = userDomainId;
    userTemplate.admin_flag = 1;

    await userTable.put(userTemplate);

    let user = await userTable.get();
    
    userTemplate.access_token = credential.generateToken({ user: userTemplate.user_name, password: userTemplate.user_password, type: 'access_token' }, userTemplate.secret_key, '1d');
    userTemplate.refresh_token = credential.generateToken({ user: userTemplate.user_name, password: userTemplate.user_password, type: 'refresh_token' }, userTemplate.secret_key, '90d');
    fs.writeFileSync('token.txt', JSON.stringify(userTemplate, null, 2));
    console.log('********************************');
    console.log('token.txt created.');
    console.log('this file user info,');
    console.log(' contains access_token and refresh_token.');
    console.log('********************************');
    let result = await credential.verifyJWT(userTemplate.secret_key, userTemplate.access_token);

}

await conn.disconnect();
