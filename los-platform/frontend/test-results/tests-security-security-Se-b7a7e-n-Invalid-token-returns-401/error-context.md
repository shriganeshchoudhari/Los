# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\security\security.spec.ts >> Security Tests — LOS Platform >> Authentication & Authorization >> Invalid token returns 401
- Location: tests\security\security.spec.ts:104:9

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:3001
Call log:
  - → GET http://localhost:3001/applications
    - user-agent: Playwright/1.59.1 (x64; windows 10.0) node/22.19
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - Authorization: Bearer invalid.token.here

```