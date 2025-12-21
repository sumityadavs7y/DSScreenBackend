// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const app = express();
const { envConfig } = require('./config');
const { testConnection } = require('./models');
const { runMigrations } = require('./utils/migrate');

app.use(express.json())
app.use(express.urlencoded({ extended: false }));

// Session configuration
app.use(session({
    secret: envConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.set('view engine', 'ejs');
app.set('views', 'views');

// Routes (BEFORE static middleware to allow route precedence)
const indexRoutes = require('./routes/index');
const webRoutes = require('./routes/web');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const companyRoutes = require('./routes/company');
const userRoutes = require('./routes/user');
const videoRoutes = require('./routes/video');
const scheduleRoutes = require('./routes/schedule');

app.use('/', webRoutes);  // Web routes (login, register, logout)
app.use('/dashboard', dashboardRoutes); // Dashboard routes BEFORE static files
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/', indexRoutes); // Static pages

// Static files (AFTER routes so routes take precedence)
app.use(express.static(__dirname + '/public'));
app.use('/videos', express.static(__dirname + '/videos'));

// Initialize database and start server
const startServer = async () => {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Starting Server...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Test database connection
      await testConnection();
      
      // Run database migrations (replaces sync())
      // This is the safe way to update database schema
      await runMigrations();
      
      // Start the server
      app.listen(envConfig.port, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Server is running on port ${envConfig.port}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
};

startServer();

