-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('SMB', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'ANALYZING', 'COMPLETE', 'FLAGGED', 'CLEARED');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('AI_GENERATED_RESUME', 'IDENTITY_MISMATCH', 'WORK_HISTORY_UNVERIFIABLE', 'PROXY_INTERVIEW_SUSPECTED', 'DEEPFAKE_DETECTED', 'BEHAVIORAL_ANOMALY', 'LOCATION_SPOOFING', 'VOICE_CLONE_SUSPECTED', 'DUPLICATE_IDENTITY', 'SOCIAL_PROFILE_MISSING');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('DEEPFAKE_FACE', 'VOICE_CLONE', 'EARPIECE_DETECTED', 'MULTIPLE_VOICES', 'AI_SCRIPTED_ANSWER', 'EYE_MOVEMENT_ANOMALY', 'IDENTITY_SWITCH', 'SCREEN_SHARE_CHEAT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'SMB',
    "apiKey" TEXT NOT NULL,
    "apiKeyHash" TEXT,
    "screeningsUsed" INTEGER NOT NULL DEFAULT 0,
    "screeningLimit" INTEGER NOT NULL DEFAULT 10,
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RECRUITER',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resumeUrl" TEXT,
    "resumeText" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "authenticityScore" DOUBLE PRECISION,
    "riskLevel" "RiskLevel",
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "submissionIp" TEXT,
    "deviceFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudFlag" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" "FlagType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "disputeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeAnalysis" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "aiGeneratedScore" DOUBLE PRECISION NOT NULL,
    "perplexityScore" DOUBLE PRECISION NOT NULL,
    "burstinessScore" DOUBLE PRECISION NOT NULL,
    "stylometricScore" DOUBLE PRECISION NOT NULL,
    "workHistoryScore" DOUBLE PRECISION NOT NULL,
    "linkedinMatch" DOUBLE PRECISION,
    "githubMatch" DOUBLE PRECISION,
    "publicRecordsMatch" DOUBLE PRECISION,
    "rawSignals" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityAnalysis" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "faceMatchScore" DOUBLE PRECISION,
    "locationConsistent" BOOLEAN,
    "vpnDetected" BOOLEAN NOT NULL DEFAULT false,
    "deviceFingerprint" TEXT,
    "submissionIp" TEXT,
    "ipReputation" TEXT,
    "ipCountry" TEXT,
    "claimedCountry" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "platform" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "eyeMovementScore" DOUBLE PRECISION,
    "voiceConsistencyScore" DOUBLE PRECISION,
    "microExpressionScore" DOUBLE PRECISION,
    "responseLatencyScore" DOUBLE PRECISION,
    "identityDriftScore" DOUBLE PRECISION,
    "aiAssistedAnswerScore" DOUBLE PRECISION,
    "recordingUrl" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveAlert" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "frameSnapshot" TEXT,

    CONSTRAINT "LiveAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudDatabase" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "deviceHash" TEXT,
    "ipHash" TEXT,
    "resumeHash" TEXT,
    "flagCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "sharedAcrossOrgs" BOOLEAN NOT NULL DEFAULT true,
    "sourceOrgCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "FraudDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job_Queue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Job_Queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_apiKey_key" ON "Organization"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeAnalysis_candidateId_key" ON "ResumeAnalysis"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityAnalysis_candidateId_key" ON "IdentityAnalysis"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_sessionToken_key" ON "InterviewSession"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "FraudDatabase_emailHash_key" ON "FraudDatabase"("emailHash");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudFlag" ADD CONSTRAINT "FraudFlag_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAnalysis" ADD CONSTRAINT "IdentityAnalysis_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveAlert" ADD CONSTRAINT "LiveAlert_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
