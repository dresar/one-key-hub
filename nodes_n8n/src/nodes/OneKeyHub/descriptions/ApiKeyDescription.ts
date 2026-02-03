import {
	INodeProperties,
} from 'n8n-workflow';

export const apiKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [
					'apiKey',
				],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an API key',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an API key',
			},
			{
				name: 'Get All',
				value: 'getAll',
				action: 'Get all API keys',
			},
			{
				name: 'Test',
				value: 'test',
				action: 'Test an API key',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an API key',
			},
		],
		default: 'getAll',
	},
];

export const apiKeyFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                apiKey:create                               */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Provider ID',
		name: 'providerId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['create'],
			},
		},
		required: true,
        description: 'ID of the provider this key belongs to',
	},
	{
		displayName: 'API Key',
		name: 'api_key',
		type: 'string',
        typeOptions: { password: true },
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['create'],
			},
		},
		required: true,
	},
    {
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['create'],
			},
		},
        description: 'Friendly name for this key',
	},
    {
		displayName: 'Model ID',
		name: 'model_id',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['create'],
			},
		},
        description: 'Specific model ID if this key is restricted',
	},
    {
        displayName: 'Priority',
        name: 'priority',
        type: 'number',
        default: 0,
        displayOptions: {
            show: {
                resource: ['apiKey'],
                operation: ['create'],
            },
        },
    },
    {
        displayName: 'Is Active',
        name: 'is_active',
        type: 'boolean',
        default: true,
        displayOptions: {
            show: {
                resource: ['apiKey'],
                operation: ['create'],
            },
        },
    },

	/* -------------------------------------------------------------------------- */
	/*                                apiKey:test                                 */
	/* -------------------------------------------------------------------------- */
    {
		displayName: 'API Key ID',
		name: 'apiKeyId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['test'],
			},
		},
		required: true,
	},
    {
		displayName: 'Provider ID',
		name: 'providerId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['test'],
			},
		},
		required: true,
        description: 'Required by backend to identify provider type',
	},
    {
		displayName: 'Model ID',
		name: 'model_id',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['test'],
			},
		},
        description: 'Model to use for testing (e.g., gpt-3.5-turbo)',
	},
    {
		displayName: 'Message',
		name: 'message',
		type: 'string',
		default: 'Hello, are you working?',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['test'],
			},
		},
	},

	/* -------------------------------------------------------------------------- */
	/*                                apiKey:update                               */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'API Key ID',
		name: 'apiKeyId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['update', 'delete'],
			},
		},
		required: true,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['apiKey'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
            {
				displayName: 'API Key',
				name: 'api_key',
				type: 'string',
                typeOptions: { password: true },
				default: '',
			},
            {
				displayName: 'Model ID',
				name: 'model_id',
				type: 'string',
				default: '',
			},
            {
                displayName: 'Is Active',
                name: 'is_active',
                type: 'boolean',
                default: true,
            },
            {
                displayName: 'Priority',
                name: 'priority',
                type: 'number',
                default: 0,
            }
		],
	},
];
