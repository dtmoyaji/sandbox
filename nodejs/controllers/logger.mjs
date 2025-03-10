
export class Logger{
    modelManager = undefined;
    constructor(modelManager){
        this.modelManager = modelManager;
    }

    async log(message, level = 'info', application_name = 'system'){
        const log = await this.modelManager.getModel('syslog');
        let logTemplate = await log.getJsonTemplate();
        delete logTemplate.sysslog_id;
        logTemplate.log_date = new Date();
        logTemplate.log = message;
        logTemplate.application_name = application_name;
        logTemplate.level = level;
        await log.put(logTemplate);
    }
}


