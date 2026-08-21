import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// DESTRUCTIVE: this script wipes scores/teams/users before recreating demo data.
// It must never run automatically on container start — see docker-compose.yml.
// Running it against a database that already has users aborts unless SEED_FORCE=1.

// Human-readable access codes. The defaults are public in this repo, so every
// deployment must override them via env (see .env.example).
const SUPER_CODE = process.env.SUPERADMIN_ACCESS_CODE || 'SUPER-2026';
const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE || 'ADMIN-2026';
// HEAD_ACCESS_CODE là tên có từ thời còn Trưởng BGK. Vai trò đó đã bỏ, nhưng
// biến vẫn được đọc để những file .env sẵn có không hỏng — giờ nó chỉ là mã của
// giám khảo đầu tiên.
const JUDGE_CODES = [
  process.env.HEAD_ACCESS_CODE || 'BGK1-2026',
  ...(process.env.JUDGE_ACCESS_CODES || 'BGK2-2026,BGK3-2026,BGK4-2026,BGK5-2026').split(','),
].map((c) => c.trim()).filter(Boolean);

// Demo scores are useful locally but are noise on a real deployment.
const WITH_SCORES = process.env.SEED_SCORES
  ? process.env.SEED_SCORES !== '0'
  : process.env.NODE_ENV !== 'production';

const TEAMS = [
  { code:'EV', name:'EV Nexus',     tag:'Quản lý pin & định tuyến sạc' },
  { code:'CV', name:'CarVision AI', tag:'Thị giác máy tính hỗ trợ lái' },
  { code:'RM', name:'RoadMind',     tag:'Định tuyến giao thông thông minh' },
  { code:'AP', name:'AutoPilot X',  tag:'Điều khiển tự hành cấp độ 2' },
  { code:'TX', name:'TorqueX',      tag:'Tối ưu hộp số & tiêu hao' },
  { code:'C9', name:'Chassis 9',    tag:'Cảm biến khung gầm IoT' },
  { code:'VL', name:'Vroom Labs',   tag:'Trợ lý giọng nói trên xe' },
  { code:'SD', name:'Smart Drive',  tag:'Cảnh báo va chạm chủ động' },
];
const CRITERIA = [
  { name:'Chất lượng code', description:'Cấu trúc rõ ràng, sạch, dễ bảo trì', maxScore:10, order:0 },
  { name:'Chạy không lỗi', description:'Sản phẩm chạy ổn định, không giới hạn', maxScore:10, order:1 },
  { name:'Tính sáng tạo', description:'Ý tưởng độc đáo, khác biệt', maxScore:10, order:2 },
  { name:'Tính ứng dụng', description:'Khả năng áp dụng thực tế ngành ô tô', maxScore:10, order:3 },
  { name:'Thuyết trình', description:'Trình bày mạch lạc, thuyết phục', maxScore:10, order:4 },
];
const JUDGE_NAMES = ['Nguyễn Văn Minh', 'Trần Thị Lan', 'Lê Hoàng Sơn', 'Phạm Thu Hà', 'Đỗ Minh Phúc'];
const JUDGES = JUDGE_NAMES
  .map((name, i) => ({ name, code: JUDGE_CODES[i] }))
  .filter((j) => j.code);

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0 && process.env.SEED_FORCE !== '1') {
    const scores = await prisma.score.count();
    console.error(
      `\n  DỪNG: database đã có ${existing} user và ${scores} điểm.\n` +
      '  Seed sẽ XOÁ SẠCH toàn bộ team / thành viên / tiêu chí / BGK / điểm.\n' +
      '  Nếu thật sự muốn reset (nhớ backup trước), chạy lại với SEED_FORCE=1.\n',
    );
    process.exit(1);
  }

  await prisma.score.deleteMany();
  await prisma.member.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  // Board về màn chờ — đội vừa bị deleteMany ở trên nên revealedAt tự sạch.
  await prisma.settings.upsert({ where:{ id:1 }, update:{}, create:{ id:1 } });

  const superadmin = await prisma.user.create({ data:{ name:'Super Admin', role:'superadmin', accessCode: SUPER_CODE } });
  const admin = await prisma.user.create({ data:{ name:'Ban tổ chức', role:'admin', accessCode: ADMIN_CODE } });
  const judges = [];
  for (const j of JUDGES) judges.push(await prisma.user.create({ data:{ name:j.name, role:'judge', accessCode: j.code } }));

  const criteria = [];
  for (const c of CRITERIA) criteria.push(await prisma.criterion.create({ data:c }));

  const teams = [];
  for (const t of TEAMS) {
    const team = await prisma.team.create({ data:{ ...t, members:{ create:[
      { name:'Nguyễn An', teamRole:'Trưởng nhóm · Backend', org:'ĐH Bách Khoa HN', intro:'Dẫn dắt kiến trúc backend.' },
      { name:'Trần Bình', teamRole:'AI Engineer', org:'FPT Software', intro:'Phụ trách mô hình.' },
      { name:'Lê Chi', teamRole:'Frontend · Design', org:'ĐH FPT', intro:'Thiết kế trải nghiệm.' },
    ] } } });
    teams.push(team);
  }

  // Điểm mẫu: mỗi đội có một tổng mục tiêu cho MỘT phiếu, rồi từng giám khảo
  // lệch đi một chút. Lệch là cố ý — mọi giám khảo chấm y hệt nhau thì màn công
  // bố không kiểm tra được gì, và điểm lẻ .3/.4 sẽ không bao giờ xuất hiện.
  const TARGET: Record<string, number> = {
    EV:46.0, CV:47.5, RM:44.0, AP:45.5, TX:41.0, C9:43.5, VL:40.0, SD:42.0,
  };
  const JUDGE_OFFSET = [2.5, -1.5, 0.5, 3.0, -2.0];
  for (const team of WITH_SCORES ? teams : []) {
    for (const [ji, judge] of judges.entries()) {
      const total = TARGET[team.code] + JUDGE_OFFSET[ji % JUDGE_OFFSET.length];
      // split total across 5 criteria (each max 10)
      const per = total / criteria.length;
      for (const c of criteria) {
        await prisma.score.create({ data:{ judgeId:judge.id, teamId:team.id, criterionId:c.id, value: Math.min(10, Math.round(per*10)/10), submitted:true } });
      }
    }
  }

  console.log(`Seed done${WITH_SCORES ? ' (kèm điểm mẫu)' : ' (không có điểm mẫu)'}.`);
  console.log('SUPERADMIN access code:', superadmin.accessCode);
  console.log('ADMIN access code:', admin.accessCode);
  for (const j of judges) console.log(`JUDGE ${j.name}: ${(await prisma.user.findUnique({where:{id:j.id}}))!.accessCode}`);
}
main().catch((e)=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
