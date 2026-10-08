/**
 * Development seed: recreates the data shown in docs/RijSchool-Planner-mockups.pdf,
 * with lessons placed in the *current* ISO week so every screen is populated on first run.
 * Destructive (TRUNCATE) — refuses to run in production.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { localParts, startOfIsoWeek, zonedToUtc } from "../src/lib/domain/time";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PASSWORD = process.env.SEED_PASSWORD ?? "RijSchool2026!";
const now = new Date();
const wk = localParts(startOfIsoWeek(now));

/** Local wall-clock instant on weekday `dow` (0 = Monday) of the current week. */
function at(dow: number, hhmm: string, weekOffset = 0): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(wk.year, wk.month - 1, wk.day + dow + weekOffset * 7));
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, m);
}
const plusMin = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

const colors = ["#DBEAFE", "#E0E7FF", "#DCFCE7", "#FEE2E2", "#FEF3C7", "#F3E8FF"];

async function main() {
  await db.$executeRawUnsafe(
    `TRUNCATE "School","User","Invite","VerificationToken" RESTART IDENTITY CASCADE`,
  );
  const hash = await bcrypt.hash(PASSWORD, 10);

  const school = await db.school.create({
    data: {
      name: "Shaakir Rijschool",
      city: "Rotterdam",
      kvk: "KVK-INVULLEN",
      btw: "NL000000000B01",
      iban: "NL00BANK0000000000",
      timezone: "Europe/Amsterdam",
      defaultLocale: "nl",
      settings: {
        maxTeachingMinutesPerDay: 480,
        travelBufferMin: 10,
        cancellationWindowHours: 24,
        reminder24h: true,
        allowBookingOnUnpaid: false,
        vatRate: 21,
        paymentTermDays: 14,
        reminderDaysOverdue: [3, 10],
        smsSender: "ShaakirRS",
        lowHoursMinutes: 180,
      },
    },
  });
  const sid = school.id;

  // ── Vehicles ──
  const [polo, yaris, picanto] = await Promise.all([
    db.vehicle.create({ data: { schoolId: sid, name: "Volkswagen Polo", licensePlate: "RS-218-K", gearbox: "MANUAL", color: "Wit", apkDueDate: day(210), nextServiceDate: day(60), insuranceDueDate: day(300), odometerKm: 48210 } }),
    db.vehicle.create({ data: { schoolId: sid, name: "Toyota Yaris", licensePlate: "TG-540-L", gearbox: "MANUAL", color: "Zilver", apkDueDate: day(24), nextServiceDate: day(20), insuranceDueDate: day(300), odometerKm: 61230 } }),
    db.vehicle.create({ data: { schoolId: sid, name: "Kia Picanto (automaat)", licensePlate: "VX-902-B", gearbox: "AUTOMATIC", color: "Blauw", apkDueDate: day(150), nextServiceDate: day(90), insuranceDueDate: day(300), odometerKm: 22870 } }),
  ]);

  // ── Users & instructors ──
  const shaakirUser = await db.user.create({ data: { schoolId: sid, email: "shaakir@example.com", name: "Shaakir", role: "ADMIN", locale: "nl", passwordHash: hash } });
  const anoukUser = await db.user.create({ data: { schoolId: sid, email: "anouk@example.com", name: "Anouk van Dijk", role: "INSTRUCTOR", locale: "nl", passwordHash: hash } });
  const shaakir = await db.instructor.create({ data: { schoolId: sid, userId: shaakirUser.id, displayName: "Shaakir", color: "#1D4ED8", licenceNumber: "WRM-0001", homeAddress: "Oostzeedijk 120, Rotterdam", homeLat: 51.9244, homeLng: 4.5013, defaultVehicleId: polo.id } });
  const anouk = await db.instructor.create({ data: { schoolId: sid, userId: anoukUser.id, displayName: "Anouk", color: "#0F766E", licenceNumber: "WRM-0002", homeAddress: "Delfshaven, Rotterdam", homeLat: 51.9111, homeLng: 4.4504, defaultVehicleId: yaris.id } });
  await db.vehicle.update({ where: { id: polo.id }, data: { assignedInstructorId: shaakir.id } });
  await db.vehicle.update({ where: { id: yaris.id }, data: { assignedInstructorId: anouk.id } });

  for (const ins of [shaakir, anouk]) {
    for (let wd = 1; wd <= 6; wd++) {
      const sat = wd === 6;
      await db.instructorWorkingHours.create({ data: { schoolId: sid, instructorId: ins.id, weekday: wd, startMin: 8 * 60, endMin: sat ? 12 * 60 + 30 : 20 * 60 } });
    }
  }

  // ── Packages (catalogue) ──
  const pk = async (nameNl: string, nameEn: string, type: "PRACTICAL" | "THEORY" | "EXAM_BUNDLE", lessons: number, price: number, o: { exam?: boolean; popular?: boolean; descNl: string; descEn: string; order: number }) =>
    db.package.create({ data: { schoolId: sid, nameNl, nameEn, type, lessonCount: lessons, minutesIncluded: type === "THEORY" ? 0 : lessons * 60, includesExam: !!o.exam, priceCents: price, isPopular: !!o.popular, descriptionNl: o.descNl, descriptionEn: o.descEn, sortOrder: o.order } });
  const single = await pk("Losse les", "Single lesson", "PRACTICAL", 1, 6200, { descNl: "60 min praktijk", descEn: "60 min practical", order: 1 });
  const p10 = await pk("10 lessen", "10 lessons", "PRACTICAL", 10, 59500, { descNl: "10 u praktijk", descEn: "10 h practical", order: 2 });
  const p20 = await pk("20 lessen", "20 lessons", "PRACTICAL", 20, 115000, { descNl: "20 u praktijk", descEn: "20 h practical", order: 3 });
  const p30 = await pk("30 lessen + examen", "30 lessons + exam", "EXAM_BUNDLE", 30, 189000, { exam: true, popular: true, descNl: "Meest gekozen", descEn: "Most chosen", order: 4 });
  const theory = await pk("Theoriecursus", "Theory course", "THEORY", 6, 14900, { descNl: "6 klassikale lessen", descEn: "6 classroom sessions", order: 5 });
  void single;

  // ── Skills ──
  const skillDefs = [
    ["vehicle_control", "Voertuigbeheersing", "Vehicle control"],
    ["roundabouts", "Rotondes & voorrang", "Roundabouts & priority"],
    ["highway", "Snelwegrijden", "Highway driving"],
    ["special", "Bijzondere verrichtingen", "Special manoeuvres"],
  ] as const;
  const skills = [];
  for (const [i, [key, nameNl, nameEn]] of skillDefs.entries()) {
    skills.push(await db.skill.create({ data: { schoolId: sid, key, nameNl, nameEn, sortOrder: i } }));
  }

  // ── Students ──
  // [first, last, gearbox, track, package, lessonsUsed(h), paidCents, availability(days: 1=Mon…6=Sat, part), area, address, status, extra]
  type S = {
    f: string; l: string; g: "MANUAL" | "AUTOMATIC"; track?: "PRACTICAL" | "THEORY_ONLY" | "BOTH";
    pkg?: typeof p10; usedMin: number; paid: number; days: number[]; part?: "MORNING" | "AFTERNOON" | "EVENING";
    area: string; addr: string; status?: "ACTIVE" | "WAITING_LIST"; skills?: number[]; instr?: typeof shaakir; since?: string; overdueDays?: number; phone?: string;
  };
  const S: S[] = [
    { f: "Sanne", l: "Bakker", g: "MANUAL", pkg: p30, usedMin: 22.5 * 60, paid: 189000, days: [1, 3, 5, 6], part: "AFTERNOON", area: "Kralingen", addr: "Oostzeedijk 45, Rotterdam", skills: [90, 75, 60, 45], since: "2026-03-10" },
    { f: "Daan", l: "de Vries", g: "MANUAL", pkg: p20, usedMin: 8 * 60, paid: 57500, days: [1, 3, 5], part: "MORNING", area: "Blijdorp", addr: "Bergsingel 210, Rotterdam", skills: [70, 50, 30, 20] },
    { f: "Emma", l: "Visser", g: "MANUAL", pkg: p30, usedMin: 27 * 60, paid: 189000, days: [1, 2, 4], part: "MORNING", area: "Rotterdam Centraal", addr: "Conradstraat 10, Rotterdam", skills: [92, 88, 85, 82] },
    { f: "Lars", l: "Mulder", g: "AUTOMATIC", pkg: p10, usedMin: 8.5 * 60, paid: 59500, days: [2, 5], part: "AFTERNOON", area: "Kralingen", addr: "Lusthofstraat 8, Rotterdam", skills: [80, 65, 40, 35] },
    { f: "Mohammed", l: "El Amrani", g: "AUTOMATIC", pkg: p20, usedMin: 6 * 60, paid: 115000, days: [1, 4, 5], part: "AFTERNOON", area: "Delfshaven", addr: "Schiedamseweg 90, Rotterdam", skills: [55, 40, 20, 10] },
    { f: "Lotte", l: "Jansen", g: "MANUAL", track: "BOTH", pkg: p20, usedMin: 11 * 60, paid: 115000, days: [5, 6, 1], part: "AFTERNOON", area: "Hillegersberg", addr: "Straatweg 150, Rotterdam", skills: [75, 60, 50, 40] },
    { f: "Kim", l: "Hendriks", g: "AUTOMATIC", pkg: p10, usedMin: 2 * 60, paid: 59500, days: [3, 6], part: "MORNING", area: "Kralingen", addr: "Oostzeedijk 210, Rotterdam", skills: [30, 15, 0, 0] },
    { f: "Fatima", l: "Ouali", g: "MANUAL", pkg: p10, usedMin: 8 * 60, paid: 30000, days: [2, 4], part: "AFTERNOON", area: "Delfshaven", addr: "Pieter de Hoochweg 33, Rotterdam", skills: [65, 55, 35, 30] },
    { f: "Jesse", l: "Meijer", g: "MANUAL", track: "THEORY_ONLY", pkg: theory, usedMin: 3 * 60, paid: 14900, days: [1, 2, 3, 4, 5], part: "EVENING", area: "Blijdorp", addr: "Provenierssingel 15, Rotterdam", skills: [0, 0, 0, 0] },
    { f: "Yusuf", l: "Demir", g: "MANUAL", pkg: p10, usedMin: 0, paid: 0, days: [1, 2, 3, 4, 5], part: "AFTERNOON", area: "Rotterdam Centraal", addr: "Weena 400, Rotterdam", overdueDays: 9, skills: [10, 0, 0, 0] },
    { f: "Noah", l: "Smit", g: "MANUAL", pkg: p20, usedMin: 18 * 60, paid: 115000, days: [2, 3, 4], part: "MORNING", area: "Hillegersberg", addr: "Kleiweg 70, Rotterdam", skills: [85, 78, 70, 62] },
    { f: "Bram", l: "Peters", g: "MANUAL", pkg: p20, usedMin: 11 * 60, paid: 80000, days: [3, 5, 6], part: "AFTERNOON", area: "Delfshaven", addr: "Mathenesserlaan 120, Rotterdam", overdueDays: 4, skills: [60, 50, 30, 25] },
    { f: "Julia", l: "Vos", g: "AUTOMATIC", pkg: p20, usedMin: 9 * 60, paid: 115000, days: [1, 3, 6], part: "MORNING", area: "Kralingen", addr: "Kralingse Plaslaan 20, Rotterdam", skills: [60, 50, 40, 30] },
    { f: "Ayoub", l: "Haddad", g: "MANUAL", pkg: p20, usedMin: 7 * 60, paid: 115000, days: [3, 6], part: "AFTERNOON", area: "Delfshaven", addr: "Rösslerstraat 5, Rotterdam", skills: [50, 40, 20, 15] },
    { f: "Thijs", l: "Kok", g: "MANUAL", pkg: p10, usedMin: 4 * 60, paid: 59500, days: [2, 4], part: "MORNING", area: "Blijdorp", addr: "Heemraadssingel 80, Rotterdam", skills: [40, 30, 10, 5] },
    { f: "Noor", l: "Bos", g: "MANUAL", pkg: p20, usedMin: 8 * 60, paid: 115000, days: [1, 2, 3, 4, 5], part: "EVENING", area: "Hillegersberg", addr: "Ringdijk 14, Rotterdam", skills: [45, 35, 25, 10] },
    { f: "Sem", l: "de Jong", g: "MANUAL", pkg: p10, usedMin: 6 * 60, paid: 59500, days: [5], part: "AFTERNOON", area: "Kralingen", addr: "Rubensplein 3, Rotterdam", skills: [50, 40, 30, 20] },
    { f: "Tim", l: "Dekker", g: "MANUAL", pkg: p20, usedMin: 20 * 60, paid: 115000, days: [2, 4], part: "MORNING", area: "Blijdorp", addr: "Zaagmolenstraat 12, Rotterdam", skills: [70, 60, 50, 40], instr: anouk },
    // waiting list
    { f: "Iris", l: "van Dam", g: "MANUAL", pkg: undefined, usedMin: 0, paid: 0, days: [2, 4], part: "EVENING", area: "Kralingen", addr: "Avenue Concordia 30, Rotterdam", status: "WAITING_LIST" },
    { f: "Milan", l: "Koster", g: "AUTOMATIC", pkg: undefined, usedMin: 0, paid: 0, days: [1, 3], part: "MORNING", area: "Delfshaven", addr: "Nieuwe Binnenweg 200, Rotterdam", status: "WAITING_LIST" },
  ];

  const parts = { MORNING: [8 * 60, 12 * 60], AFTERNOON: [12 * 60, 17 * 60], EVENING: [17 * 60, 20 * 60] } as const;
  void parts;
  const students: Record<string, { id: string; g: "MANUAL" | "AUTOMATIC"; addr: string; instr: string }> = {};
  let invoiceSeq = 0;
  const year = now.getFullYear();
  const sinceDefault = new Date("2026-04-01");

  for (const [i, s] of S.entries()) {
    const instr = s.instr ?? shaakir;
    const st = await db.student.create({
      data: {
        schoolId: sid, firstName: s.f, lastName: s.l, gearbox: s.g, track: s.track ?? "PRACTICAL",
        status: s.status ?? "ACTIVE", area: s.area, address: s.addr, postcode: "3000 AA",
        phone: `06 1234 ${String(1000 + i)}`, email: `${s.f}.${s.l}`.toLowerCase().replace(/\s/g, "") + "@example.com",
        smsConsent: true, emailConsent: true, locale: "nl", avatarColor: colors[i % colors.length],
        primaryInstructorId: s.status === "WAITING_LIST" ? null : instr.id,
        since: new Date(s.since ?? sinceDefault),
      },
    });
    students[`${s.f} ${s.l}`] = { id: st.id, g: s.g, addr: s.addr, instr: instr.id };

    for (const d of s.days) {
      await db.studentAvailability.create({ data: { schoolId: sid, studentId: st.id, weekday: d, part: s.part ?? "AFTERNOON" } });
    }
    if (s.skills) {
      for (const [k, v] of s.skills.entries()) {
        await db.skillProgress.create({ data: { schoolId: sid, studentId: st.id, skillId: skills[k].id, value: v } });
      }
    }
    if (!s.pkg) continue;

    // purchase + invoice
    const minutes = s.pkg.type === "THEORY" ? 6 * 60 : s.pkg.minutesIncluded;
    const sub = Math.round(s.pkg.priceCents / 1.21);
    invoiceSeq += 1;
    const overdue = s.overdueDays != null;
    const status = s.paid >= s.pkg.priceCents ? "PAID" : overdue ? "OVERDUE" : s.paid > 0 ? "PARTIALLY_PAID" : "OPEN";
    const issued = overdue ? day(-(14 + s.overdueDays!)) : day(-30);
    const inv = await db.invoice.create({
      data: {
        schoolId: sid, studentId: st.id, number: `${year}-${String(invoiceSeq).padStart(4, "0")}`, status,
        lines: [{ description: s.pkg.nameNl, quantity: 1, unitPriceCents: sub, vatRate: 21 }],
        subtotalCents: sub, vatCents: s.pkg.priceCents - sub, totalCents: s.pkg.priceCents,
        issuedAt: issued, dueDate: new Date(issued.getTime() + 14 * 86_400_000),
      },
    });
    if (s.paid > 0) {
      await db.payment.create({ data: { schoolId: sid, invoiceId: inv.id, method: "IDEAL", amountCents: s.paid, status: "PAID", paidAt: day(-(i % 25) - 1) } });
    }
    const sp = await db.studentPackage.create({
      data: { schoolId: sid, studentId: st.id, packageId: s.pkg.id, priceCents: s.pkg.priceCents, minutesPurchased: minutes, examCredits: s.pkg.includesExam ? 1 : 0, invoiceId: inv.id, purchasedAt: issued },
    });
    await db.hoursLedgerEntry.create({ data: { schoolId: sid, studentId: st.id, studentPackageId: sp.id, type: "PURCHASE", minutes, note: s.pkg.nameNl, createdById: shaakirUser.id } });
    if (s.usedMin > 0) {
      await db.hoursLedgerEntry.create({ data: { schoolId: sid, studentId: st.id, studentPackageId: sp.id, type: "CONSUME", minutes: -s.usedMin, note: "Eerdere lessen (seed)", createdById: shaakirUser.id } });
    }
    await db.student.update({ where: { id: st.id }, data: { minutesRemaining: minutes - s.usedMin } });
  }

  // ── Lessons this week ──
  type L = { dow: number; time: string; dur: number; who: string; instr?: typeof shaakir; note?: string };
  const lessons: L[] = [
    { dow: 0, time: "08:30", dur: 60, who: "Daan de Vries" }, { dow: 0, time: "09:45", dur: 90, who: "Sanne Bakker", note: "roundabouts & highway" },
    { dow: 0, time: "13:30", dur: 60, who: "Mohammed El Amrani" }, { dow: 0, time: "15:00", dur: 60, who: "Lotte Jansen" }, { dow: 0, time: "16:30", dur: 60, who: "Yusuf Demir" },
    { dow: 2, time: "09:00", dur: 60, who: "Julia Vos" }, { dow: 2, time: "10:30", dur: 60, who: "Daan de Vries" }, { dow: 2, time: "15:00", dur: 90, who: "Sanne Bakker" }, { dow: 2, time: "17:00", dur: 60, who: "Ayoub Haddad" },
    { dow: 3, time: "08:30", dur: 60, who: "Emma Visser", note: "warm-up" }, { dow: 3, time: "13:00", dur: 90, who: "Mohammed El Amrani" }, { dow: 3, time: "15:00", dur: 60, who: "Noah Smit" },
    { dow: 4, time: "09:00", dur: 90, who: "Lotte Jansen" }, { dow: 4, time: "11:00", dur: 60, who: "Yusuf Demir" }, { dow: 4, time: "13:30", dur: 60, who: "Fatima Ouali" }, { dow: 4, time: "15:00", dur: 90, who: "Bram Peters" },
    { dow: 5, time: "09:00", dur: 60, who: "Julia Vos" }, { dow: 5, time: "11:00", dur: 60, who: "Ayoub Haddad" },
    // Anouk
    { dow: 0, time: "09:00", dur: 60, who: "Tim Dekker", instr: anouk }, { dow: 3, time: "10:00", dur: 60, who: "Tim Dekker", instr: anouk },
  ];
  // Everything strictly in the past is COMPLETED, except the most recent one which still needs check-off.
  const past = lessons.map((l) => ({ l, start: at(l.dow, l.time) })).filter((x) => x.start < now && x.l.instr == null).sort((a, b) => +b.start - +a.start);
  const needsCheckOff = past[0]?.start.getTime();

  for (const l of lessons) {
    const stu = students[l.who];
    const start = at(l.dow, l.time);
    const isPast = start < now;
    const status = isPast && start.getTime() !== needsCheckOff ? "COMPLETED" : "PLANNED";
    const veh = stu.g === "AUTOMATIC" ? picanto : l.instr === anouk ? yaris : polo;
    const lesson = await db.lesson.create({
      data: {
        schoolId: sid, type: "PRACTICAL", instructorId: l.instr?.id ?? shaakir.id, studentId: stu.id, vehicleId: veh.id,
        startsAt: start, endsAt: plusMin(start, l.dur), durationMin: l.dur, gearbox: stu.g, pickupAddress: stu.addr,
        status, instructorNotes: l.note, completedAt: status === "COMPLETED" ? plusMin(start, l.dur) : null,
      },
    });
    // planned lessons reserve hours; completed ones were consumed in the historic balance above
    if (status === "PLANNED") {
      await db.hoursLedgerEntry.create({ data: { schoolId: sid, studentId: stu.id, lessonId: lesson.id, type: "RESERVE", minutes: -l.dur, createdById: shaakirUser.id } });
      await db.student.update({ where: { id: stu.id }, data: { minutesReserved: { increment: l.dur } } });
    }
  }

  // ── Theory groups (one Lesson row each so calendars treat them uniformly) ──
  const groups: [number, string, string, string, string, string, number][] = [
    [0, "11:30", "13:00", "Theorie · Borden", "Theory · Signs", "Verkeersborden & voorrang", 8],
    [1, "18:30", "20:00", "Theorie · Gevaren", "Theory · Hazards", "Gevaarherkenning", 7],
    [2, "13:00", "14:30", "Theorie · Voorrang", "Theory · Priority", "Voorrangsregels", 9],
    [0, "19:00", "20:00", "Theorie · Proefexamen", "Theory · Mock", "CBR proefexamen", 6],
    [3, "19:00", "20:00", "Theorie · Q&A", "Theory · Q&A", "Vragenuur", 5],
  ];
  const theoryStudents = Object.values(students);
  for (const [dow, from, to, titleNl, titleEn, topic, seats] of groups) {
    const start = at(dow, from);
    const [th, tm] = to.split(":").map(Number);
    const end = at(dow, `${th}:${tm}`);
    const g = await db.theoryGroup.create({ data: { schoolId: sid, titleNl, titleEn, topic, startsAt: start, endsAt: end, location: "Klaslokaal", capacity: 10, instructorId: shaakir.id } });
    for (let k = 0; k < seats; k++) {
      await db.theoryEnrollment.create({ data: { schoolId: sid, theoryGroupId: g.id, studentId: theoryStudents[k % theoryStudents.length].id, attendance: end < now ? "ATTENDED" : "ENROLLED" } });
    }
    await db.lesson.create({ data: { schoolId: sid, type: "THEORY", instructorId: shaakir.id, theoryGroupId: g.id, startsAt: start, endsAt: end, durationMin: (+end - +start) / 60000, status: end < now ? "COMPLETED" : "PLANNED", completedAt: end < now ? end : null } });
  }

  // ── Exams ──
  const exam = (who: string, kind: "THEORY" | "PRACTICAL", inDays: number, time: string, ready: boolean, left?: number) => {
    const d = day(inDays);
    const p = localParts(d);
    const [h, m] = time.split(":").map(Number);
    return db.exam.create({ data: { schoolId: sid, studentId: students[who].id, kind, scheduledAt: zonedToUtc(p.year, p.month, p.day, h, m), cbrLocation: "CBR Rotterdam", status: "SCHEDULED", readiness: ready ? "READY" : "NEEDS_LESSONS", lessonsLeftEstimate: left } });
  };
  await exam("Emma Visser", "PRACTICAL", 3, "10:15", true);
  await exam("Noah Smit", "PRACTICAL", 8, "13:40", false, 2);
  await exam("Lotte Jansen", "THEORY", 11, "09:00", true);
  await db.exam.create({ data: { schoolId: sid, studentId: students["Sanne Bakker"].id, kind: "PRACTICAL", status: "REQUESTED", notes: "Handgeschakeld rijbewijs" } });
  await db.exam.create({ data: { schoolId: sid, studentId: students["Sanne Bakker"].id, kind: "THEORY", status: "PASSED", scheduledAt: new Date("2026-08-12T09:00:00Z"), cbrLocation: "CBR Rotterdam", readiness: "READY" } });

  // ── Invoice counter ──
  await db.invoiceCounter.create({ data: { schoolId: sid, year, last: invoiceSeq } });

  console.log(`Seeded ${S.length} students, ${lessons.length + groups.length} lessons.`);
  console.log(`Logins: shaakir@example.com (admin) / anouk@example.com (instructor), password: ${PASSWORD}`);
}

main().finally(() => db.$disconnect());
