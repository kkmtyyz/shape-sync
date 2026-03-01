import { defineFunction } from '@aws-amplify/backend';

export const sendTaskSuccessSfn = defineFunction({
  name: 'send-task-success-sfn',
  entry: './handler.ts',
  memoryMB: 1024,
  timeoutSeconds: 60
});
