import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import type { Schema } from "../../data/resource";

const sfnClient = new SFNClient({});
const ssm = new SSMClient({});

/**
 * Step FunctionsワークフローのARNを環境変数から取得する
 */
async function getStateMachineArn(): Promise<string> {
  const paramName = process.env.STATE_MACHINE_ARN_PARAM;
  if (!paramName) {
    throw new Error("STATE_MACHINE_ARN_PARAM not set");
  }

  const result = await ssm.send(
    new GetParameterCommand({
      Name: paramName,
    })
  );

  if (!result.Parameter?.Value) {
    throw new Error("StateMachine ARN not found in SSM");
  }

  return result.Parameter.Value;
}

/**
 * Step Functionsワークフローを実行する
 * 実行時にワークフローにロビーIDを渡す
 */
export const handler: Schema["startSfn"]["functionHandler"] = async (event) => {
  const { lobby_id } = event.arguments;
  console.log("Lobby ID:", lobby_id);

  // ステートマシンのARN取得
  const stateMachineArn = await getStateMachineArn();

  // 実行パラメータを設定
  const input = JSON.stringify({
    lobby_id,
  });

  try {
    // ワークフロー実行
    const command = new StartExecutionCommand({
      stateMachineArn,
      input,
    });

    const response = await sfnClient.send(command);

    console.log("Step Function started:", response.executionArn);

    return `Started Step Function for ${lobby_id}`;
  } catch (error) {
    console.error("Error starting Step Function:", error);
    throw new Error("Step Function execution failed");
  }
};

