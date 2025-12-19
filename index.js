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
app.use(express.static(__dirname + '/public'));

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

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const userRoutes = require('./routes/user');
const videoRoutes = require('./routes/video');
const scheduleRoutes = require('./routes/schedule');

app.use('/', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/schedules', scheduleRoutes);

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

