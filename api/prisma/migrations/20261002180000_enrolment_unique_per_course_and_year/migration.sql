-- DropIndex
DROP INDEX "Enrolment_studentId_courseId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Enrolment_studentId_courseId_year_key" ON "Enrolment"("studentId", "courseId", "year");
