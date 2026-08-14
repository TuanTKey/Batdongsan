const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
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
          'Quản Trị Viên (Admin)',
          'admin@batdongsan.vn',
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

              // Insert Properties
              const sampleProperties = [
                {
                  user_id: userId,
                  title: 'Căn hộ cao cấp Ocean View Sơn Trà Đà Nẵng',
                  description: 'Căn hộ view biển Sơn Trà cực đẹp, full nội thất cao cấp nhập khẩu, 2 phòng ngủ, 2 WC. Tiện ích hồ bơi vô cực, gym, an ninh 24/7.',
                  type: 'căn hộ',
                  price: 2200000000, // 2.2 tỷ
                  area: 65,
                  city: 'Đà Nẵng',
                  district: 'Quận Sơn Trà',
                  address: '120 Võ Nguyên Giáp, Phước Mỹ, Sơn Trà, Đà Nẵng',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 16.064,
                  lng: 108.246,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Căn hộ chung cư HAGL Lakeview Thanh Khê',
                  description: 'Căn hộ góc 3 phòng ngủ thoáng mát, view hồ Hàm Nghi. Sổ hồng chính chủ, giao nhà ngay.',
                  type: 'căn hộ',
                  price: 1850000000, // 1.85 tỷ
                  area: 85,
                  city: 'Đà Nẵng',
                  district: 'Quận Thanh Khê',
                  address: '72 Hàm Nghi, Thạc Gián, Thanh Khê, Đà Nẵng',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 16.061,
                  lng: 108.209,
                  status: 'approved'
                },
                {
                  user_id: adminId,
                  title: 'Biệt thự sinh thái mặt sông Hòa Xuân Đà Nẵng',
                  description: 'Biệt thự thiết kế hiện đại 3 tầng, sân vườn rộng rãi, hồ bơi riêng. Vị trí góc 2 mặt tiền sông cực kỳ thoáng mát và riêng tư.',
                  type: 'biệt thự',
                  price: 8500000000, // 8.5 tỷ
                  area: 320,
                  city: 'Đà Nẵng',
                  district: 'Quận Cẩm Lệ',
                  address: 'KĐT Sinh Thái Hòa Xuân, Cẩm Lệ, Đà Nẵng',
                  phone: '0905123456',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 16.02,
                  lng: 108.218,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Đất nền ven biển KĐT Nam Hòa Xuân Ngũ Hành Sơn',
                  description: 'Lô đất đẹp diện tích 100m2 (5x20m), đường 7.5m lề 4m, hướng Đông Nam mát mẻ. Pháp lý đầy đủ sổ đỏ sang tên ngay.',
                  type: 'đất nền',
                  price: 2950000000, // 2.95 tỷ
                  area: 100,
                  city: 'Đà Nẵng',
                  district: 'Quận Ngũ Hành Sơn',
                  address: 'Block B2.15, KĐT Nam Hòa Xuân, Ngũ Hành Sơn, Đà Nẵng',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 16.01,
                  lng: 108.235,
                  status: 'approved'
                },
                {
                  user_id: adminId,
                  title: 'Mặt bằng kinh doanh mặt tiền Lê Duẩn Đà Nẵng',
                  description: 'Mặt bằng kinh doanh tuyến phố thời trang sầm uất nhất Đà Nẵng. Diện tích 90m2 sàn, mặt tiền 6m. Tiện làm showroom, spa, boutique.',
                  type: 'mặt bằng kinh doanh',
                  price: 3500000000, // 3.5 tỷ
                  area: 90,
                  city: 'Đà Nẵng',
                  district: 'Quận Hải Châu',
                  address: '245 Lê Duẩn, Tân Chính, Hải Châu, Đà Nẵng',
                  phone: '0905123456',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 16.068,
                  lng: 108.214,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Nhà phố hiện đại trung tâm Quận Hải Châu Đà Nẵng',
                  description: 'Nhà 3 tầng đúc kiên cố, 4 phòng ngủ, phòng thờ, sân phơi, garage ô tô. Vị trí kiệt ô tô né nhau đường Nguyễn Chí Thanh.',
                  type: 'nhà ở',
                  price: 4600000000, // 4.6 tỷ
                  area: 75,
                  city: 'Đà Nẵng',
                  district: 'Quận Hải Châu',
                  address: '158/24 Nguyễn Chí Thanh, Hải Châu, Đà Nẵng',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 16.066,
                  lng: 108.221,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Căn hộ Studio Vinhomes Central Park Bình Thạnh',
                  description: 'Căn hộ chung cư cao cấp tầng đẹp view công viên Landmark 81. Đầy đủ tiện ích đẳng cấp quốc tế.',
                  type: 'căn hộ',
                  price: 3400000000, // 3.4 tỷ
                  area: 55,
                  city: 'TP. Hồ Chí Minh',
                  district: 'Quận Bình Thạnh',
                  address: '208 Nguyễn Hữu Cảnh, Phường 22, Bình Thạnh, TP. Hồ Chí Minh',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 10.793,
                  lng: 106.721,
                  status: 'approved'
                },
                {
                  user_id: adminId,
                  title: 'Căn hộ Penthouse Landmark 72 Cầu Giấy Hà Nội',
                  description: 'Siêu căn hộ Penthouse sang trọng hàng đầu Hà Nội. View tầm nhìn 360 độ toàn thành phố.',
                  type: 'căn hộ',
                  price: 15000000000, // 15 tỷ
                  area: 280,
                  city: 'Hà Nội',
                  district: 'Quận Cầu Giấy',
                  address: 'Keangnam Landmark 72, Phạm Hùng, Cầu Giấy, Hà Nội',
                  phone: '0905123456',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 21.017,
                  lng: 105.784,
                  status: 'approved'
                },
                {
                  user_id: userId,
                  title: 'Căn hộ chung cư mini Sơn Trà giá rẻ gần đại học',
                  description: 'Căn hộ mới xây 1 phòng ngủ, bàn giao quý III. Thích hợp cho gia đình trẻ hoặc đầu tư cho thuê.',
                  type: 'căn hộ',
                  price: 1250000000, // 1.25 tỷ
                  area: 52,
                  city: 'Đà Nẵng',
                  district: 'Quận Sơn Trà',
                  address: '45 Trần Hưng Đạo, Sơn Trà, Đà Nẵng',
                  phone: '0914888999',
                  images: JSON.stringify([
                    'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1000&q=80'
                  ]),
                  lat: 16.071,
                  lng: 108.231,
                  status: 'pending' // Chờ duyệt để admin thử nghiệm duyệt bài!
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
