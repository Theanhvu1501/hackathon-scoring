-- Migration này CỐ Ý chỉ có đúng một câu và đứng một mình.
-- Postgres không cho dùng một giá trị enum vừa được ADD VALUE ngay trong cùng
-- transaction đã thêm nó, nên gộp chung với một migration có
-- `INSERT ... role = 'superadmin'` sẽ lỗi lúc chạy.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'superadmin';
