const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
// Load env vars before anything else
dotenv.config();

const path = require('path');
const connectDB = require('./config/db');
const { startCleanupScheduler } = require('./cleanup');
const User = require('./models/User');

// Connect to database
connectDB();

// Create default super admin if none exists
const createDefaultSuperAdmin = async () => {
  try {
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (!existingSuperAdmin) {
      await User.create({
        name: 'Rishabh',
        email: 'khd.rishabh@gmail.com',
        password: 'rishabh@123',
        role: 'superadmin'
      });
      console.log('✅ Default super admin created');
    }
  } catch (err) {
    console.error('❌ Error creating default super admin:', err);
  }
};
createDefaultSuperAdmin();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
// Notes:
// - Netlify frontend origin in your logs: https://dmsproject-rishab.netlify.app
// - Also allow the Render domain (useful for redirects / same-site setups).
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.NETLIFY_URL,
  'https://dmsproject-rishab.netlify.app',
  'https://dmsproject-rishab.netlify.com',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin in development (for local network access)
    if (isDevelopment) {
      return callback(null, true);
    }

    // Allow all localhost origins (any port) for development
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In production, if origin isn't whitelisted, block it.
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Explicit preflight handler (some hosts/proxies require this)
app.options('*', cors({
  origin: (origin, callback) => {
    if (isDevelopment) {
      return callback(null, true);
    }
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Serve uploaded files (for profile photos fallback)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/versions', require('./routes/versions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/trash', require('./routes/trash'));

// Start daily cleanup scheduler for expired versions
startCleanupScheduler();

// Base route
app.get('/', (req, res) => {
  res.send('DMS API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong on the server',
    stack: process.env.NODE_ENV === 'development' ? err.stack : {},
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

