import app from './app.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 MediGuide Backend Server Started!');
  console.log('='.repeat(50));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
  console.log(`📊 Health Check: http://${HOST}:${PORT}/health`);
  console.log(`📚 API Docs: http://${HOST}:${PORT}/api`);
  console.log('='.repeat(50));
  console.log('💡 Ready to receive requests...');
  console.log('='.repeat(50) + '\n');
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ HTTP server closed.');
    console.log('✅ MediGuide backend shutdown complete.');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default server;