// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createModuleLogger } = require('./utils/logger');

const log = createModuleLogger('Server');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
const { envConfig } = require('./config');
const { testConnection } = require('./models');
const { runMigrations } = require('./utils/migrate');
const sessionCleanupService = require('./services/sessionCleanupService');

// CORS configuration
app.use(cors({
    origin: '*', // Allow all origins (you can restrict this to specific domains)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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

// Make io available to routes
app.set('io', io);

// Routes (BEFORE static middleware to allow route precedence)
const indexRoutes = require('./routes/index');
const webRoutes = require('./routes/web');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const adminDevicesRoutes = require('./routes/admin-devices');
const companyRoutes = require('./routes/company');
const userRoutes = require('./routes/user');
const videoRoutes = require('./routes/video');
const scheduleRoutes = require('./routes/schedule');
const deviceRoutes = require('./routes/device');

app.use('/', webRoutes);  // Web routes (login, register, logout)
app.use('/dashboard', dashboardRoutes); // Dashboard routes BEFORE static files
app.use('/admin', adminDevicesRoutes); // Admin device management routes (BEFORE adminRoutes to allow impersonating access)
app.use('/admin', adminRoutes); // Super Admin panel routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/media', videoRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/device', deviceRoutes); // Device registration routes


// Debug endpoint - CHECK ENVIRONMENT VARIABLES
// REMOVE THIS IN PRODUCTION!
router.get('/debug-env', (req, res) => {
  res.json({
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      BASE_URL: process.env.BASE_URL,
      DB_HOST: process.env.DB_HOST,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      hasDbPassword: !!process.env.DB_PASSWORD,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      allEnvKeys: Object.keys(process.env).filter(key => 
          !key.includes('PASSWORD') && 
          !key.includes('SECRET') && 
          !key.includes('KEY')
      ).sort(),
      timestamp: new Date().toISOString()
  });
});

app.use('/', indexRoutes); // Static pages

// Static files (AFTER routes so routes take precedence)
app.use(express.static(__dirname + '/public'));
app.use('/videos', express.static(__dirname + '/videos'));

// Socket.IO connection handling
const socketLog = createModuleLogger('Socket.IO');

io.on('connection', (socket) => {
  socketLog.debug('Socket connected', { socketId: socket.id });

  // Device joins a room with their device ID (for QR registration)
  socket.on('device:join', (deviceId) => {
    socket.join(`device:${deviceId}`);
    socketLog.info('Device joined room', { deviceId, socketId: socket.id });
    
    // Send connection confirmation
    socket.emit('device:connected', { deviceId, socketId: socket.id });
  });

  // Device player connects (for tracking)
  socket.on('device:player:connect', async (data) => {
    const { uid, playlistId } = data;
    
    try {
      const { Device, DevicePlaylist } = require('./models');
      
      // Update device lastSeen and join room
      const device = await Device.findOne({ where: { uid } });
      
      if (device) {
        await device.update({
          lastSeen: new Date(),
          isActive: true,
        });
        
        // Store device info in socket
        socket.deviceUID = uid;
        socket.playlistId = playlistId;
        
        // Join device room for targeted communication
        socket.join(`player:${uid}`);
        
        socketLog.info('Device player connected', { uid, playlistId, socketId: socket.id });
        
        // Notify admins that device came online
        io.emit('admin:device:online', {
          uid,
          playlistId,
          timestamp: new Date(),
        });
        
        // Send connection confirmation to device
        socket.emit('device:player:connected', {
          uid,
          status: 'online',
          timestamp: new Date(),
        });
      } else {
        socketLog.warn('Device not found in database', { uid, socketId: socket.id });
        socket.emit('device:player:error', {
          message: 'Device not found in system',
        });
      }
    } catch (error) {
      socketLog.error('Error in device:player:connect', { error: error.message, stack: error.stack, uid });
    }
  });

  // Device periodic ping (updates lastSeen)
  socket.on('device:ping', async (data) => {
    const { uid } = data;
    
    try {
      const { Device } = require('./models');
      
      const device = await Device.findOne({ where: { uid } });
      
      if (device) {
        await device.update({
          lastSeen: new Date(),
        });
      }
    } catch (error) {
      socketLog.error('Error in device:ping', { error: error.message, uid });
    }
  });

  // Handle fullscreen enter command from admin
  socket.on('device:fullscreen:enter', (data) => {
    const { uid } = data;
    
    socketLog.info('Fullscreen enter command received', { uid, fromSocket: socket.id });
    
    // Forward command to the specific device
    io.to(`player:${uid}`).emit('device:command:fullscreen-enter', {
      timestamp: new Date(),
    });
  });

  // Handle fullscreen exit command from admin
  socket.on('device:fullscreen:exit', (data) => {
    const { uid } = data;
    
    socketLog.info('Fullscreen exit command received', { uid, fromSocket: socket.id });
    
    // Forward command to the specific device
    io.to(`player:${uid}`).emit('device:command:fullscreen-exit', {
      timestamp: new Date(),
    });
  });

  // Handle device disconnection
  socket.on('disconnect', () => {
    socketLog.debug('Socket disconnected', { socketId: socket.id });
    
    // Notify admins if it was a device player
    if (socket.deviceUID) {
      socketLog.info('Device player disconnected', { uid: socket.deviceUID, socketId: socket.id });
      
      io.emit('admin:device:offline', {
        uid: socket.deviceUID,
        timestamp: new Date(),
      });
    }
  });
});

// Initialize database and start server
const startServer = async () => {
    try {
      log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      log.info('Starting Server...', { environment: process.env.NODE_ENV || 'development' });
      log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Test database connection
      await testConnection();
      
      // Run database migrations (replaces sync())
      // This is the safe way to update database schema
      await runMigrations();
      
      // Start the server
      server.listen(envConfig.port, () => {
        log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log.info('Server is running', { port: envConfig.port, baseUrl: envConfig.baseUrl });
        log.info('Socket.IO is ready for connections');
        log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Start session cleanup service
        sessionCleanupService.start();
      });
    } catch (error) {
      log.error('Failed to start server', { error: error.message, stack: error.stack });
      process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully...');
  sessionCleanupService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully...');
  sessionCleanupService.stop();
  process.exit(0);
});

