import { Connection } from './models/connection.mjs'; // 正しいパスに修正
import { ModelManager } from './models/model-manager.mjs';

let conn = new Connection();
await conn.connect();

let modelManager = new ModelManager();
modelManager.reloadModels();

let proj = modelManager.getModel('project');
console.log(await proj.exists());
await proj.dropTable();
await proj.createTable();
await proj.truncateTable();

let projectTemplate = await proj.getJsonTemplate();
delete projectTemplate.id;
projectTemplate.name = 'My Project';
projectTemplate.description = 'This is a test project';

// undefinedの値を削除
Object.keys(projectTemplate).forEach(key => {
    if (projectTemplate[key] === undefined) {
        console.log(`Deleting ${key}`);
        delete projectTemplate[key];
    }
});


await proj.put(projectTemplate);

console.log(JSON.stringify(projectTemplate, null, 2));

await proj.get({name : ['like', 'M%']}).then((projects) => {
    console.log(JSON.stringify(projects, null, 2));
});
