/**
 * SQS Queues
 *
 * Message queues for async processing.
 */

// Dead Letter Queue for failed messages
export const dlq = new sst.aws.Queue("InfoProcessingDLQ", {
  // SST handles retention period
});

// Main processing queue for AI Agent
export const infoProcessingQueue = new sst.aws.Queue("InfoProcessingQueue", {
  dlq: {
    queue: dlq.arn,
    retry: 3,
  },
  visibilityTimeout: "6 minutes",
});

export const queue = {
  infoProcessingQueue,
  dlq,
};
