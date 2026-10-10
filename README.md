# ConScan - Confluence Attachment Scanner (Chrome Extension)

Plugin Chrome mạnh mẽ giúp bạn **tự động quét và liệt kê toàn bộ các tệp đính kèm (attachments)** trong tất cả các không gian (Spaces) Confluence mà bạn có quyền truy cập, phân loại chi tiết theo **người upload**, **thời điểm upload**, **trang (page)**, **không gian (space)**, dung lượng và định dạng tệp.

---

## 🌟 Tính Năng Nổi Bật

- ⚡ **Tự động nhận diện session trình duyệt:** Không cần nhập mật khẩu hay cấu hình API Token phức tạp. Plugin tự động tận dụng phiên đăng nhập Confluence đang mở trên trình duyệt với toàn bộ quyền truy cập của bạn.
- 🏢 **Hỗ trợ mọi loại Confluence:** Hoạt động tốt với cả **Confluence Cloud** (`*.atlassian.net/wiki`) lẫn **Confluence Server / Data Center** nội bộ của doanh nghiệp.
- 🎯 **Lựa chọn phạm vi linh hoạt:**
  - Quét toàn bộ các Spaces bạn có quyền đọc.
  - Hoặc chọn các Spaces cụ thể theo danh sách kèm bộ lọc tìm kiếm.
- 🔍 **Bộ lọc & Phân loại đa chiều:**
  - **Theo Người Upload:** Tìm kiếm và lọc theo tên hoặc username tác giả.
  - **Theo Thời Điểm Upload:** Lọc theo khoảng ngày (Từ ngày - Đến ngày), sắp xếp mới nhất / cũ nhất.
  - **Theo Space & Page:** Nhấp vào liên kết để mở trực tiếp trang Confluence chứa tệp.
  - **Theo Định Dạng:** Lọc nhanh theo nhóm tệp (Hình ảnh, PDF, Word, Excel, Slide, File nén, Code/Dữ liệu).
  - **Tìm kiếm tức thì:** Tìm nhanh theo tên file, tên trang, người upload.
- 📊 **Thống kê tổng quan:** Thẻ số liệu hiển thị tổng số attachments, tổng dung lượng lưu trữ (MB/GB), số người tải lên, số spaces đã quét.
- 📦 **Tải toàn bộ Space hoạt động Offline theo đúng cây thư mục:**
  - Tải tất cả các trang của một Space được chọn xuống máy tính.
  - Tự động tổ chức cấu trúc thư mục con lồng nhau chính xác theo quan hệ Trang Cha - Trang Con trên Confluence.
  - Tải kèm toàn bộ **hình ảnh minh họa và tệp đính kèm**, tự động chuyển đổi link để xem offline 100% không cần mạng.
  - Tạo sẵn file **`index.html` (Interactive Offline Viewer)** có thanh menu cây thư mục, tìm kiếm trang và giao diện đọc bài viết tiện lợi.
- 💾 **Xuất dữ liệu chuyên nghiệp:**
  - **Xuất CSV:** Chuẩn mã hóa **UTF-8 với BOM** giúp mở bằng Microsoft Excel hiển thị tiếng Việt hoàn hảo, không bị lỗi font.
  - **Xuất JSON:** Phục vụ tích hợp dữ liệu hoặc viết script xử lý tiếp theo.
  - Nút tải xuống trực tiếp và sao chép đường link tệp đính kèm nhanh chóng.

---

## 🚀 Hướng Dẫn Cài Đặt Lên Google Chrome (30 Giây)

Vì đây là extension dạng mã nguồn (Unpacked Extension), bạn có thể cài đặt trực tiếp vào Chrome theo các bước sau:

1. Mở trình duyệt Google Chrome (hoặc Microsoft Edge, Brave, Cốc Cốc, Chrome-based browser).
2. Trên thanh địa chỉ, nhập:
   ```text
   chrome://extensions
   ```
   và nhấn **Enter**.
3. Ở góc trên cùng bên phải màn hình, bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)**.
4. Bấm vào nút **"Tải tiện ích đã giải nén" (Load unpacked)** ở góc trên bên trái.
5. Chọn thư mục dự án `ConScan`:
   ```text
   /Users/anhdo/Documents/GitHub/ConScan
   ```
6. Tiện ích **ConScan** sẽ xuất hiện trên thanh công cụ của Chrome! (Bạn nên bấm vào biểu tượng Mảnh ghép trên thanh công cụ và ghim 📌 ConScan ra ngoài để thao tác thuận tiện).

---

## 📖 Hướng Dẫn Sử Dụng

### Bước 1: Mở Confluence
- Mở một tab trình duyệt và truy cập vào trang Confluence của bạn (đảm bảo bạn đã đăng nhập).

