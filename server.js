const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'batdongsan_jwt_secret_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const multer = require('multer');
const fs = require('fs');

// Ensure public/uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `bds-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file hình ảnh (JPG, PNG, WEBP, GIF)'), false);
    }
  }
});

// Middleware: Authentication Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Chưa cung cấp mã xác thực' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ' });
    req.user = user;
    next();
  });
};

// Middleware: Optional Authentication (to check favorites for guest/logged-in users)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) req.user = user;
      next();
    });
  } else {
    next();
  }
};

// Middleware: Admin Only Check
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu quyền Quản trị viên (Admin).' });
  }
  next();
};

// ==========================================
// 1. AUTHENTICATION APIS
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone, avatar } = req.body;
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ Tên, Email, Mật khẩu và Số điện thoại' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultAvatar = avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
    
    db.run(
      `INSERT INTO users (name, email, password, phone, avatar, role) VALUES (?, ?, ?, ?, ?, 'user')`,
      [name, email.toLowerCase().trim(), hashedPassword, phone, defaultAvatar],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email này đã được sử dụng' });
          }
          return res.status(500).json({ error: 'Lỗi đăng ký tài khoản: ' + err.message });
        }

        const userId = this.lastID;
        const userObj = { id: userId, name, email: email.toLowerCase().trim(), phone, avatar: defaultAvatar, role: 'user' };
        const token = jwt.sign(userObj, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
          message: 'Đăng ký tài khoản thành công',
          user: userObj,
          token
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
    if (!user) return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác' });

    const userObj = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role
    };

    const token = jwt.sign(userObj, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Đăng nhập thành công',
      user: userObj,
      token
    });
  });
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, phone, avatar, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(user);
  });
});

