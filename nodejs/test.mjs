import dotenv from 'dotenv';
import fs from 'fs';
import * as credencial from './controllers/credencial.mjs';
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
userDomain = await userDomain.get({ domain_name: 'system' });
let userDomainId = userDomain[0].id;

let userTable = await modelManager.getModel('user');
let user = await userTable.get();
if(user.length === 0) {
    let userTemplate = await userTable.getJsonTemplate();

    delete userTemplate.id;
    userTemplate.user_email = process.env.ADMIN_MAIL;
    userTemplate.user_password = await credencial.hashPassword(process.env.ADMIN_PASSWORD);
    userTemplate.user_name = process.env.ADMIN_USER;
    userTemplate.secret_key = await credencial.generateSecretKey(userTemplate.user_password);
    userTemplate.user_domain_id = userDomainId;
    userTemplate.admin_flag = 1;

    await userTable.put(userTemplate);

    let user = await userTable.get();
    console.log(JSON.stringify(user, null, 2));
    
    userTemplate.access_token = credencial.generateToken({ user: userTemplate.user_name, password: userTemplate.user_password }, userTemplate.secret_key, '1d');
    userTemplate.refresh_token = credencial.generateToken({ user: userTemplate.name, password: userTemplate.password }, userTemplate.secret_key, '90d');

    fs.writeFileSync('token.txt', JSON.stringify(userTemplate, null, 2));
    let result = await credencial.verifyJWT(userTemplate.secret_key, userTemplate.access_token);
    console.log(JSON.stringify(result, null, 2));

}


await conn.disconnect();
