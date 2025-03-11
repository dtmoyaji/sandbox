
import axios from 'axios';
import dotenv from 'dotenv';
import LineworksJWT from './lineworks_jwt.mjs';

dotenv.config();
class LineworksMessageSender {

    lineworksJWT = undefined;
    user_domain_id = -1;

    constructor(modelManager) {
        this.lineworksJWT = new LineworksJWT(modelManager);
    }

    setUserDomainId(user_domain_id) {
        this.user_domain_id = user_domain_id;
    }

    async modifyMessage(message) {
        let newMessage = message;
        newMessage = newMessage.replace(/\\n/g, "\n"); // 改行コードを置換
        return newMessage;
    }

    async sendMessage(to, message) {
        let lineworksBotSetting = await this.lineworksJWT.getLineWorksBotSetting(this.user_domain_id);

        message = await this.modifyMessage(message);
        let accessToken = await this.lineworksJWT.getAccessToken(lineworksBotSetting);
        let apiUrl = `https://www.worksapis.com/v1.0/bots/${lineworksBotSetting.lineworks_bot_id}/users/${to}/messages`;

        const data = {
            "accountId": lineworksBotSetting.lineworks_service_account_id,
            "content": {
                "type": "text",
                "text": message
            }
        };

        const headers = {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${accessToken}`
        };
        this.lineworksJWT.debugLog(apiUrl);
        this.lineworksJWT.debugLog(headers);
        try {
            const response = await axios.post(apiUrl, data, { headers: headers });
            console.log(response.status);
        } catch (error) {
            console.error(error);
        }
    }
}

export default LineworksMessageSender;
