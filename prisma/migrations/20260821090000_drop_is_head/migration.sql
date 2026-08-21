-- Bỏ vai trò Trưởng BGK: mọi giám khảo ngang nhau.
-- Cột chỉ còn là nhãn hiển thị sau khi cơ chế giữ kín điểm bị gỡ, nên xoá hẳn
-- thay vì để lại một cột không ai đọc.
ALTER TABLE "User" DROP COLUMN "isHead";
