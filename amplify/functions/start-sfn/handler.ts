/*
import type { Schema } from "../../data/resource"

export const handler: Schema["startSfn"]["functionHandler"] = async (event) => {
  // arguments typed from `.arguments()`
  const { name, lobby_id } = event.arguments
  console.log(name);
  console.log(lobby_id);
  // return typed from `.returns()`
  return `Hello, ${name}!`
}
*/
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import type { Schema } from "../../data/resource";

const sfnClient = new SFNClient({});

// Lambda Handler
export const handler: Schema["startSfn"]["functionHandler"] = async (event) => {
  const { name, lobby_id } = event.arguments;

  console.log("Name:", name);
  console.log("Lobby ID:", lobby_id);

  // Step Function の ARN（環境変数に入れるのが推奨）
  const stateMachineArn = process.env.STATE_MACHINE_ARN ?? "arn:aws:states:ap-northeast-1:546121383926:stateMachine:game";

  // 実行パラメータを設定
  const input = JSON.stringify({
    name,
    lobby_id,
  });

  try {
    const command = new StartExecutionCommand({
      stateMachineArn,
      input,
    });

    const response = await sfnClient.send(command);

    console.log("Step Function started:", response.executionArn);

    return `Started Step Function for ${name}`;
  } catch (error) {
    console.error("Error starting Step Function:", error);
    throw new Error("Step Function execution failed");
  }
};

