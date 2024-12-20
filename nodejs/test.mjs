import * as fork from './controllers/fork.mjs';
import { Connection } from './models/connection.mjs'; // 正しいパスに修正
import * as project from './models/project.mjs';

let conn = new Connection();
await conn.connect();
let proj = new project.Project(conn);
await proj.createTable();
await proj.newProject('test', 'test project');
console.log(JSON.stringify(await proj.getAllProjects(), null, 2));
await proj.updateProject('test', 'test2', 'test project2');
console.log(JSON.stringify(await proj.getAllProjects(), null, 2));
await proj.deleteProject('test');
console.log(JSON.stringify(await proj.getAllProjects(), null, 2));
await conn.close();

console.log(JSON.stringify(await fork.listScripts(), null, 2));
console.log(JSON.stringify(await fork.fork('hello', ['arg1', 'arg2']), null, 2));
