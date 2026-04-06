/**
 * frontend/pages/migrate.jsx
 * Full 5-step migration wizard — layman-friendly version.
 * Steps: 0 Source → 1 Configure → 2 Pay → 3 Running → 4 Done
 *
 * Task 13: Added "Paste / Upload ZIP" as a 4th source option in Step 0.
 * Task 19: Added AgentChat overlay + preScan health card in StepRunning.
 *
 * Bug fixes:
 *  - [HIGH]   localStorage wrapped in try/catch for sandboxed environments (handleUploadAndContinue + handleStart)
 *  - [MEDIUM] sessionStorage wrapped in try/catch for sandboxed environments
 *  - [MEDIUM] uploadDone now resets when switching between paste/zip uploadMode
 *  - [LOW]    Continue button uses conditional render instead of display:'none'
 *  - [LOW]    ZIP file list keys use index+path to avoid collisions
 */