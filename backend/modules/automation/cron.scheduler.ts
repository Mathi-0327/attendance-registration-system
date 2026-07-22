/**
 * @file backend/modules/automation/cron.scheduler.ts
 * @description Scheduled background jobs using node-cron.
 * Daily absence check runs at 6 PM every day.
 */

import cron from "node-cron";
import { workflowDispatcher } from "./workflow.dispatcher";

let absenceCheckJob: ReturnType<typeof cron.schedule> | null = null;

export const cronScheduler = {
  start() {
    // Daily absence check at 6:00 PM (India time)
    absenceCheckJob = cron.schedule(
      "0 18 * * *",
      async () => {
        console.log("[cron] Running daily absence check...");
        const result = await workflowDispatcher.runAbsenceCheck();
        console.log(`[cron] Done. Checked: ${result.checked}, Alerted: ${result.alerted}`);
      },
      { timezone: "Asia/Kolkata" }
    );

    console.log("[cron] Scheduler started. Daily absence check: 6:00 PM IST.");
  },

  stop() {
    absenceCheckJob?.stop();
    absenceCheckJob = null;
    console.log("[cron] Scheduler stopped.");
  },

  async runNow(): Promise<{ checked: number; alerted: number }> {
    console.log("[cron] Manual absence check triggered.");
    return workflowDispatcher.runAbsenceCheck();
  },
};
