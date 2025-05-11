export let parameters = {};

// スクリプトの説明を取得する
export async function getDescription(){
    return `
        ひたすらコンソールに時刻を表示します
    `;
}

// スクリプトのバインドオブジェクトを取得する
export async function getBindObjects(){
    // なにもなし
    return [
    ];
}

// スクリプトの実行処理
export async function run() {
    let response = new Date().toLocaleString();
    let returnValue = {result: 200, response: response};
    return returnValue;
}
