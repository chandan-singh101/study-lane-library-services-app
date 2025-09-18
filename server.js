const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: "postgresql://postgres.ykqrfpbkxnnohffjdbdt:Chandan1@singh@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: {
    rejectUnauthorized: false, // required for Supabase
  },
});

// Function to check and create tables if they don't exist
async function initializeDatabase() {
  try {
    // Users table
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

    // Feedback table
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

    // Orders table
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
          razorpay_order_id VARCHAR(100),
          amount NUMERIC(10, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          status VARCHAR(50) NOT NULL,
          user_name VARCHAR(100) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          seat_number VARCHAR(20),
          items JSONB NOT NULL,
          delivery_status VARCHAR(20) DEFAULT 'pending',
          delivery_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Orders table created successfully');
    }

    // Complaints table
const complaintsTableCheck = await pool.query(`
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'complaints'
  );
`);

if (!complaintsTableCheck.rows[0].exists) {
  console.log('Creating complaints table...');
  await pool.query(`
    CREATE TABLE complaints (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      seat VARCHAR(20),
      type VARCHAR(50) NOT NULL,
      details TEXT NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Complaints table created successfully');
}

// Contacts table (for contact form)
const contactsTableCheck = await pool.query(`
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts'
  );
`);

if (!contactsTableCheck.rows[0].exists) {
  console.log('Creating contacts table...');
  await pool.query(`
    CREATE TABLE contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Contacts table created successfully');
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

// ================= ROUTES =================

// Login endpoint
app.post('/login', async (req, res) => {
  const { name, phone } = req.body;

  try {
    const query = 'SELECT * FROM users WHERE phone = $1';
    const values = [phone];
    const result = await pool.query(query, values);

    if (result.rows.length > 0) {
      const dbUser = result.rows[0];

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
  res.sendFile(path.join(__dirname, 'public', 'service.html'));
});

// Get all services with their items
// app.get('/api/services', async (req, res) => {
//   try {
//     const query = `
//       SELECT 
//         s.id, s.name, s.description, s.icon,
//         si.id as item_id, si.name as item_name, si.price, si.description as item_description
//       FROM services s
//       LEFT JOIN service_items si ON s.id = si.service_id
//       ORDER BY s.id, si.id
//     `;
    
//     const result = await pool.query(query);

//     // Group services and their items
//     const services = [];
//     let currentService = null;
    
//     result.rows.forEach(row => {
//       if (!currentService || currentService.id !== row.id) {
//         if (currentService) services.push(currentService);
        
//         currentService = {
//           id: row.id,
//           name: row.name,
//           description: row.description,
//           icon: row.icon,
//           items: []
//         };
//       }
      
//       if (row.item_id) {
//         currentService.items.push({
//           id: row.item_id,
//           name: row.item_name,
//           price: row.price,
//           description: row.item_description
//         });
//       }
//     });
    
//     if (currentService) services.push(currentService);
    
//     res.json(services);
//   } catch (error) {
//     console.error('Database error:', error);
//     res.status(500).json({ success: false, message: 'Error fetching services' });
//   }
// });

// Get all services with their items including images
app.get('/api/services', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id, s.name, s.description, s.icon,
        si.id as item_id, si.name as item_name, si.price, si.description as item_description, si.image_url
      FROM services s
      LEFT JOIN service_items si ON s.id = si.service_id
      ORDER BY s.id, si.id
    `;
    
    const result = await pool.query(query);

    const services = [];
    let currentService = null;
    
    result.rows.forEach(row => {
      if (!currentService || currentService.id !== row.id) {
        if (currentService) services.push(currentService);
        
        currentService = {
          id: row.id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          items: []
        };
      }
      
      if (row.item_id) {
        currentService.items.push({
          id: row.item_id,
          name: row.item_name,
          price: row.price,
          description: row.item_description,
          image_url: row.image_url
        });
      }
    });
    
    if (currentService) services.push(currentService);
    
    res.json(services);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, message: 'Error fetching services' });
  }
});



// Submit contact form
app.post('/api/contact', async (req, res) => {
  const { name, phone, message } = req.body;

  try {
    const query = 'INSERT INTO contacts (name, phone, message, submitted_at) VALUES ($1, $2, $3, NOW())';
    const values = [name, phone, message];
    await pool.query(query, values);
    
    res.json({ success: true, message: 'Contact form submitted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, message: 'Error submitting contact form' });
  }
});

// Submit complaint
// app.post('/api/complaint', async (req, res) => {
//   const { name, type, details } = req.body;

//   try {
//     const query = 'INSERT INTO complaints (name, seat, type, details, submitted_at) VALUES ($1, $2, $3, $4, NOW())';
// const values = [name, seat || null, type, details];
//     await pool.query(query, values);
    
//     res.json({ success: true, message: 'Complaint submitted successfully' });
//   } catch (error) {
//     console.error('Database error:', error);
//     res.status(500).json({ success: false, message: 'Error submitting complaint' });
//   }
// });
// Submit complaint
app.post('/complaint', async (req, res) => {
  const { name, seat, type, details } = req.body;  // ✅ include seat here

  try {
    const query = 'INSERT INTO complaints (name, seat, type, details, submitted_at) VALUES ($1, $2, $3, $4, NOW())';
    const values = [name, seat || null, type, details];
    await pool.query(query, values);

    res.json({ success: true, message: 'Complaint submitted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, message: 'Error submitting complaint' });
  }
});


// ✅ Final order recording endpoint (keep this one)
app.post('/api/record-payment', async (req, res) => {
  const {
    payment_id,
    razorpay_order_id,
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
    const query = `
      INSERT INTO orders (payment_id, razorpay_order_id, amount, currency, status, user_name, user_phone, seat_number, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      payment_id,
      razorpay_order_id,
      amount,
      currency || 'INR',
      status,
      user_name,
      user_phone,
      seat,
      JSON.stringify(cart)
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

// ✅ Final update order delivery status endpoint
app.put('/api/orders/:id/delivery-status', async (req, res) => {
  const { id } = req.params;
  const { delivery_status, delivery_notes } = req.body;

  try {
    const query = `
      UPDATE orders 
      SET delivery_status = $1, delivery_notes = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3 
      RETURNING *
    `;
    const values = [delivery_status, delivery_notes, id];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Delivery status updated successfully',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating delivery status' 
    });
  }
});

// ✅ Final get orders endpoint
app.get('/api/orders', async (req, res) => {
  try {
    const { status, delivery_status, user_phone } = req.query;
    
    let query = 'SELECT * FROM orders WHERE 1=1';
    const values = [];
    let paramCount = 0;
    
    if (status && status !== 'all') {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }
    
    if (delivery_status && delivery_status !== 'all') {
      paramCount++;
      query += ` AND delivery_status = $${paramCount}`;
      values.push(delivery_status);
    }
    
    if (user_phone) {
      paramCount++;
      query += ` AND user_phone = $${paramCount}`;
      values.push(user_phone);
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send("I am alive 🚀");
});


startServer();