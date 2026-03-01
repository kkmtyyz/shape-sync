import { defineFunction } from '@aws-amplify/backend';

export const startSfn = defineFunction({
  name: 'start-sfn',
  entry: './handler.ts',
  memoryMB: 1024,
  timeoutSeconds: 60,
  environment: {
    // 実行するステートマシンARNのパラメーター名
    STATE_MACHINE_ARN_PARAM: '/shapesync/stateMachineArn',
  },
});
