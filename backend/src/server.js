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
app.use(cors());

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on port ${PORT} at 127.0.0.1`);
});

