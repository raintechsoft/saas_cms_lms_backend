-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('REGULAR', 'TRANSFER');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "additional_notes" TEXT,
ADD COLUMN     "admission_type" "AdmissionType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "father_email" TEXT,
ADD COLUMN     "father_occupation" TEXT,
ADD COLUMN     "guardian_email" TEXT,
ADD COLUMN     "guardian_occupation" TEXT,
ADD COLUMN     "hostel_opt_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hostel_room" TEXT,
ADD COLUMN     "mother_email" TEXT,
ADD COLUMN     "mother_occupation" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "rte_certificate_no" TEXT,
ADD COLUMN     "rte_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rte_scheme_name" TEXT,
ADD COLUMN     "transport_opt_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transport_route" TEXT;
