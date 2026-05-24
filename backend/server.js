require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(helmet());
app.use(cors({ origin: 'http://192.168.130.10', credentials: true }));
app.use(express.json());

app.use('/api/auth',      require('./src/routes/auth'));
app.use('/api/klienten',  require('./src/routes/klienten'));
app.use('/api/dossiers',  require('./src/routes/dossiers'));
app.use('/api/journal',   require('./src/routes/journal'));
app.use('/api/tasks',     require('./src/routes/tasks'));
app.use('/api/termine',   require('./src/routes/termine'));
app.use('/api/praesenz',  require('./src/routes/praesenz'));
app.use('/api/externe',   require('./src/routes/externe'));
app.use('/api/programme', require('./src/routes/programme'));
app.use('/api/benutzer',  require('./src/routes/benutzer'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Interner Serverfehler' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('IV-CRM Backend laeuft auf Port ' + PORT);
});