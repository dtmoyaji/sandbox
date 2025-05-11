import fs from 'fs';

// 指定したスクリプトをフォークして実行する
export async function fork(scriptName, args) {
    let script = await import(`../scripts/${scriptName}.mjs`);
    await assertScript(scriptName, script);
    await initParameters(script, args);
    let result = await script.run();
    return result;
}

// スクリプトのパラメータを初期化する
export async function initParameters(script, args) {
    script.parameters.args=[];
    script.parameters.modules={};

    let modules = await script.getBindObjects();
    for (let module of modules) {
        let key = Object.keys(module)[0];
        script.parameters.modules[key] = await import(`../${module[key]}`);
    }
    script.parameters.args = args;
}

// スクリプトが正しく実装されているか確認する
export async function assertScript(scriptName, script){
    // scriptはfunction run()を持っている必要がある
    if (typeof script.run !== 'function') {
        throw new Error('Invalid script: run() is not defined :'+scriptName);
    }
    // scriptはfunction getDescription()を持っている必要がある
    if (typeof script.getDescription !== 'function') {
        throw new Error('Invalid script: getDescription() is not defined :'+scriptName);
    }
    // scriptはfunction getBindObjects()を持っている必要がある
    if (typeof script.getBindObjects !== 'function') {
        throw new Error('Invalid script: getBindObjects() is not defined :'+scriptName);
    }
}

// scriptフォルダ内のmjsファイルを一覧で取得する
export async function listScripts() {
    let scripts = [];
    let files = fs.readdirSync('./scripts');
    for (let file of files) {
        if (fs.statSync(`./scripts/${file}`).isFile() && file.endsWith('.mjs')) {
            scripts.push(file.replace('.mjs', ''));
        }
    }
    return scripts;
}