// Update Profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name, phone, avatar, password } = req.body;
  const userId = req.user.id;

  try {
    let query = 'UPDATE users SET name = ?, phone = ?, avatar = ?';
    let params = [name, phone, avatar];

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    db.run(query, params, function (err) {
      if (err) return res.status(500).json({ error: 'Lỗi cập nhật thông tin: ' + err.message });
      
      db.get('SELECT id, name, email, phone, avatar, role FROM users WHERE id = ?', [userId], (err, updatedUser) => {
        const token = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '7d' });
        res.json({
          message: 'Cập nhật thông tin cá nhân thành công',
          user: updatedUser,
          token
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Vui lòng nhập Email' });

  db.get('SELECT id, name FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });
    }
    // Simulation reset link
    res.json({
      message: `Yêu cầu đặt lại mật khẩu đã được gửi đến email ${email}. Vui lòng kiểm tra hộp thư của bạn!`
    });
  });
});

// ==========================================
// 2. PROPERTY MANAGEMENT & SEARCH APIS
// ==========================================

// Get Properties list with advanced Filters (Keyword, City, Price Range, Area Range, Type)
app.get('/api/properties', optionalAuth, (req, res) => {
  const { keyword, city, type, min_price, max_price, min_area, max_area, status } = req.query;

  let sql = `
    SELECT p.*, u.name as seller_name, u.email as seller_email, u.avatar as seller_avatar
    FROM properties p
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  // Filter status (Default: only approved properties for public view, unless specified)
  if (status) {
    sql += ` AND p.status = ?`;
    params.push(status);
  } else {
    sql += ` AND p.status = 'approved'`;
  }

  // Keyword filter (search in title, description, address, district)
  if (keyword && keyword.trim() !== '') {
    sql += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.address LIKE ? OR p.district LIKE ?)`;
    const kw = `%${keyword.trim()}%`;
    params.push(kw, kw, kw, kw);
  }

  // Location / City filter
  if (city && city !== 'all' && city.trim() !== '') {
    sql += ` AND p.city LIKE ?`;
    params.push(`%${city.trim()}%`);
  }

  // Property type filter
  if (type && type !== 'all' && type.trim() !== '') {
    sql += ` AND LOWER(p.type) = LOWER(?)`;
    params.push(type.trim());
  }

  // Price filter (VND)
  if (min_price && !isNaN(min_price)) {
    sql += ` AND p.price >= ?`;
    params.push(Number(min_price));
  }
  if (max_price && !isNaN(max_price)) {
    sql += ` AND p.price <= ?`;
    params.push(Number(max_price));
  }

  // Area filter (m2)
  if (min_area && !isNaN(min_area)) {
    sql += ` AND p.area >= ?`;
    params.push(Number(min_area));
  }
  if (max_area && !isNaN(max_area)) {
    sql += ` AND p.area <= ?`;
    params.push(Number(max_area));
  }

  sql += ` ORDER BY p.id DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi truy vấn danh sách bất động sản: ' + err.message });

    // Format images JSON
    const properties = rows.map((item) => {
      try {
        item.images = JSON.parse(item.images);
      } catch (e) {
        item.images = [item.images];
      }
      return item;
    });

    // Check favorites if user is authenticated
    if (req.user) {
      db.all('SELECT property_id FROM favorites WHERE user_id = ?', [req.user.id], (fErr, fRows) => {
        const favIds = new Set((fRows || []).map((f) => f.property_id));
        const result = properties.map((p) => ({
          ...p,
          is_favorite: favIds.has(p.id)
        }));
        res.json(result);
      });
    } else {
      res.json(properties.map((p) => ({ ...p, is_favorite: false })));
    }
  });
});

// Get User's Own Listed Properties
app.get('/api/my-properties', authenticateToken, (req, res) => {
  const sql = `
    SELECT p.*, u.name as seller_name, u.avatar as seller_avatar
    FROM properties p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.id DESC
  `;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi tải danh sách bài đăng' });
    const properties = rows.map((item) => {
      try {
        item.images = JSON.parse(item.images);
      } catch (e) {
        item.images = [item.images];
      }
      return item;
    });
    res.json(properties);
  });
});

// Get Property Detail by ID
app.get('/api/properties/:id', optionalAuth, (req, res) => {
  const id = req.params.id;
  const sql = `
    SELECT p.*, u.name as seller_name, u.email as seller_email, u.phone as seller_phone_default, u.avatar as seller_avatar
    FROM properties p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `;
  db.get(sql, [id], (err, property) => {
    if (err || !property) return res.status(404).json({ error: 'Không tìm thấy bất động sản' });

    try {
      property.images = JSON.parse(property.images);
    } catch (e) {
      property.images = [property.images];
    }

    if (req.user) {
      db.get('SELECT id FROM favorites WHERE user_id = ? AND property_id = ?', [req.user.id, id], (fErr, fav) => {
        property.is_favorite = !!fav;
        res.json(property);
      });
    } else {
      property.is_favorite = false;
      res.json(property);
    }
  });
});

// Create New Property Listing
app.post('/api/properties', authenticateToken, (req, res) => {
  const { title, description, type, price, area, city, district, address, phone, images, lat, lng } = req.body;

  if (!title || !description || !type || !price || !area || !city || !address || !phone) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ Tiêu đề, Mô tả, Loại, Giá, Diện tích, Địa chỉ và SĐT' });
  }

  const imageList = Array.isArray(images) && images.length > 0 ? images : [
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80'
  ];

  // Admins' posts automatically approved; Users' posts start with 'pending'
  const status = req.user.role === 'admin' ? 'approved' : 'pending';

  const sql = `
    INSERT INTO properties (user_id, title, description, type, price, area, city, district, address, phone, images, lat, lng, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      req.user.id,
      title,
      description,
      type.toLowerCase(),
      Number(price),
      Number(area),
      city,
      district || '',
      address,
      phone,
      JSON.stringify(imageList),
      lat || 16.0544,
      lng || 108.2022,
      status
    ],
    function (err) {
      if (err) return res.status(500).json({ error: 'Lỗi khi đăng tin: ' + err.message });
      res.status(201).json({
        message: status === 'approved' ? 'Đăng tin bất động sản thành công!' : 'Tin của bạn đã được gửi và đang chờ Admin duyệt.',
        id: this.lastID,
        status
      });
    }
  );
});

