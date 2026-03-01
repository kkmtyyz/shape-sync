import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import type { Schema } from "../../data/resource";

const client = new SFNClient({ region: "ap-northeast-1" });

/**
 * StepFunctionsのコールバックとしてタスクトークンを返す
 */
export const handler: Schema["sendTaskSuccessSfn"]["functionHandler"] = async (event) => {
  const { taskToken } = event.arguments;

  if (!taskToken) {
    throw new Error("taskToken is required");
  }

  try {
    // 今のところ常にSuccessとして返す
    const command = new SendTaskSuccessCommand({
      taskToken,
      output: JSON.stringify({ message: "success" }), // outputはJSON文字列で渡す
    });
    await client.send(command);
    console.log("SendTaskSuccess succeeded");
    return "success";
  } catch (error) {
    console.error("SendTaskSuccess failed:", error);
    throw error;
  }
};


