
const scriptInfo = {
    script_name: "searchOtcElement",
    description: "症状に適したOTC成分を検索します",
    bind_module: [
        { name: "gemini", from: "models/ai/gemini.mjs" },
        { name: "fetch", from: "node-fetch" }
    ],
    script: `
        console.log(JSON.stringify(modules));

        parameters.websocket.sendToUser(parameters.current_user, {message: 'プロンプトを作成中.'});
        let prompt = parameters.prompt;
        console.log(prompt);

        let query = "「" + prompt + "」に適した市販薬の成分を列挙してください。";
        query += "医療用医薬品の成分は除外してください。";
        query += "成分は分類や誘導体名ではなく、具体的な名称を記載してください。";
        query += "成分名のよみがなは削除してください。";
        query += "成分名の塩酸塩、硫酸塩、マレイン酸、スルホン酸などの塩の部分は省略してください。";
        query += "成分名のd-、L-などの異性体表記の部分は省略してください。";
        query += "成分名の吉草酸エステル、酢酸エステルなどの物質本体を示さない表記の部分は省略してください。";
        query += "漢方成分は、カタカナ表記で記載してください。";
        query += "回答では情報参照元について言及しないでください。";
        query += "回答は次のJSONフォーマットで行って下さい。\`\`\`JSONは不要です。";
        query += "{概要:, 成分:[ {成分名: 説明: }], 注意事項}";

        parameters.websocket.sendToUser(parameters.current_user, {message: 'AIに問合せ中.'});
        
        let response = await modules.gemini.doPromptWithGrounding(
            query,
            {websocket: parameters.websocket,
            current_user: parameters.current_user}
        );
        let elements = response.text.成分;
        let modelManager = parameters.modelManager;
        let otc = await modelManager.getModel('otc');
        let newElements = [];
        if(elements && elements.length > 0) {
            for (let element of elements) {
                element.商品 = [];
                parameters.websocket.sendToUser(parameters.current_user, {message: element.成分名 + 'に該当の消費を検索中.'});
                let data = await otc.get({ otc_elements: "like|%"+element.成分名+"%" });

                if (data.length > 0) {
                    element.商品.push({商品名: data[0].otc_name});
                }
                element.全商品数 = data.length;
                newElements.push(element);
            }
        }
        response.text.成分 = newElements;
        
        parameters.websocket.sendToUser(parameters.current_user, {message: '終了.'});

        let returnValue = {result: 200, response: response};
        context.result = returnValue;
        `,
    parameters: [
        {
            name: "prompt"
        }
    ]
};

export default scriptInfo;