// Update Property Listing
app.put('/api/properties/:id', authenticateToken, (req, res) => {
  const propId = req.params.id;
  const { title, description, type, price, area, city, district, address, phone, images } = req.body;

  // Check ownership or admin
  db.get('SELECT user_id FROM properties WHERE id = ?', [propId], (err, prop) => {
    if (err || !prop) return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
    if (prop.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bài đăng này' });
    }

    const imageList = Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null;
    let sql = `
      UPDATE properties 
      SET title = ?, description = ?, type = ?, price = ?, area = ?, city = ?, district = ?, address = ?, phone = ?
    `;
    let params = [title, description, type.toLowerCase(), Number(price), Number(area), city, district || '', address, phone];

    if (imageList) {
      sql += `, images = ?`;
      params.push(imageList);
    }

    sql += ` WHERE id = ?`;
    params.push(propId);

    db.run(sql, params, function (uErr) {
      if (uErr) return res.status(500).json({ error: 'Lỗi cập nhật bài đăng' });
      res.json({ message: 'Cập nhật bài đăng bất động sản thành công!' });
    });
  });
});

// Delete Property Listing
app.delete('/api/properties/:id', authenticateToken, (req, res) => {
  const propId = req.params.id;

  db.get('SELECT user_id FROM properties WHERE id = ?', [propId], (err, prop) => {
    if (err || !prop) return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
    if (prop.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này' });
    }

    db.run('DELETE FROM properties WHERE id = ?', [propId], function (dErr) {
      if (dErr) return res.status(500).json({ error: 'Lỗi khi xóa bài đăng' });
      res.json({ message: 'Đã xóa bài đăng thành công' });
    });
  });
});

// ==========================================
// 3. FAVORITES APIS
// ==========================================

// Get list of saved favorites
app.get('/api/favorites', authenticateToken, (req, res) => {
  const sql = `
    SELECT p.*, u.name as seller_name, u.avatar as seller_avatar
    FROM favorites f
    JOIN properties p ON f.property_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE f.user_id = ?
    ORDER BY f.id DESC
  `;

  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi tải danh sách yêu thích' });
    const properties = rows.map((item) => {
      try {
        item.images = JSON.parse(item.images);
      } catch (e) {
        item.images = [item.images];
      }
      return { ...item, is_favorite: true };
    });
    res.json(properties);
  });
});

// Add to Favorites / Toggle
app.post('/api/favorites/:id', authenticateToken, (req, res) => {
  const propId = req.params.id;
  const userId = req.user.id;

  db.get('SELECT id FROM favorites WHERE user_id = ? AND property_id = ?', [userId, propId], (err, fav) => {
    if (fav) {
      // Already favorited -> remove
      db.run('DELETE FROM favorites WHERE id = ?', [fav.id], (dErr) => {
        if (dErr) return res.status(500).json({ error: 'Lỗi khi bỏ yêu thích' });
        res.json({ message: 'Đã bỏ bất động sản khỏi danh sách yêu thích', is_favorite: false });
      });
    } else {
      // Add to favorites
      db.run('INSERT INTO favorites (user_id, property_id) VALUES (?, ?)', [userId, propId], (iErr) => {
        if (iErr) return res.status(500).json({ error: 'Lỗi khi lưu yêu thích' });
        res.json({ message: 'Đã lưu bất động sản vào danh sách yêu thích', is_favorite: true });
      });
    }
  });
});

// Delete from Favorites
app.delete('/api/favorites/:id', authenticateToken, (req, res) => {
  const propId = req.params.id;
  const userId = req.user.id;

  db.run('DELETE FROM favorites WHERE user_id = ? AND property_id = ?', [userId, propId], function (err) {
    if (err) return res.status(500).json({ error: 'Lỗi khi xóa khỏi yêu thích' });
    res.json({ message: 'Đã xóa khỏi danh sách yêu thích', is_favorite: false });
  });
});

