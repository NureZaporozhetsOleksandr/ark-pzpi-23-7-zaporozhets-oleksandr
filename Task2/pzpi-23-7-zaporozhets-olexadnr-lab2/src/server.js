const express = require('express');
const swaggerUi = require('swagger-ui-express');

const swaggerDocument = require('./swagger');
const { authMiddleware, adminMiddleware } = require('./auth');

const authRouter = require('./controllers/authController');
const usersRouter = require('./controllers/usersController');
const timeEntriesRouter = require('./controllers/timeEntriesController');
const absencesRouter = require('./controllers/absencesController');
const schedulesRouter = require('./controllers/schedulesController');
const reportsRouter = require('./controllers/reportsController');
const auditRouter = require('./controllers/auditController');

const app = express();
app.use(express.json());

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api/auth', authRouter);
app.use('/api/users', authMiddleware, adminMiddleware, usersRouter);
app.use('/api/time-entries', authMiddleware, timeEntriesRouter);
app.use('/api/absences', authMiddleware, absencesRouter);
app.use('/api/schedules', authMiddleware, schedulesRouter);
app.use('/api/reports', authMiddleware, reportsRouter);
app.use('/api/audit', authMiddleware, adminMiddleware, auditRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API сервер запущено на http://localhost:${PORT}`);
});
