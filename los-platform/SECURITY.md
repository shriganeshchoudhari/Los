# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the LOS Platform, please report it immediately by contacting the security team at **security@losbank.example.com**. Do NOT create a public GitHub issue.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

## Response Timeline

- **Acknowledgement**: Within 24 hours
- **Initial Assessment**: Within 3 business days
- **Fix Timeline**: Severity-based (Critical: 48h, High: 7d, Medium: 30d, Low: 90d)

## Security Requirements

All contributors must adhere to the following:

1. **No secrets in code** — API keys, passwords, tokens, and credentials must never be committed. Use environment variables or HashiCorp Vault.
2. **Aadhaar/PAN data** — Must be hashed with SHA-256 before storage. No plaintext Aadhaar numbers in logs or responses.
3. **Input validation** — All user inputs must be validated server-side. Never trust client-side validation.
4. **Audit logging** — All state-changing operations must be logged with actor, timestamp, and IP.
5. **RBAC** — Role-based access control enforced on all protected endpoints. No backdoors.
6. **OTP security** — Rate limiting, account lockout, and TTL enforcement mandatory.

## Dependency Management

- All npm dependencies must be audited with `npm audit` before major updates
- Known CVEs must be patched within 30 days of disclosure
- No deprecated cryptographic libraries (MD5, SHA1 for password hashing, etc.)
