import csv from 'csv-parser';
import express from 'express';
import fs from 'fs';
import iconv from 'iconv-lite';
import multer from 'multer';
import { RestUtil } from '../rest/rest-util.mjs';

export class ImportCsvController {

    upload = multer({ dest: 'tmp/uploads/' });
    router = undefined;
    modelManager = undefined;
    restUtil = undefined;
    websocket = undefined;

    constructor(manager, websocket=undefined) {
        this.modelManager = manager;
        this.restUtil = new RestUtil(manager);
        this.router = express.Router();
        this.websocket = websocket;
    }

    async initializeResolvers() {
        const ImportCsvController = express.Router();

        this.router.post('/csv', this.upload.single('file'), async (req, res) => {

            const verifyResult = await this.restUtil.verifyToken(req, res);
            if (verifyResult.auth === false) {
                return res.status(401).send('Unauthorized');
            }

            const file = req.file;
            if (!file) {
                return res.status(400).send('File is required');
            }

            const userName = req.body.currentUser;
            const targetTable = req.body.targetTable;
            const user_domains = verifyResult.user_domains;
            const user_domain_id = user_domains[0].user_domain_id;

            try {
                // ファイルを読み込み
                const results = await new Promise((resolve, reject) => {
                    const results = [];
                    fs.createReadStream(file.path)
                        .pipe(iconv.decodeStream('shift_jis'))
                        .pipe(csv())
                        .on('data', (data) => results.push(data))
                        .on('end', () => resolve(results))
                        .on('error', (error) => reject(error));
                });

                let table = await this.modelManager.getModel(targetTable);
                let fields = table.tableDefinition.fields;
                let counter = 0;
                let max = results.length;
                console.log('Importing CSV:', targetTable, 'Total:', max);
                for (let csvData of results) {
                    if(csvData.length == 0) {
                        continue;
                    }
                    let filter = {};
                    let template = await table.getJsonTemplate();
                    for (let field of fields) {
                        template[field.name] = csvData[field.name];
                        if (field.autoIncrement) {
                            delete template[field.name];
                        } else if (field.unique) {
                            filter[field.name] = csvData[field.name];
                            if(csvData[field.name] == undefined) {
                                //console.log('Unique key is undefined: ', field.name);
                                continue;
                            }
                        }
                    }
                    template.deleted_at = null;
                    //console.log('uniqueKeys:', JSON.stringify(filter));
                    if(this.websocket){
                        if(counter % 10 == 0){ // 10件ごとに通知
                            this.websocket.sendToUser(userName, {message: `Importing ${targetTable} ${counter} / ${max}`});
                        }
                    }
                    let recordCount = await table.getCount(filter);
                    if (recordCount == 0) {
                        await table.put(template);
                    } else {
                        //console.log('Already exists: ', csvData.jan_code);
                    }
                    counter++;
                }
                this.websocket.sendToUser(userName, {message: `${targetTable} Import completed. ${counter} records.`});
                console.log('Imported:', counter, 'records');

                fs.unlinkSync(file.path);
                return res.status(200).send({result: 'OK'});

            } catch (err) {
                console.error('Import CSV error', err.stack);
                return res.status(400).send('Invalid file');
            }
        });

        return ImportCsvController;
    }

}