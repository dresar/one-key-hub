import {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
    IHttpRequestMethods,
} from 'n8n-workflow';

import {
	chatOperations,
	chatFields,
} from './descriptions/ChatDescription';

import {
	providerOperations,
	providerFields,
} from './descriptions/ProviderDescription';

import {
	apiKeyOperations,
	apiKeyFields,
} from './descriptions/ApiKeyDescription';

import {
	unifiedKeyOperations,
	unifiedKeyFields,
} from './descriptions/UnifiedKeyDescription';

export class OneKeyHub implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'One Key Hub',
		name: 'oneKeyHub',
		icon: 'file:oneKeyHub.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with One Key Hub API',
		defaults: {
			name: 'One Key Hub',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'oneKeyHubApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'API Key',
						value: 'apiKey',
					},
					{
						name: 'Chat',
						value: 'chat',
					},
					{
						name: 'Provider',
						value: 'provider',
					},
					{
						name: 'Unified Key',
						value: 'unifiedKey',
					},
				],
				default: 'chat',
			},
			...chatOperations,
			...chatFields,
			...providerOperations,
			...providerFields,
			...apiKeyOperations,
			...apiKeyFields,
			...unifiedKeyOperations,
			...unifiedKeyFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const length = items.length;
		const qs: IDataObject = {};
		let responseData;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

        // Get Credentials
        const credentials = await this.getCredentials('oneKeyHubApi');
        const baseUrl = (credentials.url as string).replace(/\/$/, ''); // Remove trailing slash
        const accessToken = credentials.accessToken as string;

		for (let i = 0; i < length; i++) {
			try {
                let method: IHttpRequestMethods = 'GET';
                let endpoint = '';
                let body: IDataObject = {};
                let headers: IDataObject = {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                };

				if (resource === 'chat') {
					if (operation === 'completions') {
                        method = 'POST';
                        endpoint = '/v1/chat/completions';
                        const model = this.getNodeParameter('model', i) as string;
                        const messages = this.getNodeParameter('messages', i) as IDataObject;
                        const stream = this.getNodeParameter('stream', i) as boolean;
                        
                        // Handle Fixed Collection for messages
                        let messagesList: IDataObject[] = [];
                        if (messages && messages.values) {
                            messagesList = messages.values as IDataObject[];
                        }

                        body = {
                            model,
                            messages: messagesList,
                            stream
                        };
					}
				} else if (resource === 'provider') {
                    if (operation === 'getAll') {
                        method = 'GET';
                        endpoint = '/providers';
                    } else if (operation === 'create') {
                        method = 'POST';
                        endpoint = '/providers';
                        body = {
                            name: this.getNodeParameter('name', i),
                            base_url: this.getNodeParameter('base_url', i),
                            is_active: this.getNodeParameter('is_active', i),
                        };
                    } else if (operation === 'update') {
                        method = 'PUT';
                        const providerId = this.getNodeParameter('providerId', i);
                        endpoint = `/providers/${providerId}`;
                        const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
                        Object.assign(body, updateFields);
                    } else if (operation === 'delete') {
                        method = 'DELETE';
                        const providerId = this.getNodeParameter('providerId', i);
                        endpoint = `/providers/${providerId}`;
                    } else if (operation === 'getModels') {
                        method = 'GET';
                        const providerId = this.getNodeParameter('providerId', i);
                        endpoint = `/providers/${providerId}/models`;
                    }
                } else if (resource === 'apiKey') {
                    if (operation === 'getAll') {
                        method = 'GET';
                        endpoint = '/api-keys';
                    } else if (operation === 'create') {
                        method = 'POST';
                        endpoint = '/api-keys';
                        body = {
                            provider_id: this.getNodeParameter('providerId', i),
                            api_key: this.getNodeParameter('api_key', i),
                            name: this.getNodeParameter('name', i),
                            model_id: this.getNodeParameter('model_id', i),
                            priority: this.getNodeParameter('priority', i),
                            is_active: this.getNodeParameter('is_active', i),
                        };
                    } else if (operation === 'update') {
                        method = 'PUT';
                        const apiKeyId = this.getNodeParameter('apiKeyId', i);
                        endpoint = `/api-keys/${apiKeyId}`;
                        const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
                        Object.assign(body, updateFields);
                    } else if (operation === 'delete') {
                        method = 'DELETE';
                        const apiKeyId = this.getNodeParameter('apiKeyId', i);
                        endpoint = `/api-keys/${apiKeyId}`;
                    } else if (operation === 'test') {
                        method = 'POST';
                        endpoint = '/api-keys/test';
                        body = {
                            api_key_id: this.getNodeParameter('apiKeyId', i),
                            provider_id: this.getNodeParameter('providerId', i),
                            model_id: this.getNodeParameter('model_id', i),
                            message: this.getNodeParameter('message', i),
                        };
                    }
                } else if (resource === 'unifiedKey') {
                    if (operation === 'getAll') {
                        method = 'GET';
                        endpoint = '/unified/keys';
                    } else if (operation === 'create') {
                        method = 'POST';
                        endpoint = '/unified/keys';
                        body = {
                            name: this.getNodeParameter('name', i),
                        };
                    } else if (operation === 'getStats') {
                        method = 'GET';
                        endpoint = '/unified/stats';
                    }
                }

                const options = {
                    method,
                    uri: `${baseUrl}${endpoint}`,
                    body,
                    headers,
                    json: true,
                    qs,
                };

                responseData = await this.helpers.request(options);
                
                // If the response is an array, we might want to return multiple items
                // But n8n expects one item per input item unless we split it.
                // For 'getAll', it returns an array. Standard practice is to return it as 'data' property or just the array if it's the only thing.
                // But for "execute" returning INodeExecutionData[], we usually map the result.
                
                if (Array.isArray(responseData)) {
                    // If operation is getAll, we might want to split.
                    // But here we'll just wrap it for now or return as is in json.
                    // If user wants to split, they can use Item Lists node.
                    // Or we can return [ { json: { data: responseData } } ]
                }

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData as IDataObject[]),
					{ itemData: { item: i } },
				);

				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
