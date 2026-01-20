import { SQSHandler, SQSEvent, SQSRecord } from 'aws-lambda';
import { processInfo } from './services/processor';
import { SQSMessage } from './types';

/**
 * AI Agent Lambda Handler
 *
 * Receives messages from SQS containing raw information (ProjectInfo or MarketInfo)
 * and processes them using AI to update project entities.
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('AI Agent invoked with', event.Records.length, 'messages');

  const results = await Promise.allSettled(
    event.Records.map(record => processRecord(record))
  );

  // Log results
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`Processing complete: ${succeeded} succeeded, ${failed} failed`);

  // If any failed, throw to trigger partial batch failure
  const failures = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason);

  if (failures.length > 0) {
    console.error('Failures:', failures);
    // In production, you might want to handle partial batch failures differently
    // For now, we'll log the errors but not throw to avoid reprocessing all messages
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const messageId = record.messageId;
  console.log(`Processing message ${messageId}`);

  try {
    const message: SQSMessage = JSON.parse(record.body);
    await processInfo(message);
    console.log(`Successfully processed message ${messageId}`);
  } catch (error) {
    console.error(`Failed to process message ${messageId}:`, error);
    throw error;
  }
}
