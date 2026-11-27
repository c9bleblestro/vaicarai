import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error'],
});

/** Cria campos de XP de chat sem reconfigurar ou apagar saldos econômicos. */
export async function ensureChatLevelSchema() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "GuildConfig"
      ADD COLUMN IF NOT EXISTS "chatLevelEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ChatLevelCooldown" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "guildId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "lastXpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastHash" TEXT NOT NULL DEFAULT '',
      "chatXp" INTEGER NOT NULL DEFAULT 0,
      "chatMessages" INTEGER
    );
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ChatLevelCooldown" ADD COLUMN IF NOT EXISTS "chatXp" INTEGER NOT NULL DEFAULT 0;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ChatLevelCooldown" ADD COLUMN IF NOT EXISTS "chatMessages" INTEGER;
  `);
  // Migração única: mantém nível e fração de progresso antigos; não altera chatXp.
  // NULL identifica registros anteriores à mudança; zero é um progresso válido.
  await prisma.$executeRawUnsafe(`
    WITH legacy AS (
      SELECT "id", GREATEST("chatXp",0)::numeric AS xp,
        GREATEST(0,FLOOR((SQRT(25600::numeric+160::numeric*GREATEST("chatXp",0))-160)/80)) AS lvl
      FROM "ChatLevelCooldown" WHERE "chatMessages" IS NULL
    )
    UPDATE "ChatLevelCooldown" AS c
    SET "chatMessages" = (legacy.lvl*50 + LEAST(49,GREATEST(0,FLOOR(
      (legacy.xp-40*legacy.lvl*legacy.lvl-160*legacy.lvl)*50/(200+80*legacy.lvl)
    ))))::integer
    FROM legacy WHERE c."id"=legacy."id" AND c."chatMessages" IS NULL;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ChatLevelCooldown_guildId_userId_key"
      ON "ChatLevelCooldown" ("guildId", "userId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ChatLevelCooldown_guildId_idx"
      ON "ChatLevelCooldown" ("guildId");
  `);
}

export async function ensureCallRankSchema() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'GuildConfig'
      ) THEN
        ALTER TABLE "GuildConfig"
          ADD COLUMN IF NOT EXISTS "callRankChannelId" TEXT,
          ADD COLUMN IF NOT EXISTS "callRankMessageId" TEXT,
          ADD COLUMN IF NOT EXISTS "callRankTitle" TEXT,
          ADD COLUMN IF NOT EXISTS "callRankDescription" TEXT,
          ADD COLUMN IF NOT EXISTS "callRankFooter" TEXT,
          ADD COLUMN IF NOT EXISTS "callRankPage" INTEGER NOT NULL DEFAULT 0;
      END IF;
    END
    $$;
  `);
}

