// ============================================================
//  expressServer.js - Express server configuration
// ============================================================

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

function startExpressServer() {
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '..', 'public')));

    app.get('/', (_req, res) => res.send('✅ Queen Ruva AI is running!'));

    app.listen(PORT, () => console.log(`✅ Server on port ${PORT}`));
}

module.exports = { startExpressServer };