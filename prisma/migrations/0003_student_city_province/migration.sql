-- Student address: province and city/village chosen from the Dutch places list (additive, nullable)
ALTER TABLE "Student" ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT;