export async function ensureMarriageSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BankAccount" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "midasBalance" NUMERIC(20,8) NOT NULL DEFAULT 0,
      "failedAttempts" INTEGER NOT NULL DEFAULT 0,
      "lockedUntil" TIMESTAMP(3),
      "lastAccessAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "BankAccount_userId_guildId_key"
      ON "BankAccount" ("userId", "guildId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BankAccount_guildId_userId_idx"
      ON "BankAccount" ("guildId", "userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BankHolding" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "symbol" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 0,
      "averagePrice" NUMERIC(20,8) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BankHolding_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "BankHolding_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "BankAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "BankHolding_accountId_symbol_key"
      ON "BankHolding" ("accountId", "symbol")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BankHolding_guildId_userId_idx"
      ON "BankHolding" ("guildId", "userId")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'BankAccount'
          AND column_name = 'midasBalance' AND data_type <> 'numeric'
      ) THEN
        ALTER TABLE "BankAccount"
          ALTER COLUMN "midasBalance" TYPE NUMERIC(20,8)
          USING "midasBalance"::numeric;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'BankHolding'
          AND column_name = 'averagePrice' AND data_type <> 'numeric'
      ) THEN
        ALTER TABLE "BankHolding"
          ALTER COLUMN "averagePrice" TYPE NUMERIC(20,8)
          USING "averagePrice"::numeric;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MessageTrigger" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "keywords" TEXT NOT NULL,
      "responseUrl" TEXT NOT NULL,
      "responseName" TEXT NOT NULL,
      "responseType" TEXT,
      "responseSize" INTEGER,
      "storageKey" TEXT,
      "responseData" BYTEA,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MessageTrigger_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "MessageTrigger"
      ADD COLUMN IF NOT EXISTS "responseData" BYTEA
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MessageTrigger_guildId_idx"
      ON "MessageTrigger" ("guildId")
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "CustomBanner"
      ADD COLUMN IF NOT EXISTS "imageData" BYTEA
  `);

  // Mantém a economia de empresas compatível com bancos existentes. A criação
  // é aditiva e também é coberta pelo schema.prisma/db push no deploy.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Business" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "businessKey" TEXT NOT NULL,
      "level" INTEGER NOT NULL DEFAULT 1,
      "lastCollectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "totalEarned" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Business_userId_guildId_businessKey_key"
      ON "Business" ("userId", "guildId", "businessKey")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Business_guildId_userId_idx"
      ON "Business" ("guildId", "userId")
  `);

  // O schema do Prisma pode ser atualizado antes do banco do Railway.
  // Esta alteração é aditiva e mantém o painel funcionando durante o deploy.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'GuildConfig'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'GuildConfig'
          AND column_name = 'boostRoles'
      ) THEN
        ALTER TABLE "GuildConfig" ADD COLUMN "boostRoles" TEXT;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'GuildConfig'
      ) THEN
        ALTER TABLE "GuildConfig"
          ADD COLUMN IF NOT EXISTS "mentionReactionEnabled" BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "mentionReactionTargetUserId" TEXT,
          ADD COLUMN IF NOT EXISTS "mentionReactionEmojiId" TEXT;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'UserProfile'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'UserProfile'
          AND column_name = 'marriedAt'
      ) THEN
        ALTER TABLE "UserProfile" ADD COLUMN "marriedAt" TIMESTAMP(3);
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserAfk" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "reason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserAfk_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "UserAfk_guildId_userId_key"
      ON "UserAfk" ("guildId", "userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserAfk_guildId_idx"
      ON "UserAfk" ("guildId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReputationGive" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "giverId" TEXT NOT NULL,
      "receiverId" TEXT NOT NULL,
      "lastGivenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReputationGive_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ReputationGive_guildId_giverId_receiverId_key"
      ON "ReputationGive" ("guildId", "giverId", "receiverId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ReputationGive_guildId_receiverId_idx"
      ON "ReputationGive" ("guildId", "receiverId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CriminalRecord" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "debt" INTEGER NOT NULL DEFAULT 0,
      "arrests" INTEGER NOT NULL DEFAULT 0,
      "crimes" INTEGER NOT NULL DEFAULT 0,
      "lastCrime" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CriminalRecord_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CriminalRecord_userId_guildId_key"
      ON "CriminalRecord" ("userId", "guildId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CriminalRecord_guildId_userId_idx"
      ON "CriminalRecord" ("guildId", "userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardCollection" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "cardKey" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "firstObtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CardCollection_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CardCollection_userId_cardKey_key"
      ON "CardCollection" ("userId", "cardKey")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardCollection_userId_idx"
      ON "CardCollection" ("userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardWallet" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "fragments" INTEGER NOT NULL DEFAULT 0,
      "tickets" INTEGER NOT NULL DEFAULT 0,
      "dailyKey" TEXT NOT NULL DEFAULT '',
      "dailyOpened" INTEGER NOT NULL DEFAULT 0,
      "dailyDiscovered" INTEGER NOT NULL DEFAULT 0,
      "dailySold" INTEGER NOT NULL DEFAULT 0,
      "dailyTrades" INTEGER NOT NULL DEFAULT 0,
      "dailyClaimed" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CardWallet_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CardWallet_userId_key"
      ON "CardWallet" ("userId")
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CardWallet"
      ADD COLUMN IF NOT EXISTS "tickets" INTEGER NOT NULL DEFAULT 0
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardTransaction" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "cardKey" TEXT,
      "quantity" INTEGER NOT NULL DEFAULT 0,
      "fragments" INTEGER NOT NULL DEFAULT 0,
      "coins" INTEGER NOT NULL DEFAULT 0,
      "metadata" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransaction_userId_createdAt_idx"
      ON "CardTransaction" ("userId", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransaction_guildId_createdAt_idx"
      ON "CardTransaction" ("guildId", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransaction_type_createdAt_idx"
      ON "CardTransaction" ("type", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardPackCooldown" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "nextOpenAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CardPackCooldown_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CardPackCooldown_userId_guildId_key"
      ON "CardPackCooldown" ("userId", "guildId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardPackCooldown_guildId_userId_idx"
      ON "CardPackCooldown" ("guildId", "userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardTrade" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "fromUserId" TEXT NOT NULL,
      "toUserId" TEXT NOT NULL,
      "offeredCardKey" TEXT NOT NULL,
      "requestedCardKey" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CardTrade_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTrade_toUserId_status_idx"
      ON "CardTrade" ("toUserId", "status")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTrade_fromUserId_status_idx"
      ON "CardTrade" ("fromUserId", "status")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTrade_guildId_status_idx"
      ON "CardTrade" ("guildId", "status")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'GuildConfig'
      ) THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GuildConfig' AND column_name = 'bumpEnabled')
          THEN ALTER TABLE "GuildConfig" ADD COLUMN "bumpEnabled" BOOLEAN NOT NULL DEFAULT false; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GuildConfig' AND column_name = 'bumpChannel')
          THEN ALTER TABLE "GuildConfig" ADD COLUMN "bumpChannel" TEXT; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GuildConfig' AND column_name = 'bumpRole')
          THEN ALTER TABLE "GuildConfig" ADD COLUMN "bumpRole" TEXT; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GuildConfig' AND column_name = 'bumpNextAt')
          THEN ALTER TABLE "GuildConfig" ADD COLUMN "bumpNextAt" TIMESTAMP(3); END IF;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommandBlockRule" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "commandName" TEXT NOT NULL,
      "scopeType" TEXT NOT NULL,
      "scopeId" TEXT NOT NULL,
      "isException" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CommandBlockRule_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CommandBlockRule_guildId_commandName_scopeType_scopeId_isException_key"
      ON "CommandBlockRule" ("guildId", "commandName", "scopeType", "scopeId", "isException")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommandBlockRule_guildId_commandName_idx"
      ON "CommandBlockRule" ("guildId", "commandName")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommandFine" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "amount" INTEGER NOT NULL DEFAULT 120000000,
      "paidAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CommandFine_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CommandFine_userId_key"
      ON "CommandFine" ("userId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MemberWarning" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "count" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MemberWarning_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "MemberWarning_guildId_userId_key"
      ON "MemberWarning" ("guildId", "userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MemberWarning_guildId_userId_idx"
      ON "MemberWarning" ("guildId", "userId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VipCustomRole" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "roleId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VipCustomRole_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VipCustomRole_guildId_userId_key"
      ON "VipCustomRole" ("guildId", "userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VipCustomRole_roleId_idx"
      ON "VipCustomRole" ("roleId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VipRoleGrantRequest" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "roleId" TEXT NOT NULL,
      "giverId" TEXT NOT NULL,
      "recipientId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VipRoleGrantRequest_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VipRoleGrantRequest_recipientId_status_idx"
      ON "VipRoleGrantRequest" ("recipientId", "status")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VipRoleGrantRequest_guildId_giverId_status_idx"
      ON "VipRoleGrantRequest" ("guildId", "giverId", "status")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VipRoleGrantRequest_expiresAt_idx"
      ON "VipRoleGrantRequest" ("expiresAt")
  `);

  // Avaliações de atendimento: criação idempotente para bancos Railway que
  // receberam o cliente Prisma antes da tabela nova ser sincronizada.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StaffRating" (
      "id" TEXT NOT NULL,
      "guildId" TEXT NOT NULL,
      "ticketId" TEXT NOT NULL,
      "reviewerId" TEXT NOT NULL,
      "staffId" TEXT NOT NULL,
      "stars" INTEGER NOT NULL,
      "reason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StaffRating_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StaffRating_ticketId_reviewerId_key"
      ON "StaffRating" ("ticketId", "reviewerId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StaffRating_guildId_staffId_idx"
      ON "StaffRating" ("guildId", "staffId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StaffRating_ticketId_idx"
      ON "StaffRating" ("ticketId")
  `);
}

/** Migração aditiva; não altera contadores ou economia existentes. */
export async function ensureInteractionStreakSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InteractionStreak" (
      "guildId" TEXT NOT NULL,
      "userAId" TEXT NOT NULL,
      "userBId" TEXT NOT NULL,
      "day" INTEGER NOT NULL,
      "dayMask" INTEGER NOT NULL DEFAULT 0,
      "days" INTEGER NOT NULL DEFAULT 0,
      "bestDays" INTEGER NOT NULL DEFAULT 0,
      "lastCompletedDay" INTEGER,
      PRIMARY KEY ("guildId","userAId","userBId")
    )
  `);
}

export async function ensureTicketInviteTemplateSchema() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "TicketInviteTemplate" (
      "guildId" TEXT PRIMARY KEY,
      "content" TEXT NOT NULL,
      "attachments" JSONB NOT NULL,
      "savedBy" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export async function ensureReactionTriggerSchema() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ReactionTrigger" (
      "id" TEXT PRIMARY KEY,
      "guildId" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "keywords" TEXT NOT NULL,
      "emojiId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "ReactionTrigger_guildId_idx" ON "ReactionTrigger" ("guildId")`;
}

export async function ensureCommunityRadioSchema() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CommunityRadio" (
      "guildId" TEXT PRIMARY KEY,
      "voiceChannelId" TEXT NOT NULL,
      "textChannelId" TEXT,
      "panelMessageId" TEXT,
      "station" TEXT NOT NULL DEFAULT 'auto',
      "djRoleId" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "queue" JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `;
  await prisma.$executeRaw`ALTER TABLE "CommunityRadio" ALTER COLUMN "textChannelId" DROP NOT NULL`;
}

export async function ensureProfileStudioSchema() {
  await prisma.$executeRaw`ALTER TABLE "UserProfile"
    ADD COLUMN IF NOT EXISTS "profileTheme" TEXT NOT NULL DEFAULT 'rose',
    ADD COLUMN IF NOT EXISTS "profileEffect" TEXT NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS "profileDecor" TEXT NOT NULL DEFAULT 'floral',
    ADD COLUMN IF NOT EXISTS "profileSignature" TEXT`;
}

export async function ensurePetLifeSchema() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "PetLife" (
      "userId" TEXT NOT NULL, "guildId" TEXT NOT NULL, "petId" TEXT NOT NULL,
      "xp" INTEGER NOT NULL DEFAULT 0, "fullness" INTEGER NOT NULL DEFAULT 90,
      "happiness" INTEGER NOT NULL DEFAULT 90, "energy" INTEGER NOT NULL DEFAULT 90,
      "hygiene" INTEGER NOT NULL DEFAULT 90, "bond" INTEGER NOT NULL DEFAULT 0,
      "careAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastBath" TIMESTAMP(3), "lastNap" TIMESTAMP(3), "adventureUntil" TIMESTAMP(3),
      "room" TEXT NOT NULL DEFAULT 'neon', "ownedRooms" TEXT NOT NULL DEFAULT 'neon',
      "revision" INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY ("userId","guildId","petId")
    )
  `;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "PetLife_guildId_xp_idx" ON "PetLife" ("guildId","xp")`;
}

export default prisma;
