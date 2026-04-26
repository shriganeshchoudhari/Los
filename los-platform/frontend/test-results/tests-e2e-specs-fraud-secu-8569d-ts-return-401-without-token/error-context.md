# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\specs\fraud-security.spec.ts >> TC-SEC-001: Security & Accessibility >> C001-P02: API endpoints return 401 without token
- Location: tests\e2e\specs\fraud-security.spec.ts:89:7

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:3001
Call log:
  - → GET http://localhost:3001/applications
    - user-agent: Playwright/1.59.1 (x64; windows 10.0) node/22.19
    - accept: */*
    - accept-encoding: gzip,deflate,br

```