import {
    GoogleGenerativeAI
} from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import { getExternalInfo } from "./externalSearch.mjs";

dotenv.config();
let __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_PATH = __dirname; // Set the APP_PATH environment variable

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL,
});

const generationConfig = {
    temperature: 0.5,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const safetySettings = [
    {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE'
    },
    {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE'
    },
    {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE'
    },
    {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE'
    }
];

/**
 * ファイルをGemini APIにアップロードします。
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */
async function uploadToGemini(path, mimeType) {
    const uploadResult = await fileManager.uploadFile(path, {
        mimeType,
        displayName: path,
    });
    const file = uploadResult.file;
    return file;
}

/**
 * ファイルがアクティブになるのを待ちます。
 */
async function waitForFilesActive(files) {
    for (const name of files.map((file) => file.name)) {
        let file = await fileManager.getFile(name);
        while (file.state === "PROCESSING") {
            process.stdout.write(".")
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            file = await fileManager.getFile(name)
        }
        if (file.state !== "ACTIVE") {
            throw Error(`File ${file.name} failed to process`);
        }
    }
}

// テキストをJSONに変換する
export function spritTextJson(text) {
    if (text.indexOf('```json') === -1) {
        return text;
    }
    // ```jsonより前の部分を削除
    text = text.slice(text.indexOf('```json') + 7);
    // ```より後の部分を削除
    text = text.slice(0, text.indexOf('```'));
    try {
        return JSON.parse(text);
    } catch (e) {
        console.log(text.length);
        console.log(e);
        return {};
    }
}

// Pdfファイルとプロンプトを用いてGeminiに指示を行いjsonを取得する
export async function doPromptWithPDF(filename, query) {
    const files = [
        await uploadToGemini(filename, "application/pdf"),
    ];

    // Some files have a processing delay. Wait for them to be ready.
    await waitForFilesActive(files);

    const chatSession = model.startChat({
        safetySettings: safetySettings,
        generationConfig,
        // safetySettings: Adjust safety settings
        // See https://ai.google.dev/gemini-api/docs/safety-settings
        history: [
            {
                role: "user", parts: [
                    {
                        fileData: {
                            mimeType: files[0].mimeType,
                            fileUri: files[0].uri,
                        },
                    },
                    { text: query },
                ],
            }
        ],
    });
    let result = await chatSession.sendMessage("INSERT_INPUT_HERE");
    try {
        return spritTextJson(await result.response.text());
    } catch (e) {
        console.log(e);
        return {};
    }
}

// Jsonとプロンプトを用いてGeminiに指示を行いjsonを取得する
export async function doPromptWithJSON(Json, query) {
    const chatSession = model.startChat({
        safetySettings: safetySettings,
        generationConfig,
        history: [{
            role: "user", parts: [
                { text: Json, },
                { text: query },
            ],
        }],
    });
    let result = await chatSession.sendMessage("INSERT_INPUT_HERE");
    try {
        return await spritTextJson(await result.response.text());
    } catch (e) {
        console.log(e);
        return {};
    }
}

export async function doPromptWithGrounding(prompt){
    let preQuery = "「" + prompt + "」 この文章から、キーワード10個をカンマ区切りで出力してください。";
    let kwd = await doPrompt(preQuery);

    let externalInfo = await getExternalInfo(kwd, 5);
    let history = [];
    let links = [];
    for (let info of externalInfo) {
        history.push({
            role: "user",
            parts: [
                { text: info.content },
            ],
        });
        links.push({
            title: info.title,
            link:  info.link,
        });
    }
    history.push({ role: "user", parts: [{ text: prompt },],});
    const chatSession = model.startChat({
        safetySettings: safetySettings,
        generationConfig,
        history: history,
    });
    let result = await chatSession.sendMessage("INSERT_INPUT_HERE");
    try {
        let returnValue = {
            text: await spritTextJson(result.response.text()),
            links: links,
        }
        return returnValue;
    } catch (e) {
        console.log(e);
        return {};
    }
}

// プロンプトを用いてGeminiに指示を行いtextを取得する
export async function doPrompt(prompt) {
    const chatSession = model.startChat({
        safetySettings: safetySettings,
        generationConfig,
        history: [{
            role: "user", parts: [
                { text: prompt },
            ],
        }],
    });
    let result = await chatSession.sendMessage("回答:");
    try {
        //console.log(JSON.stringify(result, null, 2));
        return await spritTextJson(result.response.text());
    } catch (e) {
        console.log(e);
        return {};
    }
}
