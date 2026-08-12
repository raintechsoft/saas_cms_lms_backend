-- CreateTable
CREATE TABLE "mobile_push_tokens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_push_tokens_tenant_id_user_id_idx" ON "mobile_push_tokens"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_push_tokens_tenant_id_token_key" ON "mobile_push_tokens"("tenant_id", "token");

-- AddForeignKey
ALTER TABLE "mobile_push_tokens" ADD CONSTRAINT "mobile_push_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_push_tokens" ADD CONSTRAINT "mobile_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
