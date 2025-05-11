import dotenv from 'dotenv';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

dotenv.config();
export class ImapClient {
    emails = []; // メールを格納するプロパティ

    constructor(
        user = process.env.IMAP_ACCOUNT,
        password = process.env.IMAP_PASSWORD,
        host = process.env.IMAP_HOST,
        port = process.env.IMAP_PORT,
        tls = process.env.IMAP_TLS,
        filters = ['UNSEEN', ['SINCE', new Date()]]
    ) {
        this.filters = filters;
        this.imap = new Imap({
            user,
            password,
            host,
            port,
            tls: tls === 'true',
            tlsOptions: { rejectUnauthorized: false }, // 自己署名証明書を許可
        });

        this.imap.once('error', (err) => console.error('IMAP Error:', err));
        this.imap.once('end', () => console.log('IMAP connection ended.'));
    }

    async fetchEmails() {
        return new Promise((resolve, reject) => {
            this.imap.once('ready', async () => {
                try {
                    console.log('IMAP connection successful!');
                    const box = await this.openInbox();
                    const results = await this.searchEmails();
                    if (results.length === 0) {
                        console.log('No new emails to fetch.');
                        return resolve([]);
                    }
                    await this.fetchMessages(results);
                    resolve(this.emails);
                } catch (err) {
                    reject(err);
                } finally {
                    this.imap.end();
                }
            });

            console.log('Connecting to IMAP server...');
            this.imap.connect();
        });
    }

    openInbox() {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', true, (err, box) => {
                if (err) return reject(err);
                resolve(box);
            });
        });
    }

    searchEmails() {
        return new Promise((resolve, reject) => {
            this.imap.search(this.filters, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    async fetchMessages(results) {
        const fetch = this.imap.fetch(results, { bodies: '' });

        // メッセージごとの処理をPromiseでラップ
        const messages = [];
        fetch.on('message', (msg, seqno) => {
            const messagePromise = new Promise((resolve, reject) => {
                console.log(`Fetching message #${seqno}`);
                msg.on('body', (stream) => {
                    simpleParser(stream, (err, mail) => {
                        if (err) return reject(err);
                        console.log(`Parsed message #${seqno}: ${mail.subject}`);
                        this.emails.push(mail); // メールを保存
                        resolve(mail); // メールを解決
                    });
                });

                msg.once('end', () => {
                    console.log(`Finished processing message #${seqno}`);
                });

                msg.once('error', (err) => {
                    console.error(`Error processing message #${seqno}:`, err);
                    reject(err);
                });
            });

            messages.push(messagePromise);
        });

        // fetch全体の終了を待機
        return new Promise((resolve, reject) => {
            fetch.once('end', async () => {
                console.log('Done fetching all messages!');
                try {
                    // 全てのメッセージ処理が完了するまで待機
                    await Promise.all(messages);
                    resolve(this.emails);
                } catch (err) {
                    reject(err);
                }
            });

            fetch.once('error', (err) => {
                console.error('Error during fetch:', err);
                reject(err);
            });
        });
    }
}
