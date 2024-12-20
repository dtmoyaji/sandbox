import * as fork from './controllers/fork.mjs';
import { Connection } from './models/connection.mjs'; // 正しいパスに修正
import * as project from './models/project.mjs';

let conn = new Connection();
await conn.connect();
let proj = new project.Project(conn);
await proj.createTable();
await proj.newProject('test', 'test project');
console.log(await proj.getAllProjects());
await proj.updateProject('test', 'test2', 'test project2');
console.log(await proj.getAllProjects());
await proj.deleteProject('test');
console.log(await proj.getAllProjects());
await conn.close();

console.log(await fork.listScripts());
console.log(await fork.fork('hello', ['arg1', 'arg2']));
