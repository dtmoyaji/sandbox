/**
 * Connect to IMAP and fetch emails matching the specified filter
 */
import dotenv from 'dotenv';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

class ImapClient {

    filters = [];
    imap = null;

    constructor(
        user = process.env.IMAP_ACCOUNT,
        password = process.env.IMAP_PASSWORD,
        host = process.env.IMAP_HOST,
        port = process.env.IMAP_PORT,
        tls = process.env.IMAP_TLS,
        filters = ['UNSEEN', ['SINCE', new Date()]]
    ) {
        dotenv.config();
        this.filters = filters;
        this.imap = new Imap({
            user,
            password,
            host,
            port,
            tls: tls === 'true'
        });

        this.imap.once('ready', this.onReady.bind(this));
        this.imap.once('error', this.onError.bind(this));
        this.imap.once('end', this.onEnd.bind(this));
    }

    connect() {
        this.imap.connect();
    }

    onReady() {
        this.openInbox((err, box) => {
            if (err) throw err;
            this.imap.search(this.filters, (err, results) => {
                if (err) throw err;
                if (results.length === 0) {
                    console.log('No new emails to fetch.');
                    this.imap.end();
                    return;
                }
                const fetch = this.imap.fetch(results, { bodies: '' });
                fetch.on('message', (msg, seqno) => {
                    msg.on('body', (stream, info) => {
                        simpleParser(stream, (err, mail) => {
                            if (err) throw err;
                            console.log('Parsed email:', JSON.stringify(mail, null, 2));
                        });
                    });
                });
                fetch.once('end', () => {
                    console.log('Done fetching all messages!');
                    this.imap.end();
                });
            });
        });
    }

    openInbox(cb) {
        this.imap.openBox('INBOX', true, cb);
    }

    onError(err) {
        console.error(err);
    }

    onEnd() {
        console.log('Connection ended');
    }
}

dotenv.config();
const filters = ['UNSEEN', ['SINCE', new Date()], ['FROM', process.env.IMAP_ACCOUNT]];
const client = new ImapClient(
    process.env.IMAP_ACCOUNT,
    process.env.IMAP_PASSWORD,
    process.env.IMAP_HOST,
    process.env.IMAP_PORT,
    process.env.IMAP_TLS,
    filters
);
client.connect();
