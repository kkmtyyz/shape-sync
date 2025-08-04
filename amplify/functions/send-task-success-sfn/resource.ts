import { defineFunction } from '@aws-amplify/backend';

export const sendTaskSuccessSfn = defineFunction({
  // optionally specify a name for the Function (defaults to directory name)
  name: 'send-task-success-sfn',
  // optionally specify a path to your handler (defaults to "./handler.ts")
  entry: './handler.ts'
});
