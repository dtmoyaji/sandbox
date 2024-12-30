export let parameters = {};

// スクリプトの説明を取得する
export async function getDescription(){
    return `
        Hello, World!を表示します
    `;
}

// スクリプトのバインドオブジェクトを取得する
export async function getBindObjects(){
    return [
        { "gemini": "models/gemini.mjs" }
    ];
}

// スクリプトの実行処理
export async function run() {
    let response = await parameters.modules.gemini.doPrompt('こんにちはございます。');
    let returnValue = {result: 200, response: response};
    return returnValue;
}

