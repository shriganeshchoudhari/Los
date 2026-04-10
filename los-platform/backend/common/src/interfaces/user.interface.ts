export type UserRole =
  | 'APPLICANT'
  | 'LOAN_OFFICER'
  | 'CREDIT_ANALYST'
  | 'BRANCH_MANAGER'
  | 'ZONAL_CREDIT_HEAD'
  | 'COMPLIANCE_OFFICER'
  | 'SYSTEM'
  | 'ADMIN';

export interface JwtUser {
  sub: string;
  role: UserRole;
  branchCode?: string;
  sessionId: string;
  iat: number;
  exp: number;
  jti: string;
  scope?: string[];
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  branchCode?: string;
  sessionId?: string;
  scope: string[];
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  headers: Record<string, any>;
  socket?: { remoteAddress?: string };
  ip?: string;
}
