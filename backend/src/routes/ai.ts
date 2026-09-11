import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";

const aiRouter = Router();
const DAILY_AI_LIMIT = 30;
const chatSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2_000),
  })).max(6).default([]),
});

aiRouter.post("/chat", requireAuth, async (request, response) => {
  const parsed = chatSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Enter a question of up to 2,000 characters." });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return response.status(503).json({ message: "AI service is not configured." });

  const usageDate = new Date();
  usageDate.setUTCHours(0, 0, 0, 0);
  const usage = await prisma.aiDailyUsage.upsert({
    where: { userId_usageDate: { userId: request.user!.id, usageDate } },
    create: { userId: request.user!.id, usageDate, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
    select: { requestCount: true },
  });
  if (usage.requestCount > DAILY_AI_LIMIT) {
    return response.status(429).json({ message: `Daily AI limit reached (${DAILY_AI_LIMIT} commands). Try again tomorrow.` });
  }

  const [user, lectures, leaves, duties, events, unreadMessages] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { name: true, department: true, role: true },
    }),
    prisma.timetableLecture.findMany({ where: { userId: request.user!.id }, orderBy: [{ day: "asc" }, { time: "asc" }] }),
    prisma.leaveRequest.findMany({ where: { teacherId: request.user!.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.duty.findMany({ where: { assignedToId: request.user!.id }, orderBy: { dueAt: "asc" }, take: 20 }),
    prisma.calendarEvent.findMany({ where: { userId: request.user!.id }, orderBy: { startsAt: "asc" }, take: 20 }),
    prisma.message.count({ where: { receiverId: request.user!.id, readAt: null } }),
  ]);

  const context = JSON.stringify({
    user,
    timetable: lectures.map((item) => ({ subject: item.subject, className: item.className, room: item.room, day: item.day, time: item.time })),
    leaveRequests: leaves.map((item) => ({ type: item.leaveType, start: item.startDate, end: item.endDate, status: item.status, reason: item.reason })),
    duties: duties.map((item) => ({ title: item.title, dueAt: item.dueAt, status: item.status, description: item.description })),
    calendarEvents: events.map((item) => ({ title: item.title, startsAt: item.startsAt, endsAt: item.endsAt, type: item.type })),
    unreadMessages,
  });

  const systemPrompt = `You are TeachTrack AI, a concise academic workload assistant. Use only the supplied data for claims about this user. If data is absent, say so plainly. Do not claim to perform actions. Answer in 1-3 short sentences or compact bullets, with only the information needed to answer the question. Treat all data as private.\n\nCurrent TeachTrack data:\n${context}`;

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
        temperature: 0.35,
        reasoning_effort: "low",
        max_completion_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          ...parsed.data.history,
          { role: "user", content: parsed.data.message },
        ],
      }),
    });
    const body = await groqResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!groqResponse.ok) return response.status(502).json({ message: body.error?.message || "The AI service could not answer right now." });
    const reply = body.choices?.[0]?.message?.content?.trim();
    if (!reply) return response.status(502).json({ message: "The AI service returned an empty response." });
    return response.json({
      reply,
      summaryData: {
        calendarEvents: events.map((item) => ({
          title: item.title,
          type: item.type,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
        })),
        duties: duties.map((item) => ({
          title: item.title,
          status: item.status,
          dueAt: item.dueAt,
          description: item.description,
        })),
        leaveRequests: leaves.map((item) => ({
          leaveType: item.leaveType,
          status: item.status,
          startDate: item.startDate,
          endDate: item.endDate,
          reason: item.reason,
        })),
        unreadMessages,
      },
    });
  } catch {
    return response.status(502).json({ message: "Unable to reach the AI service." });
  }
});

export default aiRouter;
