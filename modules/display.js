// ============================================================
//  modules/display.js
//  Terminal branding · runtime display · background colors · logging
// ============================================================

const chalk  = require('chalk');
const moment = require('moment-timezone');

// ── Bot identity ─────────────────────────────────────────────
const ICONIC_TECH = {
    name:      "Queen Ruva AI Beta",
    developer: "Iconic Tech",
    website:   "https://queen-ruva-dashboard.zone.id",
    version:   "3.2.0",
    theme: {
        primary:   '#4F46E5',
        secondary: '#10B981',
        error:     '#EF4444',
        warning:   '#F59E0B',
        info:      '#3B82F6',
        dark:      '#1F2937',
        light:     '#F3F4F6'
    }
};

// ── Silent logging (no console output) ────────────────────────────────
const logMessage = (type, message) => {
    // Silent - no logging
};

// ── Background color cycling ─────────────────────────────────
const backgroundColors = [
    '#1a1a2e','#16213e','#0f3460','#4a148c','#311b92',
    '#1b5e20','#004d40','#33691e','#e65100','#bf360c'
];
let colorIndex          = 0;
let colorInterval       = null;
let runtimeInterval     = null;
const IconicTechIncStartTime      = Date.now();

function changeTerminalBackground() {
    if (!global.backenddynamic) return;
    const c = backgroundColors[colorIndex];
    const r = parseInt(c.slice(1,3),16);
    const g = parseInt(c.slice(3,5),16);
    const b = parseInt(c.slice(5,7),16);
    process.stdout.write(`\x1b[48;2;${r};${g};${b}m`);
    console.clear();
    colorIndex = (colorIndex + 1) % backgroundColors.length;
}

// ── Runtime display ──────────────────────────────────────────
function formatRuntime(ms) {
    const s = Math.floor(ms/1000), m = Math.floor(s/60);
    const h = Math.floor(m/60),    d = Math.floor(h/24);
    return { days: d, hours: h%24, minutes: m%60, seconds: s%60 };
}

function createDynamicASCII() {
    const frames = [
        '\n╔══════════════════════════════════════╗\n║           QUEEN RUVA AI BETA         ║\n║         DEVELOPED BY ICONIC TECH     ║\n╚══════════════════════════════════════╝',
        '\n╔══════════════════════════════════════╗\n║        👑 QUEEN RUVA AI BETA 👑      ║\n║         🔥 ICONIC TECH DEV 🔥        ║\n╚══════════════════════════════════════╝',
        '\n╔══════════════════════════════════════╗\n║        🤖 QUEEN RUVA AI BETA 🤖      ║\n║         ⚡ ICONIC TECH POWER ⚡        ║\n╚══════════════════════════════════════╝'
    ];
    return frames[Math.floor(Date.now()/1000) % frames.length];
}

function updateRuntimeDisplay() {
    if (!global.backenddynamic) {
        if (runtimeInterval) { clearInterval(runtimeInterval); runtimeInterval = null; }
        return;
    }
    const f   = formatRuntime(Date.now() - IconicTechIncStartTime);
    const sec = Math.floor(Date.now()/500) % 2 === 0;
    const con = ['🔵','🟢','🟡','🔴'][Math.floor(Date.now()/1000) % 4];
    console.clear();
    console.log(chalk.hex('#FF00FF').bold(createDynamicASCII()));
    console.log(chalk.hex('#00FFFF').bold(`⏰ Uptime: ${f.days}d ${f.hours}h ${f.minutes}m ${f.seconds}s`));
    console.log(chalk.hex('#FFA500')(`📊 Memory: ${(process.memoryUsage().heapUsed/1024/1024).toFixed(2)} MB`));
    console.log(chalk.hex('#00FF00')(`${con} Status: ONLINE`));
    console.log(sec ? chalk.green('🔑 Secrets: ✅ LOADED') : chalk.red('🔑 Secrets: [HIDDEN]'));
    console.log(chalk.hex('#FF0000').bold('\n🔥 QUEEN RUVA AI BETA - ICONIC TECH 🔥'));
}

// ── Toggle ────────────────────────────────────────────────────
function toggleBackendDynamic(enable) {
    global.backenddynamic = enable;
    if (enable) {
        if (!colorInterval)   colorInterval   = setInterval(changeTerminalBackground, 5000);
        if (!runtimeInterval) runtimeInterval = setInterval(updateRuntimeDisplay,     1000);
        changeTerminalBackground();
    } else {
        if (colorInterval)   { clearInterval(colorInterval);   colorInterval   = null; }
        if (runtimeInterval) { clearInterval(runtimeInterval); runtimeInterval = null; }
        process.stdout.write('\x1b[0m');
        console.clear();
    }
}

// ── Banner ────────────────────────────────────────────────────
function printBanner() {
    console.log(chalk.hex(ICONIC_TECH.theme.primary).bold(`
╔══════════════════════════════════════╗
║           QUEEN RUVA AI BETA         ║
║         DEVELOPED BY ICONIC TECH     ║
╚══════════════════════════════════════╝`));
    console.log(chalk.hex(ICONIC_TECH.theme.secondary)(`❤️‍🔥  ${ICONIC_TECH.name}`));
    console.log(chalk.hex(ICONIC_TECH.theme.info)     (`🌐  ${ICONIC_TECH.website}`));
    console.log(chalk.hex(ICONIC_TECH.theme.warning)  (`🤖  Version: ${ICONIC_TECH.version}\n`));
}

// ── Init ──────────────────────────────────────────────────────
function initDisplay() {
    printBanner();
    if (global.backenddynamic) {
        changeTerminalBackground();
        updateRuntimeDisplay();
        colorInterval   = setInterval(changeTerminalBackground, 5000);
        runtimeInterval = setInterval(updateRuntimeDisplay,     1000);
    }
}

// ── Graceful shutdown (silent) ────────────────────────────────────────
process.on('SIGINT', () => {
    console.clear();
    if (colorInterval)   clearInterval(colorInterval);
    if (runtimeInterval) clearInterval(runtimeInterval);
    process.stdout.write('\x1b[0m');
    process.exit(0);
});

module.exports = {
    logMessage, ICONIC_TECH, printBanner, initDisplay,
    toggleBackendDynamic, changeTerminalBackground,
    updateRuntimeDisplay, formatRuntime, backgroundColors
};