// ==========================================
// 4. ADMIN DASHBOARD & MODERATION APIS
// ==========================================

// Get Admin Overview Statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const stats = {};

  db.get('SELECT COUNT(*) as total_users FROM users', (err1, row1) => {
    stats.total_users = row1 ? row1.total_users : 0;
    
    db.get('SELECT COUNT(*) as total_properties FROM properties', (err2, row2) => {
      stats.total_properties = row2 ? row2.total_properties : 0;

      db.get("SELECT COUNT(*) as pending_properties FROM properties WHERE status = 'pending'", (err3, row3) => {
        stats.pending_properties = row3 ? row3.pending_properties : 0;

        db.get("SELECT COUNT(*) as approved_properties FROM properties WHERE status = 'approved'", (err4, row4) => {
          stats.approved_properties = row4 ? row4.approved_properties : 0;
          res.json(stats);
        });
      });
    });
  });
});

// ==========================================
// FILE UPLOAD API ROUTE (Multi Image Upload)
// ==========================================
app.post('/api/upload', authenticateToken, upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 hình ảnh' });
    }
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ message: 'Tải ảnh lên thành công', urls });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi tải ảnh lên máy chủ' });
  }
});

// Get All Users (Admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT id, name, email, phone, avatar, role, created_at FROM users ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi tải danh sách người dùng' });
    res.json(rows);
  });
});

// Delete User (Admin)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  if (Number(userId) === req.user.id) {
    return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình' });
  }

  db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
    if (err) return res.status(500).json({ error: 'Lỗi khi xóa người dùng' });
    res.json({ message: 'Đã xóa người dùng thành công' });
  });
});

// Get All Properties for Admin Moderation
app.get('/api/admin/properties', authenticateToken, requireAdmin, (req, res) => {
  const sql = `
    SELECT p.*, u.name as seller_name, u.email as seller_email
    FROM properties p
    JOIN users u ON p.user_id = u.id
    ORDER BY CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END, p.id DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi tải danh sách quản trị' });
    const properties = rows.map((item) => {
      try {
        item.images = JSON.parse(item.images);
      } catch (e) {
        item.images = [item.images];
      }
      return item;
    });
    res.json(properties);
  });
});

// Approve or Reject Property Post (Admin)
app.patch('/api/admin/properties/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const propId = req.params.id;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  db.run('UPDATE properties SET status = ? WHERE id = ?', [status, propId], function (err) {
    if (err) return res.status(500).json({ error: 'Lỗi cập nhật trạng thái bài đăng' });
    res.json({ message: `Đã cập nhật trạng thái bài đăng thành ${status === 'approved' ? 'ĐÃ DUYỆT' : 'TỪ CHỐI'}`, status });
  });
});

// ==========================================
// 5. REAL-TIME CHAT APIS (BUYER <-> SELLER)
// ==========================================

// Start or retrieve a conversation
app.post('/api/chat/start', authenticateToken, (req, res) => {
  const { property_id, seller_id } = req.body;
  const buyer_id = req.user.id;

  if (!property_id || !seller_id) {
    return res.status(400).json({ error: 'Thiếu thông tin bất động sản hoặc người bán' });
  }

  if (Number(buyer_id) === Number(seller_id)) {
    return res.status(400).json({ error: 'Bạn là người đăng bài viết này, không thể tự nhắn tin cho chính mình' });
  }

  // Check if conversation exists
  const findSql = `SELECT id FROM conversations WHERE property_id = ? AND buyer_id = ? AND seller_id = ?`;
  db.get(findSql, [property_id, buyer_id, seller_id], (err, conv) => {
    if (err) return res.status(500).json({ error: 'Lỗi cơ sở dữ liệu chat' });

    if (conv) {
      return res.json({ conversation_id: conv.id });
    }

    // Create new conversation
    const insertSql = `INSERT INTO conversations (property_id, buyer_id, seller_id) VALUES (?, ?, ?)`;
    db.run(insertSql, [property_id, buyer_id, seller_id], function (iErr) {
      if (iErr) return res.status(500).json({ error: 'Lỗi tạo cuộc trò chuyện' });
      res.status(201).json({ conversation_id: this.lastID });
    });
  });
});

// Get user's active conversations list
app.get('/api/chat/conversations', authenticateToken, (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT 
      c.id as conversation_id,
      c.property_id,
      c.buyer_id,
      c.seller_id,
      c.updated_at,
      p.title as property_title,
      p.price as property_price,
      p.images as property_images,
      b.name as buyer_name,
      b.avatar as buyer_avatar,
      s.name as seller_name,
      s.avatar as seller_avatar,
      (
        SELECT text FROM messages 
        WHERE conversation_id = c.id 
        ORDER BY id DESC LIMIT 1
      ) as last_message,
      (
        SELECT created_at FROM messages 
        WHERE conversation_id = c.id 
        ORDER BY id DESC LIMIT 1
      ) as last_message_time,
      (
        SELECT COUNT(*) FROM messages 
        WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0
      ) as unread_count
    FROM conversations c
    JOIN properties p ON c.property_id = p.id
    JOIN users b ON c.buyer_id = b.id
    JOIN users s ON c.seller_id = s.id
    WHERE c.buyer_id = ? OR c.seller_id = ?
    ORDER BY c.updated_at DESC
  `;

  db.all(sql, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi tải danh sách cuộc trò chuyện: ' + err.message });
    const conversations = rows.map((c) => {
      try {
        c.property_images = JSON.parse(c.property_images);
      } catch (e) {
        c.property_images = [c.property_images];
      }
      return c;
    });
    res.json(conversations);
  });
});

