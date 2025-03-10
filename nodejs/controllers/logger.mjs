
export class Logger{
    modelManager = undefined;
    constructor(modelManager){
        this.modelManager = modelManager;
    }

    async log(message, level = 'info'){
        const log = await this.modelManager.getModel('syslog');
        let logTemplate = await log.getJsonTemplate();
        delete logTemplate.sysslog_id;
        logTemplate.log_date = new Date();
        logTemplate.log = message;
        logTemplate.level = level;
        await log.put(logTemplate);
    }
}