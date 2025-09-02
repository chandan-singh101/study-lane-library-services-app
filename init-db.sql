-- Create users table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    seat INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    seat INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample users (adjust as needed)
INSERT INTO users (name, phone, seat) VALUES
('John Doe', '1234567890', 25),
('Jane Smith', '0987654321', 42),
('Bob Johnson', '5551234567', 101)
ON CONFLICT DO NOTHING;