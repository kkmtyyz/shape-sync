import { defineBackend } from '@aws-amplify/backend';
import * as iam from "aws-cdk-lib/aws-iam";
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { startSfn } from './functions/start-sfn/resource';
import { sendTaskSuccessSfn } from './functions/send-task-success-sfn/resource';
import { AuthorizationType } from 'aws-cdk-lib/aws-appsync'
import { CustomResources } from './custom/resource';

const backend = defineBackend({
  auth,
  data,
  startSfn,
  sendTaskSuccessSfn
});

// startSfnの権限設定
const startSfnLambda = backend.startSfn.resources.lambda;
startSfnLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["states:StartExecution", "ssm:GetParameter"],
    resources: ["*"], // スタックの循環参照になるのでワイルドカードにする
  })
);

// sendTaskSuccessSfnの権限設定
const sendTaskSuccessSfnLambda = backend.sendTaskSuccessSfn.resources.lambda;
sendTaskSuccessSfnLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["states:SendTaskSuccess"],
    resources: ["*"], // スタックの循環参照になるのでワイルドカードにする
  })
);


// GraphQLのURL取得
const graphQlUrl = backend.data.resources.cfnResources.cfnGraphqlApi.attrGraphQlUrl;

// GraphQLのAPIキー取得
const graphQlApiKeyValue = backend.data.resources.cfnResources.cfnApiKey!.attrApiKey;

const customResourceStack = backend.createStack('ShapeSyncCustomResources');
const customResources = new CustomResources(
  customResourceStack,
  'ShapeSyncCustomResources',
  {
      graphQlUrl,
      graphQlApiKeyValue,
  }
);

backend.addOutput({
    custom: {
        events: {
            url: customResources.eventApiUrl,
            api_key: customResources.eventApiKeyValue,
            aws_region: customResourceStack.region,
            default_authorization_type: AuthorizationType.API_KEY,
        },
    },
})

