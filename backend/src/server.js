const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const { startCleanupScheduler } = require('./cleanup');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  process.env.FRONTEND_URL, // Production frontend URL (Netlify)
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/versions', require('./routes/versions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/trash', require('./routes/trash'));
app.use('/api/favorites', require('./routes/favorites'));

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

