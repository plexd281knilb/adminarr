import { performSync } from "@/app/data";
import { scanEmailAccounts } from "@/lib/email-scanner";
import { checkOverdueStatus } from "@/app/actions"; // <--- Import this

// Prevent multiple instances in development
let isCronRunning = false;

export function initCron() {
  if (isCronRunning) return;
  isCronRunning = true;

  console.log("Initializing Job Scheduler...");

  // --- JOB 1: TAUTULLI SYNC ---
  const runSyncJob = async () => {
    console.log("Cron: Starting Tautulli Sync...");
    try {
      await performSync();
      console.log("Cron: Sync Complete.");
    } catch (e) {
      console.error("Cron: Sync Failed", e);
    }
  };

  // --- JOB 2: EMAIL SCAN ---
  const runScanJob = async () => {
    console.log("Cron: Starting Email Scan...");
    try {
      const result = await scanEmailAccounts();
      console.log("Cron: Email Scan Complete.", result.logs[result.logs.length - 1]);
    } catch (e) {
      console.error("Cron: Email Scan Failed", e);
    }
  };

  // --- JOB 3: OVERDUE CHECK ---
  const runOverdueJob = async () => {
    console.log("Cron: Checking Overdue Status...");
    try {
      await checkOverdueStatus();
      console.log("Cron: Overdue Check Complete.");
    } catch (e) {
      console.error("Cron: Overdue Check Failed", e);
    }
  };

  // Run immediately on server start
  runSyncJob();
  runScanJob();
  runOverdueJob(); // <--- Run immediately

  // Schedule for every 60 minutes
  setInterval(runSyncJob, 1000 * 60 * 60);
  setInterval(runScanJob, 1000 * 60 * 60);
  setInterval(runOverdueJob, 1000 * 60 * 60); // <--- Schedule hourly
}