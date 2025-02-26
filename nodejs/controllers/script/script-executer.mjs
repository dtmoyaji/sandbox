import express from 'express';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { Script, createContext } from 'vm';

export class ScriptExecutor {
    modelManager = undefined;
    router = undefined;
    websocket = undefined;

    constructor(modelManager, websocket) {
        this.modelManager = modelManager;
        this.router = express.Router();
        this.websocket = websocket;
        this.router.post('/exec', async (req, res) => {
            try {
                const script_name = req.body.script_name;
                let parameters = req.body.parameters;
                parameters.modelManager = this.modelManager;
                parameters.websocket = this.websocket;
                const result = await this.execute(script_name, parameters);
                res.json(result);
            } catch (err) {
                console.error('Error executing script:', err);
                res.status(500).send(err.message);
            }
        });
    }

    async execute(script_name, parameters) {
        try {
            // スクリプトをデータベースから取得
            const scriptTable = await this.modelManager.getModel('script');
            const scriptRecord = await scriptTable.get({ script_name: script_name });

            if (scriptRecord.length === 0) {
                throw new Error(`Script with name ${script_name} not found`);
            }

            const bind_module = JSON.parse(scriptRecord[0].bind_module);
            const scriptContent = scriptRecord[0].script;

            // モジュールをインポート
            const require = createRequire(import.meta.url);
            const modules = {};
            for (const module of bind_module) {
                let modulePath = module.from;
                if (modulePath.endsWith('.mjs')) {
                    modulePath = pathToFileURL(path.resolve(module.from)).href;
                    modules[module.name] = await import(modulePath);
                } else {
                    modules[module.name] = await import(module.from);
                }
            }

            // スクリプトを実行するためのコンテキストを作成
            const context = {
                parameters: parameters,
                modules: modules,
                result: null
            };

            // コンテキストを隔離された環境で実行
            const asyncScript = `
                (async () => {
                    const { parameters, modules } = context;
                    ${scriptContent}
                })()
            `;
            const script = new Script(asyncScript);
            const vmContext = createContext({ context });
            await script.runInNewContext(vmContext);

            return vmContext.context.result;
        } catch (err) {
            console.error(`Error executing script ${script_name}:`, err);
            throw err;
        }
    }
}