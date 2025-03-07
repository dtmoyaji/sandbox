import expressWs from 'express-ws';

export class WebSocket {
    express = undefined;
    websocket = undefined;
    clients = new Map();
    logger = undefined;

    constructor(express, logger=undefined) {
        this.logger = logger;
        this.express = express;
        this.websocket = expressWs(express);
    }

    async bindWebSocket() {
        this.express.ws('/ws', (ws, req) => {
            let currentUser = req.query.currentUser;
            let application_name = req.query.application_name;
            if (!this.clients.has(currentUser)) {
                this.clients.set(currentUser, []);
            }
            this.clients.get(currentUser).push(ws);
            if(this.logger){
                this.logger.log(
                    `WebSocket was opened for ${currentUser}. Clients: ${this.clients.size}`,
                    'info',
                    application_name
                );
            }

            ws.on('message', (msg) => {
                let msgObj = JSON.parse(msg);
                console.log(msg);
                ws.send(JSON.stringify(msgObj));
            });

            ws.on('close', () => {
                let userSockets = this.clients.get(currentUser);
                userSockets = userSockets.filter(socket => socket !== ws);
                if (userSockets.length > 0) {
                    this.clients.set(currentUser, userSockets);
                } else {
                    this.clients.delete(currentUser);
                }
                if(this.logger){
                    this.logger.log(`WebSocket was closed. Clients: ${this.clients.size}`, 'info', application_name);
                }
            });
        });
        console.log('WebSocket bound');
    }

    sendToUser(userName, message) {
        let matchedClients = this.clients.get(userName);
        if (matchedClients) {
            matchedClients.forEach(ws => {
                ws.send(JSON.stringify(message));
            });
        }
    }
}

