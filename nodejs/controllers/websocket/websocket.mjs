import expressWs from 'express-ws';

export class WebSocket{
    express = undefined;
    websocket = undefined;
    clients = new Map();

    constructor(express){
        this.express = express;
        this.websocket = expressWs(express);
    }

    async bindWebSocket(){
        this.express.ws('/ws', (ws, req) => {
            let currentUser = req.query.currentUser;
            this.clients.set(currentUser, ws);

            ws.on('message', (msg) => {
                let msgObj = JSON.parse(msg);
                console.log(msg);
                ws.send(JSON.stringify(msgObj));
            });

            ws.on('close', () => {
                console.log('WebSocket was closed');
            });
        });
        console.log('WebSocket bound');
    }

    sendToUser(userName, message){
        let ws = this.clients.get(userName);
        if(ws){
            ws.send(JSON.stringify(message));
        }
    }
}

