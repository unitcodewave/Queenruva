// ============================================================
//  modules/store.js
//  In-memory message store · contact cache · owner config
// ============================================================

const fs   = require('fs');
const path = require('path');

// ── Message/contact/chat store ───────────────────────────────
const store = {
    messages: {},
    contacts: {},
    chats:    {},

    groupMetadata: async (_jid) => ({}),

    bind(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key?.remoteJid) continue;
                const jid = msg.key.remoteJid;
                this.messages[jid] = this.messages[jid] || {};
                this.messages[jid][msg.key.id] = msg;
            }
        });

        ev.on('contacts.update', (contacts) => {
            for (const c of contacts) {
                if (c.id) this.contacts[c.id] = c;
            }
        });

        ev.on('chats.set', (chats) => {
            this.chats = chats;
        });
    },

    loadMessage: async function(jid, id) {
        return this.messages[jid]?.[id] || null;
    }
};

// ── Owner list ───────────────────────────
const OWNER_FILE      = '../database/json/owner.json';
const REQUIRED_OWNERS = ["263783525824", "263714388643", "263786115435"];

function loadOwners() {
    let owner = [];
    try {
        owner = JSON.parse(fs.readFileSync(OWNER_FILE));
        for (const num of REQUIRED_OWNERS) {
            if (!owner.includes(num)) owner.push(num);
        }
    } catch {
        owner = [...REQUIRED_OWNERS];
    }
    try {
        fs.mkdirSync(path.dirname(OWNER_FILE), { recursive: true });
        fs.writeFileSync(OWNER_FILE, JSON.stringify(owner, null, 2));
    } catch {}
    return owner;
}

module.exports = { store, loadOwners };
