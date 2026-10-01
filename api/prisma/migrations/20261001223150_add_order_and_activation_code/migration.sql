-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parentName" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSeat" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "pricePence" INTEGER NOT NULL,

    CONSTRAINT "OrderSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codeHash" TEXT NOT NULL,
    "seatId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderSeat_orderId_idx" ON "OrderSeat"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_codeHash_key" ON "ActivationCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_seatId_key" ON "ActivationCode"("seatId");

-- AddForeignKey
ALTER TABLE "OrderSeat" ADD CONSTRAINT "OrderSeat_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSeat" ADD CONSTRAINT "OrderSeat_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
