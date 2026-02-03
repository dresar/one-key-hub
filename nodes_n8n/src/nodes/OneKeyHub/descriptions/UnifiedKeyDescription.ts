import {
	INodeProperties,
} from 'n8n-workflow';

export const unifiedKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [
					'unifiedKey',
				],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a unified key',
			},
			{
				name: 'Get All',
				value: 'getAll',
				action: 'Get all unified keys',
			},
            {
				name: 'Get Stats',
				value: 'getStats',
				action: 'Get unified key stats',
			},
		],
		default: 'getAll',
	},
];

export const unifiedKeyFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                unifiedKey:create                           */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['unifiedKey'],
				operation: ['create'],
			},
		},
        description: 'Name for the unified key',
		required: true,
	},
];
