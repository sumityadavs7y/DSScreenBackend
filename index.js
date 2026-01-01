// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
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
app.use('/', indexRoutes); // Static pages

// Static files (AFTER routes so routes take precedence)
app.use(express.static(__dirname + '/public'));
app.use('/videos', express.static(__dirname + '/videos'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // Device joins a room with their device ID (for QR registration)
  socket.on('device:join', (deviceId) => {
    socket.join(`device:${deviceId}`);
    console.log(`📱 Device ${deviceId} joined room`);
    
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
        
        console.log(`📺 Device player connected: ${uid} (Playlist: ${playlistId})`);
        
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
        console.warn(`⚠️  Device not found in database: ${uid}`);
        socket.emit('device:player:error', {
          message: 'Device not found in system',
        });
      }
    } catch (error) {
      console.error('❌ Error in device:player:connect:', error);
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
      console.error('❌ Error in device:ping:', error);
    }
  });

  // Handle device disconnection
  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
    
    // Notify admins if it was a device player
    if (socket.deviceUID) {
      console.log(`📺 Device player disconnected: ${socket.deviceUID}`);
      
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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Starting Server...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Test database connection
      await testConnection();
      
      // Run database migrations (replaces sync())
      // This is the safe way to update database schema
      await runMigrations();
      
      // Start the server
      server.listen(envConfig.port, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Server is running on port ${envConfig.port}`);
        console.log(`✅ Socket.IO is ready for connections`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Start session cleanup service
        sessionCleanupService.start();
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  sessionCleanupService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  sessionCleanupService.stop();
  process.exit(0);
});

