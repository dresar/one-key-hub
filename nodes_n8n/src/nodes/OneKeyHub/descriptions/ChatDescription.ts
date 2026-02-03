import {
	INodeProperties,
} from 'n8n-workflow';

export const chatOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [
					'chat',
				],
			},
		},
		options: [
			{
				name: 'Completion',
				value: 'completions',
				action: 'Chat completion',
				description: 'Generate a chat completion',
			},
		],
		default: 'completions',
	},
];

export const chatFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                chat:completions                            */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Model Name',
		name: 'model',
		type: 'string',
		default: 'gpt-3.5-turbo',
		displayOptions: {
			show: {
				resource: [
					'chat',
				],
				operation: [
					'completions',
				],
			},
		},
		description: 'ID of the model to use',
        required: true,
	},
	{
		displayName: 'Messages',
		name: 'messages',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: {
			show: {
				resource: [
					'chat',
				],
				operation: [
					'completions',
				],
			},
		},
		options: [
			{
				displayName: 'Message',
				name: 'values',
				values: [
					{
						displayName: 'Role',
						name: 'role',
						type: 'options',
						options: [
							{
								name: 'System',
								value: 'system',
							},
							{
								name: 'User',
								value: 'user',
							},
							{
								name: 'Assistant',
								value: 'assistant',
							},
						],
						default: 'user',
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						default: '',
                        typeOptions: {
                            rows: 4,
                        },
					},
				],
			},
		],
		description: 'Messages to send to the model',
	},
    {
        displayName: 'Stream',
        name: 'stream',
        type: 'boolean',
        default: false,
        displayOptions: {
            show: {
                resource: ['chat'],
                operation: ['completions'],
            },
        },
        description: 'Whether to stream back partial progress',
    },
];
