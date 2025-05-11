const scriptInfo = {
    script_name: "imapToLineworks",
    description: "IMAPメールを受信し、指定のチャンネルに投稿する",
    bind_module: [
        { name: "ImapClient", from: "controllers/imap.mjs" },
        { name: "LineworksMessageSender", from: "controllers/sns/lineworks/lineworks_message_sender.mjs" },
        { name: "fetch", from: "node-fetch" }
    ],
    script: `
        // domain_idより、ユーザーのメールアドレスを取得
        let imap_setting = await context.modelManager.getModel('imap_setting');
        let imapSettings = await imap_setting.get({
            user_domain_id: parameters.domain_id
        });

        let messages = [];
        for (let imapSetting of imapSettings) {
            let imap_setting_id = imapSetting.imap_setting_id;
            let user_id = imapSetting.user_id;
            let user_domain_id = imapSetting.user_domain_id;
            let imap_lineworks_translation_filter
                = await context.modelManager.getModel('imap_lineworks_translation_filter');
            let filters = await imap_lineworks_translation_filter.get({
                user_id: user_id,
                user_domain_id: user_domain_id
            });

            for(translateFilter of filters) {
                if(translateFilter.imap_setting_id != imap_setting_id) {
                    continue;
                }
                // imapに接続
                let filterName = translateFilter.filter_name;
                let filter = [
                    translateFilter.search_filter, 
                //    ['SINCE', new Date()],
                    [translateFilter.filter_type, translateFilter.filter_value]
                ];
                let client = new modules.ImapClient.ImapClient(
                    imapSetting.imap_account,
                    imapSetting.imap_password,
                    imapSetting.imap_host,
                    imapSetting.imap_port,
                    imapSetting.imap_tls,
                    filter
                );

                let lineworks_user_account = translateFilter.lineworks_user_account;
                let emails = await client.fetchEmails();
                let node = {
                    imap_account: imapSetting.imap_account,
                    subject: translateFilter.filter_name,
                    filter: translateFilter.filter_value,
                    filter_type: translateFilter.filter_type,
                    lineworks_user_account: lineworks_user_account,
                    emails: emails
                };
                messages.push(node);
            }
        }

        let msgBody = '';
        // 条件に該当するメッセージがあった場合、LINEWORKSに投稿する。
        if(messages.length > 0) {
            // 受信した内容を元に、LINEWORKS用にメッセージをまとめる。
            for (let message of messages) {
                if(message.emails.length == 0) {
                    continue;
                }
                msgBody += message.emails.length + '件の確認すべきメールがあります。' + LF;
                msgBody += '宛先: ' + message.imap_account + LF;
                let typeString = '';
                if(message.filter_type == 'from') {
                    typeString = '差出人';
                } else if(message.filter_type == 'subject') {
                    typeString = '件名';
                }
                msgBody += '確認対象: ' + typeString + '=' + message.filter  + LF;
                msgBody += 'メールを確認してください。' + LF;

                let lineworksMessageSender = new modules.LineworksMessageSender
                    .LineworksMessageSender(context.modelManager);
                lineworksMessageSender.setUserDomainId(parameters.domain_id);
                await lineworksMessageSender.sendMessage(
                    message.lineworks_user_account,
                    msgBody
                );
                msgBody = '';
            }
        }

        context.result = {
            imapSettings: imapSettings,
            message: msgBody,
        };
        `,
    parameters: [
        {
            name: "domain_id"
        }
    ]
};

export default scriptInfo;
