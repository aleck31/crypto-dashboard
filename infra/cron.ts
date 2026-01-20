/**
 * Scheduled Jobs (Cron)
 *
 * EventBridge rules for scheduled tasks.
 */

import { collectorHandler } from "./api";

// Run collector every 15 minutes
export const collectorSchedule = new sst.aws.Cron("CollectorSchedule", {
  schedule: "rate(15 minutes)",
  job: collectorHandler.arn,
});

export const cron = {
  collectorSchedule,
};
