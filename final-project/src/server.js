const express = require('express');
const swaggerUi = require('swagger-ui-express');

const swaggerDocument = require('./swagger');
const { authMiddleware, adminMiddleware } = require('./auth');

const adminRouter = require('./controllers/adminController');
const authRouter = require('./controllers/authController');
const usersRouter = require('./controllers/usersController');
const timeEntriesRouter = require('./controllers/timeEntriesController');
const absencesRouter = require('./controllers/absencesController');
const schedulesRouter = require('./controllers/schedulesController');
const reportsRouter = require('./services/reportsController');
const auditRouter = require('./controllers/auditController');

const app = express();
app.use(express.json());

// Простий кореневий маршрут, щоб не було "Cannot GET /"
app.get('/', (req, res) => {
  res.send('API сервер працює. Використовуйте /swagger для документації.');
});

// Swagger UI
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Адміністрування (тільки для Admin)
app.use('/api/admin', authMiddleware, adminMiddleware, adminRouter);

// Автентифікація
app.use('/api/auth', authRouter);

// Користувачі (керування користувачами – тільки Admin)
app.use('/api/users', authMiddleware, adminMiddleware, usersRouter);

// Відмітки часу
app.use('/api/time-entries', authMiddleware, timeEntriesRouter);

// Відсутності
app.use('/api/absences', authMiddleware, absencesRouter);

// Робочі графіки
app.use('/api/schedules', authMiddleware, schedulesRouter);

// Звіти (використовують бізнес-логіку reportService)
app.use('/api/reports', authMiddleware, reportsRouter);

// Журнал аудиту (тільки Admin)
app.use('/api/audit', authMiddleware, adminMiddleware, auditRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API сервер запущено на http://localhost:${PORT}`);
});
