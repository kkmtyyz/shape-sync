import { Handler } from "aws-lambda";

type PublishUserEventInput = {
  lobbyId: string;
  userId: string;
  taskToken: string;
  message: string;
};

const APPSYNC_EVENT_URL = process.env.APPSYNC_EVENT_URL;
const APPSYNC_EVENT_API_KEY = process.env.APPSYNC_EVENT_API_KEY;

if (!APPSYNC_EVENT_URL) {
  throw new Error("APPSYNC_EVENT_URL is not defined");
}

if (!APPSYNC_EVENT_API_KEY) {
  throw new Error("APPSYNC_EVENT_API_KEY is not defined");
}

/**
 * AppSync EventsにStepFunctionsタスクトークンとメッセージを持ったイベントを発行する
 * チャネル: `/default/${lobbyId}/${userId}`
 */
export const handler: Handler<PublishUserEventInput, any> =
  async (event) => {
  console.log(event);

  // Step Functionsワークフローからのイベントパース
  const { lobbyId, userId, taskToken, message } = event;
  const channel = `/default/${lobbyId}/${userId}`;

  console.log("channel", channel);

  try {
    // イベント発行
    const response = await fetch(APPSYNC_EVENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APPSYNC_EVENT_API_KEY,
      },
      body: JSON.stringify({
        channel,
        events: [
          JSON.stringify({
            message,
            taskToken,
          }),
        ],
      }),
    });

    const result: any = await response.json();

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      throw new Error("GraphQL query failed");
    }

    console.log("AppSync result:", result.data);
    return result.data;
  } catch (err) {
    console.error("Failed to fetch from AppSync:", err);
    throw err;
  }
};
