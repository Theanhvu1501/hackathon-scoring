import { PrismaClient } from '@prisma/client';
import { generateAccessCode } from '../src/lib/access-code';
const prisma = new PrismaClient();

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
const JUDGES = [
  { name:'Nguyễn Văn Minh', isHead:true },
  { name:'Trần Thị Lan', isHead:false },
  { name:'Lê Hoàng Sơn', isHead:false },
  { name:'Phạm Thu Hà', isHead:false },
  { name:'Đỗ Minh Phúc', isHead:false },
];

async function main() {
  await prisma.score.deleteMany();
  await prisma.member.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.upsert({ where:{ id:1 }, update:{ revealState:'drafting' }, create:{ id:1, revealState:'drafting' } });

  const admin = await prisma.user.create({ data:{ name:'Ban tổ chức', role:'admin', accessCode: generateAccessCode() } });
  const judges = [];
  for (const j of JUDGES) judges.push(await prisma.user.create({ data:{ name:j.name, role:'judge', isHead:j.isHead, accessCode: generateAccessCode() } }));

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

  // sample scores: each judge scores each team ~ target totals; head varies to create reshuffle.
  // target provisional totals (avg of 4 non-head) and head total per team code:
  const target: Record<string, { base:number; head:number }> = {
    EV:{ base:46.0, head:50 }, CV:{ base:47.5, head:41 }, RM:{ base:44.0, head:49 }, AP:{ base:45.5, head:43 },
    TX:{ base:41.0, head:48 }, C9:{ base:43.5, head:37 }, VL:{ base:40.0, head:38 }, SD:{ base:42.0, head:33 },
  };
  for (const team of teams) {
    const tg = target[team.code];
    for (const judge of judges) {
      const total = judge.isHead ? tg.head : tg.base;
      // split total across 5 criteria (each max 10)
      const per = total / criteria.length;
      for (const c of criteria) {
        await prisma.score.create({ data:{ judgeId:judge.id, teamId:team.id, criterionId:c.id, value: Math.min(10, Math.round(per*10)/10), submitted:true } });
      }
    }
  }

  console.log('Seed done.');
  console.log('ADMIN access code:', admin.accessCode);
  for (const j of judges) console.log(`JUDGE ${j.isHead?'(HEAD)':'      '} ${j.name}: ${(await prisma.user.findUnique({where:{id:j.id}}))!.accessCode}`);
}
main().catch((e)=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