// Get total unread count for navbar badge
app.get('/api/chat/unread-count', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT COUNT(*) as unread_total
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE (c.buyer_id = ? OR c.seller_id = ?)
      AND m.sender_id != ?
      AND m.is_read = 0
  `;
  db.get(sql, [userId, userId, userId], (err, row) => {
    if (err) return res.status(500).json({ unread_total: 0 });
    res.json({ unread_total: row ? row.unread_total : 0 });
  });
});

// Get message history for a conversation & mark as read
app.get('/api/chat/conversations/:id/messages', authenticateToken, (req, res) => {
  const convId = req.params.id;
  const userId = req.user.id;

  // Verify membership
  db.get('SELECT * FROM conversations WHERE id = ?', [convId], (err, conv) => {
    if (err || !conv) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    if (conv.buyer_id !== userId && conv.seller_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền xem cuộc trò chuyện này' });
    }

    // Mark messages as read
    db.run('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?', [convId, userId]);

    // Fetch messages
    const msgSql = `
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.id ASC
    `;
    db.all(msgSql, [convId], (mErr, messages) => {
      if (mErr) return res.status(500).json({ error: 'Lỗi tải lịch sử tin nhắn' });
      res.json({ conversation: conv, messages });
    });
  });
});

// Send new message
app.post('/api/chat/conversations/:id/messages', authenticateToken, (req, res) => {
  const convId = req.params.id;
  const userId = req.user.id;
  const { text } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
  }

  db.get('SELECT * FROM conversations WHERE id = ?', [convId], (err, conv) => {
    if (err || !conv) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    if (conv.buyer_id !== userId && conv.seller_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền tham gia hội thoại này' });
    }

    const insertSql = `INSERT INTO messages (conversation_id, sender_id, text) VALUES (?, ?, ?)`;
    db.run(insertSql, [convId, userId, text.trim()], function (iErr) {
      if (iErr) return res.status(500).json({ error: 'Lỗi gửi tin nhắn' });

      // Update conversation updated_at
      db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [convId]);

      const msgId = this.lastID;
      res.status(201).json({
        id: msgId,
        conversation_id: Number(convId),
        sender_id: userId,
        text: text.trim(),
        created_at: new Date().toISOString()
      });
    });
  });
});

// Serve frontend SPA fallback for index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Server Real Estate Backend running on port ${PORT}`);
  console.log(`Access Web Platform: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
