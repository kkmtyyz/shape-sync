import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as url from 'node:url';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import {
    AuthorizationType,
    CfnApi,
    CfnApiKey,
    CfnChannelNamespace,
} from 'aws-cdk-lib/aws-appsync';

interface CustomResourcesProps {
  graphQlUrl: string;
  graphQlApiKeyValue: string;
}

export class CustomResources extends Construct {
  eventApiUrl: string;
  eventApiKeyValue: string;

  constructor(scope: Construct, id: string, props: CustomResourcesProps) {
    super(scope, id);

    // AppSync Events API
    const cfnEventAPI = new CfnApi(this, 'CfnEventAPI', {
        name: 'realtime-shape-sync',
        eventConfig: {
            authProviders: [{ authType: AuthorizationType.API_KEY }],
            connectionAuthModes: [{ authType: AuthorizationType.API_KEY }],
            defaultPublishAuthModes: [{ authType: AuthorizationType.API_KEY }],
            defaultSubscribeAuthModes: [{ authType: AuthorizationType.API_KEY }],
        },
    });
    new CfnChannelNamespace(this, 'CfnEventAPINamespace', {
        name: 'default',
        apiId: cfnEventAPI.attrApiId,
    });
    const cfnApiKey = new CfnApiKey(this, 'CfnEventAPIKey', {
        apiId: cfnEventAPI.attrApiId,
        description: 'realtime shape-sync',
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    });

    // フロントエンドアプリに渡すため、backend.tsのoutuputに含める必要があるのでメンバ変数に持つ
    this.eventApiUrl = `https://${cfnEventAPI.getAtt('Dns.Http').toString()}/event`;
    this.eventApiKeyValue = cfnApiKey.attrApiKey;

    // Lambda Functions
    const publisUserEvnetFunction = new lambda.NodejsFunction(this, 'PublishUserEvent', {
      entry: url.fileURLToPath(new URL('publish_user_event.ts', import.meta.url)),
      environment: {
        APPSYNC_EVENT_URL: this.eventApiUrl,
        APPSYNC_EVENT_API_KEY: this.eventApiKeyValue
      },
      runtime: Runtime.NODEJS_22_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
    });

    const initializeGameFunction = new lambda.NodejsFunction(this, 'InitializeGame', {
      entry: url.fileURLToPath(new URL('initialize_game.ts', import.meta.url)),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
    });


    // EventBridge Connections
    const graphqlConnection = new events.CfnConnection(this, 'AppSyncGraphQLConnection', {
      name: 'shape-sync-graphql',
      authorizationType: 'API_KEY',
      authParameters: {
        apiKeyAuthParameters: {
          apiKeyName: 'x-api-key',
          apiKeyValue: props.graphQlApiKeyValue,
        },
      },
    });

    const eventConnection = new events.CfnConnection(this, 'AppSyncEventConnection', {
      name: 'shape-sync-event',
      authorizationType: 'API_KEY',
      authParameters: {
        apiKeyAuthParameters: {
          apiKeyName: 'x-api-key',
          apiKeyValue: this.eventApiKeyValue,
        },
      },
    });


    // Step Functions StateMachineRole
    const region  = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;

    const role = new iam.Role(this, 'StateMachineRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${region}:${accountId}:function:*`],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['states:InvokeHTTPEndpoint'],
      resources: ['*'],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['events:RetrieveConnectionCredentials'],
      resources: [
        graphqlConnection.attrArn,
        eventConnection.attrArn,
      ],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
      resources: [`arn:aws:secretsmanager:${region}:${accountId}:secret:events!connection/*`],
    }));

    // Step Functions StateMachine Definition
    const definition = {
      Comment: 'ShapeSync StateMachine',
      StartAt: 'Set lobbyId',
      States: {
        // 入力からロビーIDを取得
        'Set lobbyId': {
          Type: 'Pass',
          Next: 'Get UserIds',
          Assign: {
            lobbyId: '{% $states.input.lobby_id %}',
          },
        },
        // GraphQLでロビーにいるユーザーIDを取得
        'Get UserIds': {
          Type: 'Task',
          Resource: 'arn:aws:states:::http:invoke',
          Arguments: {
            ApiEndpoint: props.graphQlUrl,
            Method: 'POST',
            InvocationConfig: {
              ConnectionArn: graphqlConnection.attrArn,
            },
            RequestBody: {
              query: '{% \'query ListUserLobbiesByLobbyId { listUserLobbies(filter: { lobby_id: { eq: "\' & $lobbyId & \'" } }) { items { id } } }\' %}',
            },
          },
          Retry: [{
            ErrorEquals: ['States.ALL'],
            BackoffRate: 2,
            IntervalSeconds: 1,
            MaxAttempts: 3,
            JitterStrategy: 'FULL',
          }],
          Next: 'Confirm Ready',
          Assign: {
            userIds: '{% $states.result.ResponseBody.data.listUserLobbies.items %}',
          },
        },
        // ユーザーのゲーム開始承認を待つMap
        'Confirm Ready': {
          Type: 'Map',
          ItemProcessor: {
            ProcessorConfig: { Mode: 'INLINE' },
            StartAt: 'Confirm Ready Lambda',
            States: {
              'Confirm Ready Lambda': {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                Arguments: {
                  FunctionName: publisUserEvnetFunction.functionArn,
                  Payload: {
                    lobbyId: '{% $lobbyId %}',
                    userId: '{% $states.input.id %}',
                    taskToken: '{% $states.context.Task.Token %}',
                    message: 'confirm_start_ready',
                  },
                },
                Retry: [{
                  ErrorEquals: ['Lambda.ServiceException', 'Lambda.AWSLambdaException', 'Lambda.SdkClientException', 'Lambda.TooManyRequestsException'],
                  IntervalSeconds: 1,
                  MaxAttempts: 3,
                  BackoffRate: 2,
                  JitterStrategy: 'FULL',
                }],
                End: true,
                Output: {},
              },
            },
          },
          Next: 'publish start ready',
          Items: '{% $userIds %}',
        },
        // 全ユーザーにゲームの準備開始イベントを送信
        'publish start ready': {
          Type: 'Task',
          Resource: 'arn:aws:states:::http:invoke',
          Arguments: {
            ApiEndpoint: this.eventApiUrl,
            Method: 'POST',
            InvocationConfig: {
              ConnectionArn: eventConnection.attrArn,
            },
            RequestBody: {
              channel: '{% \'/default/\' & $lobbyId %}',
              events: ['{"message": "start_ready"}'],
            },
          },
          Retry: [{
            ErrorEquals: ['States.ALL'],
            BackoffRate: 2,
            IntervalSeconds: 1,
            MaxAttempts: 3,
            JitterStrategy: 'FULL',
          }],
          Next: 'Initialize Game',
        },
        // ゲームの初期化用Lambda関数を実行
        'Initialize Game': {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Output: '{% $states.result.Payload %}',
          Arguments: {
            FunctionName: initializeGameFunction.functionArn,
            Payload: {
              userIds: '{% $userIds %}',
            },
          },
          Retry: [{
            ErrorEquals: ['Lambda.ServiceException', 'Lambda.AWSLambdaException', 'Lambda.SdkClientException', 'Lambda.TooManyRequestsException'],
            IntervalSeconds: 1,
            MaxAttempts: 3,
            BackoffRate: 2,
            JitterStrategy: 'FULL',
          }],
          Next: 'Wait1',
          Assign: {
            answer: '{% $states.result.Payload.answer %}',
          },
        },
        // クライアントの画面遷移を待つために1秒待つ
        Wait1: {
          Type: 'Wait',
          Seconds: 1,
          Next: 'Confirm Start Game',
        },
        // 全ユーザーのゲーム開始準備完了を待つMap
        'Confirm Start Game': {
          Type: 'Map',
          ItemProcessor: {
            ProcessorConfig: { Mode: 'INLINE' },
            StartAt: 'Confirm Start Game Lambda',
            States: {
              'Confirm Start Game Lambda': {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                Arguments: {
                  FunctionName: publisUserEvnetFunction.functionArn,
                  Payload: {
                    lobbyId: '{% $lobbyId %}',
                    userId: '{% $states.input.id %}',
                    taskToken: '{% $states.context.Task.Token %}',
                    message: '{% $answer %}',
                  },
                },
                Retry: [{
                  ErrorEquals: ['Lambda.ServiceException', 'Lambda.AWSLambdaException', 'Lambda.SdkClientException', 'Lambda.TooManyRequestsException'],
                  IntervalSeconds: 1,
                  MaxAttempts: 3,
                  BackoffRate: 2,
                  JitterStrategy: 'FULL',
                }],
                End: true,
                Output: {},
              },
            },
          },
          Next: 'publish start game',
          Items: '{% $userIds %}',
        },
        // 全ユーザーにゲーム開始イベントを送信
        'publish start game': {
          Type: 'Task',
          Resource: 'arn:aws:states:::http:invoke',
          Arguments: {
            ApiEndpoint: this.eventApiUrl,
            Method: 'POST',
            InvocationConfig: {
              ConnectionArn: eventConnection.attrArn,
            },
            RequestBody: {
              channel: '{% \'/default/\' & $lobbyId %}',
              events: ['{"message": "start_game"}'],
            },
          },
          Retry: [{
            ErrorEquals: ['States.ALL'],
            BackoffRate: 2,
            IntervalSeconds: 1,
            MaxAttempts: 3,
            JitterStrategy: 'FULL',
          }],
          Next: 'Wait2',
        },
        // 画面遷移のために1秒待つ
        Wait2: {
          Type: 'Wait',
          Seconds: 1,
          Next: 'Confirm End Game',
        },
        // 全ユーザーのゲーム完了を待つMap
        'Confirm End Game': {
          Type: 'Map',
          ItemProcessor: {
            ProcessorConfig: { Mode: 'INLINE' },
            StartAt: 'Confirm End Game Lambda',
            States: {
              'Confirm End Game Lambda': {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                Arguments: {
                  FunctionName: publisUserEvnetFunction.functionArn,
                  Payload: {
                    lobbyId: '{% $lobbyId %}',
                    userId: '{% $states.input.id %}',
                    taskToken: '{% $states.context.Task.Token %}',
                    message: '{% $answer %}',
                  },
                },
                Retry: [{
                  ErrorEquals: ['Lambda.ServiceException', 'Lambda.AWSLambdaException', 'Lambda.SdkClientException', 'Lambda.TooManyRequestsException'],
                  IntervalSeconds: 1,
                  MaxAttempts: 3,
                  BackoffRate: 2,
                  JitterStrategy: 'FULL',
                }],
                End: true,
                Output: {},
              },
            },
          },
          Items: '{% $userIds %}',
          End: true,
        },
      },
      QueryLanguage: 'JSONata',
    };

    const stateMachine = new sfn.StateMachine(this, 'ShapeSyncStateMachine', {
      definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition)),
      role,
      stateMachineType: sfn.StateMachineType.STANDARD,
    });

    // Lambda関数startSfnからステートマシンを実行できるようにパラメーターストアにARNを保存
    new ssm.StringParameter(this, 'StateMachineArnParameter', {
      parameterName: '/shapesync/stateMachineArn',
      stringValue: stateMachine.stateMachineArn,
    });
  }
}
