// packages/types/src/index.ts
// Shared types across frontend and backend

export type Plan = 'SMB' | 'GROWTH' | 'ENTERPRISE'
export type Role = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type CandidateStatus = 'PENDING' | 'ANALYZING' | 'COMPLETE' | 'FLAGGED' | 'CLEARED'
export type SessionStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FLAGGED'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type FlagType =
  | 'AI_GENERATED_RESUME'
  | 'IDENTITY_MISMATCH'
  | 'WORK_HISTORY_UNVERIFIABLE'
  | 'PROXY_INTERVIEW_SUSPECTED'
  | 'DEEPFAKE_DETECTED'
  | 'BEHAVIORAL_ANOMALY'
  | 'LOCATION_SPOOFING'
  | 'VOICE_CLONE_SUSPECTED'
  | 'DUPLICATE_IDENTITY'
  | 'SOCIAL_PROFILE_MISSING'

export type AlertType =
  | 'DEEPFAKE_FACE'
  | 'VOICE_CLONE'
  | 'EARPIECE_DETECTED'
  | 'MULTIPLE_VOICES'
  | 'AI_SCRIPTED_ANSWER'
  | 'EYE_MOVEMENT_ANOMALY'
  | 'IDENTITY_SWITCH'
  | 'SCREEN_SHARE_CHEAT'

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  requestId: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface Organization {
  id: string
  name: string
  plan: Plan
  screeningsUsed: number
  screeningLimit: number
  createdAt: string
}

export interface User {
  id: string
  email: string
  role: Role
  organizationId: string
  createdAt: string
}

export interface Job {
  id: string
  title: string
  description?: string
  organizationId: string
  isActive: boolean
  createdAt: string
}

export interface FraudFlag {
  id: string
  candidateId: string
  type: FlagType
  severity: Severity
  description: string
  evidence?: Record<string, unknown>
  createdAt: string
}

export interface ResumeAnalysis {
  id: string
  candidateId: string
  aiGeneratedScore: number
  perplexityScore: number
  burstinessScore: number
  stylometricScore: number
  workHistoryScore: number
  linkedinMatch?: number
  githubMatch?: number
  rawSignals: Record<string, unknown>
  analyzedAt: string
}

export interface IdentityAnalysis {
  id: string
  candidateId: string
  identityVerified: boolean
  faceMatchScore?: number
  locationConsistent?: boolean
  vpnDetected: boolean
  deviceFingerprint?: string
  submissionIp?: string
  ipReputation?: string
  analyzedAt: string
}

export interface LiveAlert {
  id: string
  sessionId: string
  alertType: AlertType
  confidence: number
  timestamp: string
  description: string
  frameSnapshot?: string
}

export interface InterviewSession {
  id: string
  candidateId: string
  sessionToken: string
  platform?: string
  startedAt?: string
  endedAt?: string
  eyeMovementScore?: number
  voiceConsistencyScore?: number
  responseLatencyScore?: number
  identityDriftScore?: number
  aiAssistedAnswerScore?: number
  liveAlerts: LiveAlert[]
  status: SessionStatus
  createdAt: string
}

export interface Candidate {
  id: string
  name: string
  email: string
  phone?: string
  resumeUrl?: string
  resumeText?: string
  linkedinUrl?: string
  githubUrl?: string
  organizationId: string
  jobId?: string
  job?: Job
  authenticityScore?: number
  riskLevel?: RiskLevel
  fraudFlags: FraudFlag[]
  resumeAnalysis?: ResumeAnalysis
  identityAnalysis?: IdentityAnalysis
  interviewSessions: InterviewSession[]
  status: CandidateStatus
  createdAt: string
  updatedAt: string
}

export interface CASBreakdown {
  overall: number
  resumeAuthenticity: number
  workHistoryScore: number
  identityVerificationScore: number
  interviewBehavioralScore: number
  networkReputationScore: number
  riskLevel: RiskLevel
  aiSummary?: string
}

export interface DashboardStats {
  totalCandidates: number
  flaggedCount: number
  clearedCount: number
  analyzingCount: number
  avgAuthenticityScore: number
  fraudByType: Record<FlagType, number>
  riskDistribution: Record<RiskLevel, number>
  weeklyTrend: Array<{ date: string; screened: number; flagged: number }>
}

export interface WebSocketAlert {
  sessionId: string
  alertType: AlertType
  confidence: number
  timestamp: string
  description: string
  frameSnapshot?: string
  recommendation?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  organizationName: string
}
