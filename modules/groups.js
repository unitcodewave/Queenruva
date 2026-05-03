// ============================================================
//  modules/groups.js
//  Welcome handler · admin promote/demote announcements
// ============================================================

function loadGroups(IconicTechInc, store) {
    const welcomeHandler = require('../database/welcome.js');

    // ── Welcome / leave ───────────────────────────────────────
    IconicTechInc.ev.on('group-participants.update', async (update) => {
        try {
            await welcomeHandler(IconicTechInc, update, store);
        } catch (err) {
            // Silent
        }
    });

    // ── Admin promote / demote announcements ─────────────────
    IconicTechInc.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            if (action !== 'promote' && action !== 'demote') return;

            const meta      = await IconicTechInc.groupMetadata(id);
            const groupName = meta.subject || "Unknown Group";

            for (const participant of participants) {
                const userName = await IconicTechInc.getName(participant) || "User";
                const time     = new Date().toLocaleString();
                const isPromo  = action === 'promote';

                const message = isPromo
                    ? `🎉 *Admin Promotion Alert!* ⬆️\n\n👤 *User:* @${participant.split('@')[0]}\n📛 *Name:* ${userName}\n⚡ *Action:* Promoted to Admin\n👥 *Group:* ${groupName}\n⏰ *Time:* ${time}\n\n🏆 Congratulations! Use your powers wisely!`
                    : `📉 *Admin Demotion Alert!* ⬇️\n\n👤 *User:* @${participant.split('@')[0]}\n📛 *Name:* ${userName}\n⚡ *Action:* Demoted from Admin\n👥 *Group:* ${groupName}\n⏰ *Time:* ${time}\n\n🔧 Admin privileges have been removed.`;

                await IconicTechInc.sendMessage(id, { text: message, mentions: [participant] });
            }
        } catch (err) {
            // Silent
        }
    });
}

module.exports = { loadGroups };