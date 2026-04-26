# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\security\security.spec.ts >> Security Tests — LOS Platform >> A10: Server-Side Request Forgery (OWASP) >> SSRF — bureau callback URL parameter sanitized
- Location: tests\security\security.spec.ts:332:9

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:3002
Call log:
  - → POST http://localhost:3002/auth/otp/send
    - user-agent: Playwright/1.59.1 (x64; windows 10.0) node/22.19
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 57

```