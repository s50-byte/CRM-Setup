// ============================================================
// JWT Authentifizierungs-Middleware
// ============================================================
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Kein Token vorhanden' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token ungültig oder abgelaufen' });
    }
};