import { PrismaClient, Role, UserStatus, RestrictedQueue, Priority } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting CampusVoice database seed...');

  // 1. Categories
  const categoriesData = [
    { name: 'Academic', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Infrastructure', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Hostel', severityWeight: 15, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Canteen', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Transport', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Harassment', severityWeight: 40, routesToQueue: RestrictedQueue.ICC, isSafety: true },
    { name: 'Ragging', severityWeight: 45, routesToQueue: RestrictedQueue.ANTI_RAGGING, isSafety: true },
    { name: 'Discrimination', severityWeight: 35, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Cyber-bullying', severityWeight: 25, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Corruption/Misconduct', severityWeight: 30, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Safety/Security', severityWeight: 40, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Mental-wellbeing', severityWeight: 25, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Other', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: cat,
      create: cat,
    });
  }
  console.log(`[Seed] Seeded ${categoriesData.length} categories.`);

  // 2. Campus Locations
  const locationsData = [
    { name: 'Main Administrative Block', lat: 19.0760, lng: 72.8777 },
    { name: 'Central University Library', lat: 19.0765, lng: 72.8782 },
    { name: 'Science & Engineering Complex', lat: 19.0772, lng: 72.8790 },
    { name: 'North Campus Boys Hostel', lat: 19.0780, lng: 72.8765 },
    { name: 'South Campus Girls Hostel', lat: 19.0750, lng: 72.8755 },
    { name: 'University Cafeteria & Food Court', lat: 19.0762, lng: 72.8770 },
    { name: 'Indoor Sports & Gym Pavilion', lat: 19.0785, lng: 72.8780 },
    { name: 'Main Entrance & Gate 1', lat: 19.0745, lng: 72.8775 },
  ];

  for (const loc of locationsData) {
    await prisma.location.upsert({
      where: { name: loc.name },
      update: loc,
      create: loc,
    });
  }
  console.log(`[Seed] Seeded ${locationsData.length} locations.`);

  // 3. Police Stations (for SOS Haversine dispatch)
  const policeStationsData = [
    {
      name: 'Campus Central Police Station',
      email: 'ps.central@police.gov.in',
      phone: '+912226500100',
      lat: 19.0770,
      lng: 72.8785,
      active: true,
    },
    {
      name: 'North District Police Precinct',
      email: 'ps.north@police.gov.in',
      phone: '+912226500200',
      lat: 19.0820,
      lng: 72.8760,
      active: true,
    },
    {
      name: 'University Metro Police Post',
      email: 'ps.metro@police.gov.in',
      phone: '+912226500300',
      lat: 19.0730,
      lng: 72.8810,
      active: true,
    },
  ];

  for (const ps of policeStationsData) {
    const existing = await prisma.policeStation.findFirst({ where: { name: ps.name } });
    if (!existing) {
      await prisma.policeStation.create({ data: ps });
    }
  }
  console.log(`[Seed] Seeded ${policeStationsData.length} police stations.`);

  // 4. SLA Policies
  const slaData = [
    { priority: Priority.CRITICAL, firstResponseHours: 2, resolutionHours: 24 },
    { priority: Priority.HIGH, firstResponseHours: 24, resolutionHours: 72 },
    { priority: Priority.MEDIUM, firstResponseHours: 72, resolutionHours: 240 },
    { priority: Priority.LOW, firstResponseHours: 168, resolutionHours: 720 },
  ];

  for (const sla of slaData) {
    await prisma.slaPolicy.upsert({
      where: { priority: sla.priority },
      update: sla,
      create: sla,
    });
  }
  console.log(`[Seed] Seeded ${slaData.length} SLA policies.`);

  // 5. College Roster (Demo Students and Faculty)
  const rosterData = [
    { enrollmentNo: 'EN2026001', fullName: 'Aarav Sharma', collegeEmail: 'aarav.sharma@college.edu', role: Role.STUDENT, department: 'Computer Science' },
    { enrollmentNo: 'EN2026002', fullName: 'Diya Patel', collegeEmail: 'diya.patel@college.edu', role: Role.STUDENT, department: 'Mechanical Engineering' },
    { enrollmentNo: 'EN2026003', fullName: 'Rohan Verma', collegeEmail: 'rohan.verma@college.edu', role: Role.STUDENT, department: 'Civil Engineering' },
    { enrollmentNo: 'FAC202601', fullName: 'Dr. Sunita Kulkarni', collegeEmail: 'sunita.kulkarni@college.edu', role: Role.TEACHER, department: 'Physics' },
    { enrollmentNo: 'FAC202602', fullName: 'Prof. Rajesh Nair', collegeEmail: 'rajesh.nair@college.edu', role: Role.TEACHER, department: 'Electrical Engineering' },
  ];

  for (const r of rosterData) {
    await prisma.collegeRoster.upsert({
      where: { enrollmentNo: r.enrollmentNo },
      update: r,
      create: r,
    });
  }
  console.log(`[Seed] Seeded ${rosterData.length} roster identities.`);

  // 6. Default Admin & Staff Accounts
  const defaultPasswordHash = await argon2.hash('Password@1234');

  const staffUsers = [
    {
      username: 'superadmin',
      collegeEmail: 'superadmin@campus.edu',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      department: 'Central Administration',
    },
    {
      username: 'admin_case1',
      collegeEmail: 'admin1@campus.edu',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      department: 'Student Affairs',
    },
    {
      username: 'admin_case2',
      collegeEmail: 'admin2@campus.edu',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      department: 'Disciplinary Committee',
    },
    {
      username: 'security_officer',
      collegeEmail: 'security@campus.edu',
      role: Role.SECURITY,
      status: UserStatus.ACTIVE,
      department: 'Campus Security',
      phone: '+919876543210',
    },
  ];

  for (const u of staffUsers) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        role: u.role,
        status: u.status,
      },
      create: {
        username: u.username,
        passwordHash: defaultPasswordHash,
        collegeEmail: u.collegeEmail,
        role: u.role,
        status: u.status,
        department: u.department,
        phone: u.phone,
      },
    });
  }
  console.log(`[Seed] Seeded ${staffUsers.length} administrative & security users.`);

  // 7. Sample Campus Rules
  const sampleRule = {
    title: 'University Anti-Ragging Code of Conduct',
    category: 'Disciplinary & Safety',
    bodyMd: `# Anti-Ragging Regulations

## 1. Zero Tolerance Mandate
The University maintains an absolute zero-tolerance policy against any form of ragging, bullying, or harassment within the campus premises, hostels, transport vehicles, or during sponsored events.

## 2. Prohibited Behaviors
- Physical contact, intimidation, or coercion of any junior student.
- Forcing attendance at unofficial gatherings or hostel rooms.
- Psychological abuse, offensive language, or degrading rituals.

## 3. Disciplinary Repercussions
Any student found guilty of engaging in or abetting ragging will face immediate suspension, hostel expulsion, and reporting to legal law enforcement under statutory state regulations.
`,
    version: 1,
    updatedBy: 'superadmin',
  };

  const existingRule = await prisma.ruleDocument.findFirst({ where: { title: sampleRule.title } });
  if (!existingRule) {
    await prisma.ruleDocument.create({ data: sampleRule });
  }
  console.log('[Seed] Seeded sample campus rules.');

  console.log('[Seed] Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
