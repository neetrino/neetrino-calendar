import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  console.log("[SEED] Starting database seed...");

  // Clear existing data
  console.log("[SEED] Clearing existing data...");
  await prisma.userPermission.deleteMany();
  await prisma.calendarItemParticipant.deleteMany();
  await prisma.scheduleEntry.deleteMany();
  await prisma.calendarItem.deleteMany();
  await prisma.user.deleteMany();

  // Hash passwords
  console.log("[SEED] Hashing passwords...");
  const defaultPassword = "Password123!"; // Default password for all demo users
  const adminPasswordHash = await hashPassword(defaultPassword);
  const userPasswordHash = await hashPassword(defaultPassword);

  // Create users
  console.log("[SEED] Creating users...");
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@example.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Alice Johnson",
        email: "alice@example.com",
        passwordHash: userPasswordHash,
        role: "USER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Bob Smith",
        email: "bob@example.com",
        passwordHash: userPasswordHash,
        role: "USER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Carol Williams",
        email: "carol@example.com",
        passwordHash: userPasswordHash,
        role: "USER",
      },
    }),
    prisma.user.create({
      data: {
        name: "David Brown",
        email: "david@example.com",
        passwordHash: userPasswordHash,
        role: "USER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Emma Davis",
        email: "emma@example.com",
        passwordHash: userPasswordHash,
        role: "USER",
      },
    }),
  ]);

  console.log(`[SEED] Created ${users.length + 1} users`);
  console.log(`[SEED] Default password for all users: ${defaultPassword}`);

  console.log(`[SEED] Created ${users.length + 1} users`);

  // Create default permissions for users
  console.log("[SEED] Creating user permissions...");
  
  // Admin has full access to everything (Edit for My and Everyone)
  const modules = ["meetings", "deadlines", "schedule"];
  for (const module of modules) {
    await prisma.userPermission.create({
      data: {
        userId: admin.id,
        module: module,
        myLevel: "EDIT",
        allLevel: "EDIT",
      },
    });
  }

  // Regular users have different access levels
  // Alice: Can edit own meetings, view all meetings; can view own deadlines
  await prisma.userPermission.createMany({
    data: [
      { userId: users[0].id, module: "meetings", myLevel: "EDIT", allLevel: "VIEW" },
      { userId: users[0].id, module: "deadlines", myLevel: "VIEW", allLevel: "NONE" },
      { userId: users[0].id, module: "schedule", myLevel: "VIEW", allLevel: "VIEW" },
    ],
  });

  // Bob: Can view meetings only; can edit own deadlines
  await prisma.userPermission.createMany({
    data: [
      { userId: users[1].id, module: "meetings", myLevel: "VIEW", allLevel: "VIEW" },
      { userId: users[1].id, module: "deadlines", myLevel: "EDIT", allLevel: "VIEW" },
      { userId: users[1].id, module: "schedule", myLevel: "VIEW", allLevel: "NONE" },
    ],
  });

  // Carol: Full access to schedule, view only for others
  await prisma.userPermission.createMany({
    data: [
      { userId: users[2].id, module: "meetings", myLevel: "VIEW", allLevel: "NONE" },
      { userId: users[2].id, module: "deadlines", myLevel: "VIEW", allLevel: "NONE" },
      { userId: users[2].id, module: "schedule", myLevel: "EDIT", allLevel: "EDIT" },
    ],
  });

  // David: No access to anything (all NONE)
  await prisma.userPermission.createMany({
    data: [
      { userId: users[3].id, module: "meetings", myLevel: "NONE", allLevel: "NONE" },
      { userId: users[3].id, module: "deadlines", myLevel: "NONE", allLevel: "NONE" },
      { userId: users[3].id, module: "schedule", myLevel: "NONE", allLevel: "NONE" },
    ],
  });

  // Emma: View everything, edit nothing
  await prisma.userPermission.createMany({
    data: [
      { userId: users[4].id, module: "meetings", myLevel: "VIEW", allLevel: "VIEW" },
      { userId: users[4].id, module: "deadlines", myLevel: "VIEW", allLevel: "VIEW" },
      { userId: users[4].id, module: "schedule", myLevel: "VIEW", allLevel: "VIEW" },
    ],
  });

  console.log("[SEED] Created user permissions");

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create schedule entries for today
  console.log("[SEED] Creating schedule entries for today...");
  const scheduleData = [
    { user: users[0], startTime: 9 * 60, endTime: 18 * 60 }, // 09:00-18:00
    { user: users[1], startTime: 10 * 60, endTime: 19 * 60 }, // 10:00-19:00
    { user: users[2], startTime: 10 * 60, endTime: 18 * 60 }, // 10:00-18:00
    { user: users[3], startTime: 16 * 60, endTime: 20 * 60 }, // 16:00-20:00
  ];

  for (const entry of scheduleData) {
    await prisma.scheduleEntry.create({
      data: {
        date: today,
        startTime: entry.startTime,
        endTime: entry.endTime,
        userId: entry.user.id,
        createdById: admin.id,
      },
    });
  }

  // Create schedule entries for tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowScheduleData = [
    { user: users[0], startTime: 8 * 60, endTime: 17 * 60 }, // 08:00-17:00
    { user: users[1], startTime: 9 * 60, endTime: 18 * 60 }, // 09:00-18:00
    { user: users[2], startTime: 11 * 60, endTime: 19 * 60 }, // 11:00-19:00
    { user: users[4], startTime: 14 * 60, endTime: 22 * 60 }, // 14:00-22:00
  ];

  for (const entry of tomorrowScheduleData) {
    await prisma.scheduleEntry.create({
      data: {
        date: tomorrow,
        startTime: entry.startTime,
        endTime: entry.endTime,
        userId: entry.user.id,
        createdById: admin.id,
      },
    });
  }

  console.log("[SEED] Created schedule entries");

  // Create calendar items (meetings and deadlines)
  console.log("[SEED] Creating calendar items...");

  // Meeting today
  const meetingToday = await prisma.calendarItem.create({
    data: {
      type: "MEETING",
      title: "Team Standup",
      description: "Daily team standup meeting",
      startAt: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10:00
      endAt: new Date(today.getTime() + 10.5 * 60 * 60 * 1000), // 10:30
      status: "CONFIRMED",
      location: "Conference Room A",
      createdById: admin.id,
    },
  });

  // Add participants to meeting
  await prisma.calendarItemParticipant.createMany({
    data: [
      { itemId: meetingToday.id, userId: admin.id, role: "OWNER", rsvp: "YES" },
      { itemId: meetingToday.id, userId: users[0].id, role: "PARTICIPANT", rsvp: "YES" },
      { itemId: meetingToday.id, userId: users[1].id, role: "PARTICIPANT", rsvp: "MAYBE" },
    ],
  });

  // Deadline this week
  const deadlineDate = new Date(today);
  deadlineDate.setDate(deadlineDate.getDate() + 3);
  deadlineDate.setHours(18, 0, 0, 0);

  const deadline = await prisma.calendarItem.create({
    data: {
      type: "DEADLINE",
      title: "Project Proposal Due",
      description: "Submit the final project proposal document",
      startAt: deadlineDate,
      allDay: false,
      status: "CONFIRMED",
      createdById: admin.id,
    },
  });

  await prisma.calendarItemParticipant.create({
    data: {
      itemId: deadline.id,
      userId: users[2].id,
      role: "RESPONSIBLE",
    },
  });

  // Meeting next week
  const nextWeekMeeting = new Date(today);
  nextWeekMeeting.setDate(nextWeekMeeting.getDate() + 7);
  nextWeekMeeting.setHours(14, 0, 0, 0);

  const meetingNextWeek = await prisma.calendarItem.create({
    data: {
      type: "MEETING",
      title: "Client Review",
      description: "Quarterly review meeting with client",
      startAt: nextWeekMeeting,
      endAt: new Date(nextWeekMeeting.getTime() + 2 * 60 * 60 * 1000), // 2 hours
      status: "DRAFT",
      location: "Online - Zoom",
      createdById: admin.id,
    },
  });

  await prisma.calendarItemParticipant.createMany({
    data: [
      { itemId: meetingNextWeek.id, userId: admin.id, role: "OWNER" },
      { itemId: meetingNextWeek.id, userId: users[0].id, role: "PARTICIPANT" },
      { itemId: meetingNextWeek.id, userId: users[3].id, role: "PARTICIPANT" },
    ],
  });

  // All-day event
  const allDayEvent = new Date(today);
  allDayEvent.setDate(allDayEvent.getDate() + 5);

  await prisma.calendarItem.create({
    data: {
      type: "DEADLINE",
      title: "Company Holiday",
      description: "Office closed",
      startAt: allDayEvent,
      allDay: true,
      status: "CONFIRMED",
      createdById: admin.id,
    },
  });

  console.log("[SEED] Created calendar items");
  console.log("[SEED] ✅ Database seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("[SEED] ❌ Error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
