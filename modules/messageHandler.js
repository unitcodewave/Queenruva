// ============================================================
//  messageHandler.js - Message handling logic
// ============================================================

const { isMaintenanceMode, getMaintenanceMessage } = require('./maintenance');
const { smsg } = require('../database/queenruva');
const { recordCommand, recordFailedCommand } = require('./userrecords'); // ✅ fixed names
const { handleModeIntercept, handleStatusSave } = require('./mode');

function setupMessageHandler(bot, anticallModule, groupsModule) {
    bot.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek?.message) return;

            // ── Handle status saves first ──────────────────────
            if (mek.key?.remoteJid === 'status@broadcast') {
                await handleStatusSave(bot, mek);
                return;
            }

            // ── Maintenance Mode ───────────────────────────────
            const maintenanceActive = await isMaintenanceMode();
            if (maintenanceActive && !mek.key.fromMe) {
                const maintenanceMsg = await getMaintenanceMessage();
                await bot.sendMessage(mek.key.remoteJid, { text: maintenanceMsg }, { quoted: mek });
                return;
            }

            mek.message = Object.keys(mek.message)[0] === 'ephemeralMessage'
                ? mek.message.ephemeralMessage.message
                : mek.message;

            if (!bot.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

            if (global.autoread) await bot.readMessages([mek.key]);

            // ── Night / Unavailable mode intercept ────────────
            const intercepted = await handleModeIntercept(bot, mek);
            if (intercepted) return;

            smsg(bot, mek, bot.store);

            // ── Extract command name ──────────────────────────
            const prefix = global.prefix || '.';
            const body = mek.message?.conversation
                || mek.message?.extendedTextMessage?.text
                || mek.message?.imageMessage?.caption
                || mek.message?.videoMessage?.caption || '';

            const cmdName = body.startsWith(prefix)
                ? body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase()
                : null;

            // ── Core command handlers ─────────────────────────
            try {
                await require('../queen-ruva')(bot, mek, chatUpdate, bot.store);
                await require('../queen-ruva2')(bot, mek, chatUpdate, bot.store);

                if (cmdName) {
                    recordCommand(cmdName); // ✅ correct name + passing cmd
                }
            } catch (cmdErr) {
                if (cmdName) {
                    recordFailedCommand(cmdName, cmdErr.message); // ✅ correct name + passing cmd + error
                }
            }

            if (global.chatbot) {
                const { chatbotHandler } = require('../database/chatbot');
                await chatbotHandler(bot, chatUpdate.messages);
            }

        } catch (err) {
            // Silent
        }
    });
}

module.exports = { setupMessageHandler };