import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { startSfn } from './functions/start-sfn/resource';
import {
    AuthorizationType,
    CfnApi,
    CfnApiKey,
    CfnChannelNamespace,
} from 'aws-cdk-lib/aws-appsync'

const backend = defineBackend({
  auth,
  data,
  startSfn
});

const customResources = backend.createStack('custom-resources-shape-sync');
const cfnEventAPI = new CfnApi(customResources, 'cfnEventAPI', {
    name: 'realtime-shape-sync',
    eventConfig: {
        authProviders: [{ authType: AuthorizationType.API_KEY }],
        connectionAuthModes: [{ authType: AuthorizationType.API_KEY }],
        defaultPublishAuthModes: [{ authType: AuthorizationType.API_KEY }],
        defaultSubscribeAuthModes: [{ authType: AuthorizationType.API_KEY }],
    },
})

new CfnChannelNamespace(customResources, 'cfnEventAPINamespace', {
    name: 'default',
    apiId: cfnEventAPI.attrApiId,
})

const cfnApiKey = new CfnApiKey(customResources, 'cfnEventAPIKey', {
    apiId: cfnEventAPI.attrApiId,
    description: 'realtime shape-sync',
    expires: 24 * 465,
})

backend.addOutput({
    custom: {
        events: {
            url: `https://${cfnEventAPI.getAtt('Dns.Http').toString()}/event`,
            api_key: cfnApiKey.attrApiKey,
            aws_region: customResources.region,
            default_authorization_type: AuthorizationType.API_KEY,
        },
    },
})

