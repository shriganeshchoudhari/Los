# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\specs\kyc.spec.ts >> TC-KYC-002: KYC Reuse >> C002-P01: Prior valid KYC reused within 10-year window
- Location: tests\e2e\specs\kyc.spec.ts:147:7

# Error details

```
Error: browserType.launch: Executable doesn't exist at C:\Users\shrig\AppData\Local\ms-playwright\chromium_headless_shell-1217\chrome-headless-shell-win64\chrome-headless-shell.exe
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```