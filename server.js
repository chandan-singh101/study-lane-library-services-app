
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
// require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL connection pool
// const pool = new Pool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT,
//   // For local development, we don't need SSL
// });

const pool = new Pool({
  connectionString: "postgresql://postgres.ykqrfpbkxnnohffjdbdt:Chandan1@singh@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: {
    rejectUnauthorized: false, // required for Supabase
  },
});
// Function to check and create tables if they don't exist
async function initializeDatabase() {
  try {
    // Check if users table exists
    const usersTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!usersTableCheck.rows[0].exists) {
      console.log('Creating users table...');
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Users table created successfully');
      pool.query(
      `INSERT INTO users (name, phone)
       VALUES 
         ('chandan singh', '9999999999'),
         ('gaurav yadav', '8888888888')
       ON CONFLICT (phone) DO NOTHING`
    );

    console.log("✅ Users table ready and default users inserted");
    }

    // Check if feedback table exists
    const feedbackTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'feedback'
      );
    `);

    if (!feedbackTableCheck.rows[0].exists) {
      console.log('Creating feedback table...');
      await pool.query(`
        CREATE TABLE feedback (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          seat VARCHAR(20),
          feedback TEXT NOT NULL,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Feedback table created successfully');
    }

    // Check if orders table exists
    const ordersTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
      );
    `);

    if (!ordersTableCheck.rows[0].exists) {
      console.log('Creating orders table...');
      await pool.query(`
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          payment_id VARCHAR(100),
          amount NUMERIC(10, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          status VARCHAR(50) NOT NULL,
          user_name VARCHAR(100) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          seat VARCHAR(20),
          cart JSONB NOT NULL,
          error TEXT,
          delivery_status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Orders table created successfully');
    }

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    client.release();

    // Initialize database tables
    await initializeDatabase();

    // Start server
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Login endpoint
app.post('/login', async (req, res) => {
  const { name, phone } = req.body;

  try {
    // Fetch user by phone only
    const query = 'SELECT * FROM users WHERE phone = $1';
    const values = [phone];
    
    const result = await pool.query(query, values);

    if (result.rows.length > 0) {
      const dbUser = result.rows[0];

      // Compare names ignoring case
      if (dbUser.name.toLowerCase() === name.toLowerCase()) {
        res.json({ success: true, message: 'Login successful' });
      } else {
        res.json({ success: false, message: 'Name does not match' });
      }
    } else {
      res.json({ success: false, message: 'Invalid credentials (phone not found)' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Feedback endpoint
app.post('/feedback', async (req, res) => {
  const { name, seat, feedback } = req.body;

  try {
    // Insert feedback into database
    const query = 'INSERT INTO feedback (name, seat, feedback, submitted_at) VALUES ($1, $2, $3, NOW())';
    const values = [name, seat, feedback];
    
    await pool.query(query, values);
    
    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, message: 'Error submitting feedback' });
  }
});

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/service', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'service.html'));
});

// Order recording endpoint
app.post('/api/record-payment', async (req, res) => {
  const {
    payment_id,
    amount,
    currency,
    status,
    user_name,
    user_phone,
    seat,
    cart,
    error
  } = req.body;

  try {
    // Insert order into database
    const query = `
      INSERT INTO orders (payment_id, amount, currency, status, user_name, user_phone, seat, cart, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      payment_id,
      amount,
      currency || 'INR',
      status,
      user_name,
      user_phone,
      seat,
      JSON.stringify(cart),
      error || null
    ];
    
    const result = await pool.query(query, values);
    
    res.json({ 
      success: true, 
      message: 'Order recorded successfully',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error recording order' 
    });
  }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM orders';
    let values = [];
    
    if (status && status !== 'all') {
      query += ' WHERE delivery_status = $1';
      values = [status];
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, values);
    
    res.json({ 
      success: true, 
      orders: result.rows 
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching orders' 
    });
  }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const query = 'UPDATE orders SET delivery_status = $1 WHERE id = $2 RETURNING *';
    const values = [status, id];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Order status updated successfully',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating order status' 
    });
  }
});

// Start the server
startServer();