### Bước 2: Khởi động ConScan
- Bấm vào biểu tượng **ConScan** trên thanh tiện ích Chrome.
- Cửa sổ nhỏ (Popup) sẽ hiển thị thông báo đã nhận diện tab Confluence.
- Bấm nút **"Mở ConScan Dashboard"** để mở giao diện quản trị toàn màn hình.

### Bước 3: Cấu hình và Bắt đầu quét
- **Phạm vi quét:**
  - Mặc định chọn *"Tất cả Spaces có quyền"*.
  - Nếu chỉ muốn quét một số dự án, chọn *"Chọn Spaces cụ thể"* rồi tích chọn các space cần tìm.
- **Thời gian (tùy chọn):** Bạn có thể chọn khoảng thời gian upload mong muốn.
- Nhấn nút **"Bắt đầu Quét"** (nút màu xanh).

### Bước 4: Xem kết quả & Tương tác
- Tiến trình quét sẽ cập nhật số lượng tệp theo thời gian thực lên bảng và các thẻ thống kê.
- Bạn có thể:
  - Bấm vào tiêu đề các cột để **sắp xếp** (Thời gian mới nhất, Dung lượng lớn nhất, Tên tệp, v.v.).
  - Bấm vào các chip phân loại (**PDF**, **Excel**, **Hình ảnh**...) để lọc nhanh loại file.
  - Bấm **"Tải"** để tải file về máy, hoặc bấm **"Trang"** để mở đúng bài viết chứa file đó trên Confluence.
  - Bấm **"Xuất CSV"** hoặc **"Xuất JSON"** ở góc trên bên phải để lưu báo cáo về máy tính.

---

## 📦 Hướng Dẫn Tải Một Space Về Hoạt Động Offline

Nếu bạn cần lưu trữ toàn bộ nội dung của một Space để xem khi không có mạng (offline) hoặc chuyển giao dữ liệu:

1. Bấm vào nút **"📦 Tải Space Offline"** ở góc trên thanh công cụ của Dashboard (hoặc bấm nút này từ Popup tiện ích).
2. Chọn **Space** bạn muốn tải từ danh sách.
3. Chọn các tùy chọn:
   - ☑️ **Tải kèm hình ảnh & tệp đính kèm**: Để các ảnh minh họa, tài liệu trong bài viết được lưu trữ cục bộ.
   - ☑️ **Tích hợp Cổng Duyệt Tương Tác**: Tự động tạo trang `index.html` tổng hợp.
4. Bấm **"Bắt đầu Tải Xuống"**.
5. Sau khi hoàn tất, trình duyệt sẽ tự động tải về file `[Tên_Space]_Offline_Pages.zip`.
6. **Cách xem offline:**
   - Giải nén file ZIP.
   - Mở file `index.html` trong thư mục vừa giải nén: Bạn sẽ thấy giao diện đọc tài liệu với thanh điều hướng cây thư mục bên trái, tìm kiếm trang và nội dung đầy đủ.
   - Hoặc bạn có thể truy cập vào từng thư mục con theo đúng quan hệ Trang Cha - Trang Con để mở trực tiếp từng bài viết.

---

## 📁 Cấu Trúc Mã Nguồn

```
ConScan/
├── manifest.json              # Khai báo tiện ích theo chuẩn Manifest V3
├── CHROMEWEBSTORE.md          # Tài liệu mô tả chuẩn duyệt Chrome Web Store
├── README.md                  # Hướng dẫn chi tiết
├── icons/                     # Bộ biểu tượng ứng dụng (16, 32, 48, 128 px)
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── popup/                     # Cửa sổ popup nhanh khi click vào icon
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── dashboard/                 # Bảng điều khiển toàn màn hình với bộ lọc và bảng dữ liệu
│   ├── dashboard.html
│   ├── dashboard.css
│   └── dashboard.js
├── shared/                    # Các module dùng chung
│   ├── confluence-api.js      # Client tương tác API Confluence (CQL & Deep Crawl)
│   └── utils.js               # Định dạng dung lượng, thời gian, xuất file CSV/JSON
├── background/                # Service Worker chạy nền quản lý tab & sự kiện
│   └── service-worker.js
└── content/                   # Content Script tương tác cùng session trên tab Confluence
    └── content.js
```

---

## 🔒 Bảo Mật & Quyền Riêng Tư

- ConScan hoạt động **100% trên máy tính cá nhân của bạn** (Local Client-Side).
- Mọi dữ liệu quét và thông tin đăng nhập **không bao giờ** gửi ra bất kỳ máy chủ bên ngoài nào.
- Chỉ kết nối trực tiếp đến máy chủ Confluence của bạn thông qua phiên làm việc đã được xác thực của trình duyệt.
