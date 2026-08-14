# 🏢 BatDongSan PRO - Nền Tảng Quản Lý Bất Động Sản Full-Stack

Hệ thống ứng dụng Web Quản lý & Giao dịch Bất Động Sản toàn diện được xây dựng với **Node.js, Express.js, SQLite3** và **Giao diện Web tương tác hiện đại**.

![Platform Banner](https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80)

---

## 🌟 Tính Năng Nổi Bật

1. **Quản Lý Tài Khoản (Authentication & Profile)**
   - Đăng ký, Đăng nhập bảo mật JWT token, mã hóa mật khẩu `bcryptjs`.
   - Cập nhật thông tin cá nhân (Tên, Số điện thoại, Link Avatar, Mật khẩu).
   - Chức năng Quên mật khẩu.

2. **Quản Lý Tin Đăng Bất Động Sản**
   - Phân loại 5 nhóm bất động sản: *Nhà ở, Căn hộ, Đất nền, Biệt thự, Mặt bằng kinh doanh*.
   - Đăng tin mới, Chỉnh sửa bài đăng, Xóa tin bài.
   - Quản lý trạng thái duyệt bài (`Chờ duyệt`, `Đã duyệt`, `Bị từ chối`).

3. **Bộ Lọc & Tìm Kiếm Thông Minh (Search & Filters)**
   - Tìm kiếm từ khóa theo Tên bài đăng, Địa chỉ, Tên dự án.
   - Bộ lọc đa tiêu chí: *Địa điểm (Đà Nẵng, Hà Nội, TP.HCM), Mức giá (1-3 tỷ, 3-5 tỷ...), Diện tích (50-100m²...), Loại hình BDS*.
   - Thẻ gợi ý tìm nhanh 1-click.

4. **Trang Chi Tiết Bất Động Sản & Bản Đồ Vị Trí**
   - Album hình ảnh carousel tương tác.
   - Thông tin giá bán (tự động quy đổi tỷ/triệu VNĐ), giá/m², diện tích, mô tả chi tiết.
   - Thẻ liên hệ người bán: Nút **Gọi ngay** (`tel:`) và **Chat với người bán**.
   - Bản đồ vị trí vệ tinh **Leaflet.js** tương tác trực tiếp.

5. **Chat Trực Tiếp Người Mua & Người Bán (Real-time Buyer-Seller Chat)** 💬
   - Nút **Chat với người bán** ngay trên chi tiết bài đăng.
   - Hộp thư Messenger đa luồng (danh sách cuộc hội thoại, tin nhắn gần nhất, giờ gửi).
   - Tự động hiển thị Badge tin nhắn chưa đọc trên Navbar.
   - Auto-polling đồng bộ tin nhắn mới realtime.

6. **Trang Quản Trị Hệ Thống (Admin Dashboard)** 🛡️
   - Đăng nhập dành riêng cho Quản trị viên (chuyển thẳng vào Admin Panel).
   - Thống kê tổng số người dùng, tổng bài đăng, bài chờ duyệt, bài đã duyệt.
   - Duyệt tin bài (`Approved`) hoặc Từ chối (`Rejected`) với 1 click.
   - Quản lý danh sách tài khoản thành viên hệ thống.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Backend**: Node.js, Express.js REST API
- **Database**: SQLite3 (với `database.sqlite` & tự động khởi tạo Seed Data)
- **Auth**: JSON Web Token (JWT) & bcryptjs
- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism, Animations, Responsive Grid), JavaScript ES6+
- **Maps**: Leaflet.js / OpenStreetMap API
- **Icons**: FontAwesome 6

---

## 🔑 Tài Khoản Dùng Thử (Demo Accounts)

| Vai Trò | Email | Mật Khẩu |
| :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@batdongsan.vn` | `admin123` |
| **Thành viên (User)** | `nguyenvana@gmail.com` | `user123` |

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Clone Dự Án
```bash
git clone https://github.com/TuanTKey/Batdongsan.git
cd Batdongsan
```

### 2. Cài Đặt Thư Viện (Dependencies)
```bash
npm install
```

### 3. Khởi Chạy Server
```bash
npm start
```

Mở trình duyệt và truy cập: **[http://localhost:5000](http://localhost:5000)**
