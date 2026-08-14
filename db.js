const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

let db = {};
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  console.log('Connecting to Render PostgreSQL Database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const convertQuery = (sql) => {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  };

  db = {
    isPostgres: true,
    get: (sql, params = [], cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const pgSql = convertQuery(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) return cb ? cb(err) : null;
        cb ? cb(null, res && res.rows ? res.rows[0] : null) : null;
      });
    },
    all: (sql, params = [], cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const pgSql = convertQuery(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) return cb ? cb(err) : null;
        cb ? cb(null, res && res.rows ? res.rows : []) : null;
      });
    },
    run: function (sql, params = [], cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      let pgSql = convertQuery(sql);
      
      const trimmed = pgSql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT') && !trimmed.includes('RETURNING')) {
        pgSql += ' RETURNING id';
      }

      pool.query(pgSql, params, (err, res) => {
        if (err) return cb ? cb(err) : null;
        const lastID = res && res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null;
        const changes = res ? res.rowCount : 0;
        if (cb) {
          cb.call({ lastID, changes }, null);
        }
      });
    },
    serialize: (fn) => fn()
  };

  // Create PostgreSQL Schema & Seed Data ONCE
  const initPgSchema = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key VARCHAR(100) PRIMARY KEY,
          val TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          avatar TEXT,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS properties (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          price NUMERIC NOT NULL,
          area NUMERIC NOT NULL,
          city VARCHAR(100) NOT NULL,
          district VARCHAR(100),
          address TEXT NOT NULL,
          phone VARCHAR(50) NOT NULL,
          images TEXT NOT NULL,
          lat NUMERIC DEFAULT 20.651,
          lng NUMERIC DEFAULT 106.052,
          status VARCHAR(50) DEFAULT 'approved',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS favorites (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, property_id)
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(property_id, buyer_id, seller_id)
        );

        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          is_read INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const adminPassword = await bcrypt.hash('admin123', 10);
      const userPassword = await bcrypt.hash('user123', 10);

      // Ensure Admin admin@bdshungyen.vn
      const checkAdmin = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@bdshungyen.vn']);
      if (checkAdmin.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (name, email, password, phone, avatar, role) VALUES ($1, $2, $3, $4, $5, $6)`,
          ['Quản Trị Viên (BĐS Hưng Yên)', 'admin@bdshungyen.vn', adminPassword, '0905123456', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 'admin']
        );
      } else {
        await pool.query('UPDATE users SET password = $1, role = $2 WHERE email = $3', [adminPassword, 'admin', 'admin@bdshungyen.vn']);
      }

      // Delete old legacy admin if present
      await pool.query("DELETE FROM users WHERE email = 'admin@batdongsan.vn'");

      // Seed Properties ONLY ONCE using system_settings flag
      const checkSeeded = await pool.query("SELECT val FROM system_settings WHERE key = 'properties_seeded'");
      if (checkSeeded.rows.length === 0) {
        const adminRes = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@bdshungyen.vn']);
        const adminId = adminRes.rows[0].id;

        const checkUser = await pool.query('SELECT id FROM users WHERE email = $1', ['nguyenvana@gmail.com']);
        let userId;
        if (checkUser.rows.length === 0) {
          const userRes = await pool.query(
            `INSERT INTO users (name, email, password, phone, avatar, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            ['Nguyễn Văn An', 'nguyenvana@gmail.com', userPassword, '0914888999', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 'user']
          );
          userId = userRes.rows[0].id;
        } else {
          userId = checkUser.rows[0].id;
        }

        const sampleProperties = [
          {
            user_id: userId,
            title: 'Căn hộ cao cấp Ecopark Swanlake Onsen Văn Giang Hưng Yên',
            description: 'Căn hộ khoáng nóng chuẩn Nhật Bản tại KĐT Ecopark Văn Giang, Hưng Yên. View trọn hồ Swan Lake 50ha, 2 phòng ngủ 2 WC, bàn giao full nội thất cao cấp.',
            type: 'căn hộ',
            price: 2850000000,
            area: 68,
            city: 'Hưng Yên',
            district: 'Văn Giang',
            address: 'KĐT Ecopark, Xã Phụng Công, Văn Giang, Hưng Yên',
            phone: '0914888999',
            images: JSON.stringify([
              'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
              'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80'
            ]),
            lat: 20.963,
            lng: 105.932,
            status: 'approved'
          },
          {
            user_id: userId,
            title: 'Biệt thự Vinhomes Ocean Park 2 San Hoạn Văn Giang Hưng Yên',
            description: 'Biệt thự đơn lập phân khu San Hoạn vị trí đắc địa gần công viên nước Royal Wave Park. Diện tích 160m2, xây 4 tầng tân cổ điển sang trọng.',
            type: 'biệt thự',
            price: 11500000000,
            area: 160,
            city: 'Hưng Yên',
            district: 'Văn Giang',
            address: 'KĐT Vinhomes Ocean Park 2, Nghĩa Trụ, Văn Giang, Hưng Yên',
            phone: '0914888999',
            images: JSON.stringify([
              'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80'
            ]),
            lat: 20.947,
            lng: 105.981,
            status: 'approved'
          },
          {
            user_id: adminId,
            title: 'Đất nền thổ cư đấu giá mặt đường Như Quỳnh Văn Lâm Hưng Yên',
            description: 'Lô đất đấu giá đẹp vuông vắn diện tích 90m2 (5x18m), đường rộng 12m vỉa hè 3m. Nằm kế bên tuyến QL5A.',
            type: 'đất nền',
            price: 3200000000,
            area: 90,
            city: 'Hưng Yên',
            district: 'Văn Lâm',
            address: 'Thị trấn Như Quỳnh, Văn Lâm, Hưng Yên',
            phone: '0905123456',
            images: JSON.stringify([
              'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80'
            ]),
            lat: 20.985,
            lng: 106.012,
            status: 'approved'
          }
        ];

        for (const p of sampleProperties) {
          await pool.query(
            `INSERT INTO properties (user_id, title, description, type, price, area, city, district, address, phone, images, lat, lng, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [p.user_id, p.title, p.description, p.type, p.price, p.area, p.city, p.district, p.address, p.phone, p.images, p.lat, p.lng, p.status]
          );
        }

        // Mark as seeded permanently
        await pool.query("INSERT INTO system_settings (key, val) VALUES ('properties_seeded', 'true')");
      }
      console.log('Render PostgreSQL Database connected and initialized successfully!');
    } catch (err) {
      console.error('Error initializing PostgreSQL schema:', err);
    }
  };

  initPgSchema();

} else {
  console.log('Connecting to local SQLite database...');
  const dataDir = process.env.DATA_DIR || __dirname;
  const dbPath = path.resolve(dataDir, 'database.sqlite');
  const sqliteInstance = new sqlite3.Database(dbPath);

  sqliteInstance.serialize(() => {
    sqliteInstance.run('PRAGMA foreign_keys = ON;');

    sqliteInstance.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        val TEXT
      )
    `);

    sqliteInstance.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT NOT NULL,
        avatar TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    sqliteInstance.run(`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        price REAL NOT NULL,
        area REAL NOT NULL,
        city TEXT NOT NULL,
        district TEXT,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        images TEXT NOT NULL,
        lat REAL DEFAULT 20.651,
        lng REAL DEFAULT 106.052,
        status TEXT DEFAULT 'approved',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    sqliteInstance.run(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        property_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, property_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
      )
    `);

    sqliteInstance.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        buyer_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(property_id, buyer_id, seller_id),
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    sqliteInstance.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    (async () => {
      const adminPassword = await bcrypt.hash('admin123', 10);
      const userPassword = await bcrypt.hash('user123', 10);

      sqliteInstance.get('SELECT id FROM users WHERE email = ?', ['admin@bdshungyen.vn'], (err, row) => {
        if (!row) {
          sqliteInstance.run(
            `INSERT INTO users (name, email, password, phone, avatar, role) VALUES (?, ?, ?, ?, ?, ?)`,
            ['Quản Trị Viên (BĐS Hưng Yên)', 'admin@bdshungyen.vn', adminPassword, '0905123456', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 'admin']
          );
        } else {
          sqliteInstance.run('UPDATE users SET password = ?, role = ? WHERE email = ?', [adminPassword, 'admin', 'admin@bdshungyen.vn']);
        }
      });

      sqliteInstance.run("DELETE FROM users WHERE email = 'admin@batdongsan.vn'");

      sqliteInstance.get("SELECT val FROM system_settings WHERE key = 'properties_seeded'", (err, row) => {
        if (!row) {
          sqliteInstance.run(
            `INSERT INTO users (name, email, password, phone, avatar, role) VALUES (?, ?, ?, ?, ?, ?)`,
            ['Nguyễn Văn An', 'nguyenvana@gmail.com', userPassword, '0914888999', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 'user'],
            function () {
              const userId = this.lastID;
              sqliteInstance.run(
                `INSERT INTO properties (user_id, title, description, type, price, area, city, district, address, phone, images, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, 'Căn hộ cao cấp Ecopark Swanlake Onsen Văn Giang Hưng Yên', 'Căn hộ khoáng nóng chuẩn Nhật Bản', 'căn hộ', 2850000000, 68, 'Hưng Yên', 'Văn Giang', 'KĐT Ecopark', '0914888999', '["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00"]', 'approved'],
                function () {
                  sqliteInstance.run("INSERT INTO system_settings (key, val) VALUES ('properties_seeded', 'true')");
                }
              );
            }
          );
        }
      });
    })();
  });

  db = sqliteInstance;
}

module.exports = db;
