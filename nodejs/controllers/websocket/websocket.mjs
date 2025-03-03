import expressWs from 'express-ws';

export class WebSocket {
    express = undefined;
    websocket = undefined;
    clients = new Map();

    constructor(express) {
        this.express = express;
        this.websocket = expressWs(express);
    }

    async bindWebSocket() {
        this.express.ws('/ws', (ws, req) => {
            let currentUser = req.query.currentUser;
            if (!this.clients.has(currentUser)) {
                this.clients.set(currentUser, []);
            }
            this.clients.get(currentUser).push(ws);
            console.log('WebSocket was opened');
            console.log(currentUser);
            console.log(`Clients: ${this.clients.size}`);

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
                console.log('WebSocket was closed');
                console.log(currentUser);
                console.log(`Clients: ${this.clients.size}`);
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

