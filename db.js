const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || __dirname;
const dbPath = path.resolve(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Foreign keys constraint enable
  db.run('PRAGMA foreign_keys = ON;');

  // 1. Create users table
  db.run(`
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

  // 2. Create properties table
  db.run(`
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
      lat REAL DEFAULT 16.0544,
      lng REAL DEFAULT 108.2022,
      status TEXT DEFAULT 'approved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // 3. Create favorites table
  db.run(`
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

  // 4. Create conversations table
  db.run(`
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

  // 5. Create messages table
  db.run(`
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

  // Ensure Admin Account admin@bdshungyen.vn exists with password 'admin123' and remove legacy admin
  (async () => {
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    // Ensure admin@bdshungyen.vn
    db.get('SELECT id FROM users WHERE email = ?', ['admin@bdshungyen.vn'], (err, row) => {
      if (!row) {
        db.run(
          `INSERT INTO users (name, email, password, phone, avatar, role) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            'Quản Trị Viên (BĐS Hưng Yên)',
            'admin@bdshungyen.vn',
            adminPassword,
            '0905123456',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
            'admin'
          ]
        );
      } else {
        db.run('UPDATE users SET password = ?, role = ? WHERE email = ?', [adminPassword, 'admin', 'admin@bdshungyen.vn']);
      }
    });

    // Delete old legacy admin account if present
    db.run("DELETE FROM users WHERE email = 'admin@batdongsan.vn'");
  })();

  // Seed Data
  db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
    if (err) {
      console.error('Error checking users count:', err);
      return;
    }
    if (row.count === 0) {
      console.log('Seeding initial data into SQLite database...');
      const adminPassword = await bcrypt.hash('admin123', 10);
      const userPassword = await bcrypt.hash('user123', 10);

      // Insert Admin User
      db.run(
        `INSERT INTO users (name, email, password, phone, avatar, role) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'Quản Trị Viên (BĐS Hưng Yên)',
          'admin@bdshungyen.vn',
          adminPassword,
          '0905123456',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
          'admin'
        ],
        function (err) {
          if (err) return console.error('Error seeding admin:', err);
          const adminId = this.lastID;

          // Insert Regular User
          db.run(
            `INSERT INTO users (name, email, password, phone, avatar, role) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              'Nguyễn Văn An',
              'nguyenvana@gmail.com',
              userPassword,
              '0914888999',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
              'user'
            ],
            function (err) {
              if (err) return console.error('Error seeding user:', err);
              const userId = this.lastID;

              // Insert Hưng Yên Properties
              const sampleProperties = [
                {
                  user_id: userId,
                  title: 'Căn hộ cao cấp Ecopark Swanlake Onsen Văn Giang Hưng Yên',
                  description: 'Căn hộ khoáng nóng chuẩn Nhật Bản tại KĐT Ecopark Văn Giang, Hưng Yên. View trọn hồ Swan Lake 50ha, 2 phòng ngủ 2 WC, bàn giao full nội thất cao cấp. Tiện ích suối khoáng nóng khoáng bùn, bể bơi vô cực, công viên khoáng nóng.',
                  type: 'căn hộ',
                  price: 2850000000, // 2.85 tỷ
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
                  description: 'Biệt thự đơn lập phân khu San Hoạn vị trí đắc địa gần công viên nước Royal Wave Park. Diện tích 160m2, xây 4 tầng tân cổ điển sang trọng, sổ đỏ lâu dài chính chủ.',
                  type: 'biệt thự',
                  price: 11500000000, // 11.5 tỷ
                  area: 160,
                  city: 'Hưng Yên',
                  district: 'Văn Giang',
                  address: 'KĐT Vinhomes Ocean Park 2, Nghĩa Trụ, Văn Giang, Hưng Yên',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 20.947,
                  lng: 105.981,
                  status: 'approved'
                },
                {
                  user_id: adminId,
                  title: 'Đất nền thổ cư đấu giá mặt đường Như Quỳnh Văn Lâm Hưng Yên',
                  description: 'Lô đất đấu giá đẹp vuông vắn diện tích 90m2 (5x18m), đường rộng 12m vỉa hè 3m. Nằm kế bên tuyến QL5A kết nối Hà Nội - Hưng Yên. Tiện ở hoặc làm kho xưởng, gara ô tô.',
                  type: 'đất nền',
                  price: 3200000000, // 3.2 tỷ
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
                },
                {
                  user_id: adminId,
                  title: 'Shophouse mặt bằng kinh doanh phố Bần Thị xã Mỹ Hào Hưng Yên',
                  description: 'Nhà phố shophouse kinh doanh sầm uất mặt đường Nguyễn Văn Linh, Phường Nhân Hòa, Thị xã Mỹ Hào. Diện tích 85m2 sàn đúc 4.5 tầng, kinh doanh mọi ngành nghề.',
                  type: 'mặt bằng kinh doanh',
                  price: 4500000000, // 4.5 tỷ
                  area: 85,
                  city: 'Hưng Yên',
                  district: 'Mỹ Hào',
                  address: 'Đường Nguyễn Văn Linh, Phường Nhân Hòa, Thị xã Mỹ Hào, Hưng Yên',
                  phone: '0905123456',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 20.938,
                  lng: 106.095,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Nhà phố 3 tầng trung tâm Phường Hiến Nam TP. Hưng Yên',
                  description: 'Nhà xây kiên cố 3 tầng, 3 phòng ngủ, phòng khách, phòng thờ. Ô tô ngủ trong nhà. Gần Phố Hiến cổ kính, UBND Tỉnh, trường chuyên Hưng Yên.',
                  type: 'nhà ở',
                  price: 2450000000, // 2.45 tỷ
                  area: 75,
                  city: 'Hưng Yên',
                  district: 'TP. Hưng Yên',
                  address: 'Phường Hiến Nam, Thành phố Hưng Yên, Tỉnh Hưng Yên',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 20.651,
                  lng: 106.052,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Căn hộ Haven Park Ecopark Văn Giang Hưng Yên',
                  description: 'Căn hộ công viên trong đại ngàn xanh Ecopark Hưng Yên. Tầng trung thoáng mát view biệt thự đảo Grand Island. Pháp lý đầy đủ sổ hồng sang tên ngay.',
                  type: 'căn hộ',
                  price: 1950000000, // 1.95 tỷ
                  area: 58,
                  city: 'Hưng Yên',
                  district: 'Văn Giang',
                  address: 'KĐT Ecopark, Phụng Công, Văn Giang, Hưng Yên',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 20.960,
                  lng: 105.930,
                  status: 'approved'
                },
                {
                  user_id: adminId,
                  title: 'Đất quy hoạch kho xưởng KCN Thăng Long II Yên Mỹ Hưng Yên',
                  description: 'Lô đất sào quy hoạch đất sản xuất kinh doanh phi nông nghiệp gần KCN Thăng Long II Yên Mỹ. Mặt đường xe container 40 feet vào tận nơi.',
                  type: 'đất nền',
                  price: 6800000000, // 6.8 tỷ
                  area: 450,
                  city: 'Hưng Yên',
                  district: 'Yên Mỹ',
                  address: 'Xã Tân Lập, Huyện Yên Mỹ, Hưng Yên',
                  phone: '0905123456',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 20.902,
                  lng: 106.015,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Nhà vườn sinh thái ven sông Hồng Khoái Châu Hưng Yên',
                  description: 'Khu nhà vườn rộng 280m2 có cây ăn quả, ao cá nhỏ, biệt thự sân vườn thoáng mát. Rất hợp nghỉ dưỡng cuối tuần gần làng cổ Đông Tảo.',
                  type: 'biệt thự',
                  price: 3800000000, // 3.8 tỷ
                  area: 280,
                  city: 'Hưng Yên',
                  district: 'Khoái Châu',
                  address: 'Xã Bình Minh, Huyện Khoái Châu, Hưng Yên',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 20.831,
                  lng: 105.945,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Lô đất nền góc đấu giá thị trấn Vương Tiên Lữ Hưng Yên',
                  description: 'Đất đấu giá khu dân cư mới thị trấn Vương Huyện Tiên Lữ. Lô góc 2 mặt tiền rộng rãi 95m2, sổ đỏ vuông vắn sang tên liền.',
                  type: 'đất nền',
                  price: 1350000000, // 1.35 tỷ
                  area: 95,
                  city: 'Hưng Yên',
                  district: 'Tiên Lữ',
                  address: 'Thị trấn Vương, Huyện Tiên Lữ, Hưng Yên',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 20.655,
                  lng: 106.142,
                  status: 'pending'
                }
              ];

              const stmt = db.prepare(`
                INSERT INTO properties (user_id, title, description, type, price, area, city, district, address, phone, images, lat, lng, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              sampleProperties.forEach((p) => {
                stmt.run([
                  p.user_id,
                  p.title,
                  p.description,
                  p.type,
                  p.price,
                  p.area,
                  p.city,
                  p.district,
                  p.address,
                  p.phone,
                  p.images,
                  p.lat,
                  p.lng,
                  p.status
                ]);
              });
              stmt.finalize();

              // Add initial sample favorite
              db.run(`INSERT INTO favorites (user_id, property_id) VALUES (?, ?)`, [userId, 1]);

              console.log('Database initialized with seed data successfully.');
            }
          );
        }
      );
    }
  });
});

module.exports = db;
