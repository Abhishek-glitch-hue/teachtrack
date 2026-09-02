import "dotenv/config";
import { prisma } from "./src/lib/prisma.ts";

async function main() {
  const teacherId = "cmtjmq05v0000acv7tadvvu2e";
  const now = new Date();

  const duties = [
    { title: "Lecture Preparation", description: "Prepare lecture materials", dueAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) },
    { title: "Exam Invigilation", description: "Supervise exam", dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) },
    { title: "Student Mentoring Session", description: "One-on-one mentoring", dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    { title: "Staff Committee Meeting", description: "Attend committee", dueAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000) },
    { title: "Class Teaching", description: "Teach morning class", dueAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) },
  ];

  for (const duty of duties) {
    await prisma.duty.create({
      data: {
        assignedToId: teacherId,
        ...duty,
        status: "PENDING",
      },
    });
    console.log("Created:", duty.title);
  }

  console.log("All duties created!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
