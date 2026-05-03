const fs              = require('fs');
const path            = require('path');
const readline        = require('readline');
const PhoneNumber     = require('awesome-phonenumber');
const FileType        = require('file-type');
const { jidDecode, downloadContentFromMessage } = require('baileys');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('../database/exifFunct');
const { getBuffer, getSizeMedia }                              = require('../database/queenruva');

// ── CLI prompt ────────────────────────────────────────────────
const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(text, (ans) => { rl.close(); resolve(ans); }));
};

// ── Time-based DM message ─────────────────────────────────────
function generateTimeBasedMessage(hour, username) {
    if (hour >= 5  && hour < 12) return `🌅 Good morning ${username}!\n\nDM is currently unavailable. Have a great morning! ☕`;
    if (hour >= 12 && hour < 17) return `🌤️ Good afternoon ${username}!\n\nDM is currently unavailable. Enjoy your afternoon! 😊`;
    if (hour >= 17 && hour < 21) return `🌆 Good evening ${username}!\n\nDM is currently unavailable. Hope you had a great day! 🌙`;
    return `🌙 Goodnight ${username}!\n\nDM is currently unavailable. Sleep well! 💤`;
}

// ── Command counter ───────────────────────────────────────────
function countCommands() {
    let total = 0;
    for (const file of ['./queen-ruva.js', './queen-ruva2.js']) {
        try {
            if (!fs.existsSync(file)) continue;
            const code  = fs.readFileSync(file, 'utf-8');
            const found = (code.match(/^\s*case\s+['"`]/gm) || []).length;
            total += found;
        } catch (err) {
            // Silent
        }
    }
    return total;
}

// ── Attach utility methods to bot instance ────────────────────
function attachUtilities(IconicTechInc, store) {

    // JID decode
    IconicTechInc.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const d = jidDecode(jid) || {};
            return (d.user && d.server) ? `${d.user}@${d.server}` : jid;
        }
        return jid;
    };

    // Contact name resolver
    IconicTechInc.getName = async (jid, withoutContact = false) => {
        const id = IconicTechInc.decodeJid(jid);
        withoutContact = IconicTechInc.withoutContact || withoutContact;
        let v;
        if (id.endsWith('@g.us')) {
            v = store.contacts[id] || {};
            if (!v.name && !v.subject) v = await IconicTechInc.groupMetadata(id) || {};
            return v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net','')).getNumber('international');
        }
        v = id === '0@s.whatsapp.net'                   ? { id, name: 'WhatsApp' }
          : id === IconicTechInc.decodeJid(IconicTechInc.user?.id)          ? IconicTechInc.user
          : (store.contacts[id] || {});
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName
            || PhoneNumber('+' + jid.replace('@s.whatsapp.net','')).getNumber('international');
    };

    // Simple text send
    IconicTechInc.sendText = (jid, text, quoted = '', options = {}) =>
        IconicTechInc.sendMessage(jid, { text, ...options }, { quoted, ...options });

    // Text with @mentions
    IconicTechInc.sendTextWithMentions = async (jid, text, quoted, options = {}) =>
        IconicTechInc.sendMessage(jid, {
            text,
            mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => `${v[1]}@s.whatsapp.net`),
            ...options
        }, { quoted });

    // Image → sticker
    IconicTechInc.sendImageAsSticker = async (jid, pathOrBuffer, quoted, options = {}) => {
        const buff = await _resolveBuffer(pathOrBuffer);
        const buffer = (options.packname || options.author)
            ? await writeExifImg(buff, options)
            : await imageToWebp(buff);
        await IconicTechInc.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
        return buffer;
    };

    // Video → sticker
    IconicTechInc.sendVideoAsSticker = async (jid, pathOrBuffer, quoted, options = {}) => {
        const buff = await _resolveBuffer(pathOrBuffer);
        const buffer = (options.packname || options.author)
            ? await writeExifVid(buff, options)
            : await videoToWebp(buff);
        await IconicTechInc.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
        return buffer;
    };

    // Download & save media to disk
    IconicTechInc.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        const quoted      = message.msg || message;
        const mime        = (message.msg || message).mimetype || '';
        const messageType = message.mtype
            ? message.mtype.replace(/Message/gi, '')
            : mime.split('/')[0];
        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer   = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        const type         = await FileType.fromBuffer(buffer);
        const trueFileName = attachExtension ? `${filename}.${type.ext}` : filename;
        fs.writeFileSync(trueFileName, buffer);
        return trueFileName;
    };

    // Resolve buffer / URL / path
    IconicTechInc.getFile = async (PATH, save = false) => {
        let res, data;
        if (Buffer.isBuffer(PATH)) {
            data = PATH;
        } else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
            data = Buffer.from(PATH.split`,`[1], 'base64');
        } else if (/^https?:\/\//.test(PATH)) {
            res  = data = await getBuffer(PATH);
        } else if (fs.existsSync(PATH)) {
            data = fs.readFileSync(PATH);
        } else {
            data = typeof PATH === 'string' ? PATH : Buffer.alloc(0);
        }
        const type     = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' };
        const filename = path.join(__filename, '../src/', `${Date.now()}.${type.ext}`);
        if (data && save) await fs.promises.writeFile(filename, data);
        return { res, filename, size: await getSizeMedia(data), ...type, data };
    };

    // Download media as buffer
    IconicTechInc.downloadMediaMessage = async (message) => {
        const mime        = (message.msg || message).mimetype || '';
        const messageType = message.mtype
            ? message.mtype.replace(/Message/gi, '')
            : mime.split('/')[0];
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer   = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return buffer;
    };

    // Serialize message
    const { smsg } = require('../database/queenruva');
    IconicTechInc.serializeM = (m) => smsg(IconicTechInc, m, store);

    IconicTechInc.public = true;
}

// ── Internal: resolve various input types to Buffer ───────────
async function _resolveBuffer(src) {
    if (Buffer.isBuffer(src))                          return src;
    if (/^data:.*?\/.*?;base64,/i.test(src))          return Buffer.from(src.split`,`[1], 'base64');
    if (/^https?:\/\//.test(src))                     return getBuffer(src);
    if (fs.existsSync(src))                           return fs.readFileSync(src);
    return Buffer.alloc(0);
}

module.exports = { question, generateTimeBasedMessage, countCommands, attachUtilities };