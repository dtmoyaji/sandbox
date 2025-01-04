import * as fork from './controllers/fork.mjs';
import { Scheduler, Task } from './controllers/scheduler.mjs';
import { Connection } from './models/connection.mjs'; // 正しいパスに修正
import * as project from './models/project.mjs';

let conn = new Connection();
await conn.connect();
let proj = new project.Project(conn);
await proj.createTable();
await proj.truncateTable();

let key = await proj.newProject('test', 'test project');
await proj.updateProject(key, 'test2', 'test project2');
console.log(JSON.stringify(await proj.getAllProjects(), null, 2));

//await proj.deleteProject(key);
//console.log(JSON.stringify(await proj.getAllProjects(), null, 2));

console.log(JSON.stringify(await fork.listScripts(), null, 2));
console.log(JSON.stringify(await fork.fork('hello', ['arg1', 'arg2']), null, 2));

let scheduler = new Scheduler();
let task = new Task('simpleClock', '* * * * * *', 'simpleClock');
scheduler.addTask(task);
scheduler.start();
