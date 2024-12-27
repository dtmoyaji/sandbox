import cron from 'node-cron';
import { fork } from './fork.mjs';

export class Task {

    constructor(taskname, schedule, scriptName) {
        this.taskname = taskname;
        this.schedule = schedule;
        this.scriptName = scriptName;
        this.cronTask = null; // cronタスクのインスタンスを保持
    }

    async run() {
        // タイマーイベントなので、引数はnullのみ
        // フォークしてスクリプトを実行
        let result = await fork(this.scriptName, null);
        return result;
    }
}

export class Scheduler {
    constructor() {
        this.tasks = [];
    }

    // タスクを追加する
    addTask(task) {
        this.tasks.push(task);
    }

    // タスクを削除する
    removeTask(taskname) {
        let index = this.tasks.findIndex(task => task.taskname === taskname);
        if (index >= 0) {
            let task = this.tasks[index];
            if (task.cronTask) {
                task.cronTask.stop(); // cronタスクを停止
            }
            this.tasks.splice(index, 1);
        }
    }

    // タスクを実行する
    start() {
        for (let task of this.tasks) {
            task.cronTask = cron.schedule(task.schedule, async () => {
                await task.run();
            });
        }
    }
}

