import {
	INodeProperties,
} from 'n8n-workflow';

export const providerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [
					'provider',
				],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a provider',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a provider',
			},
			{
				name: 'Get All',
				value: 'getAll',
				action: 'Get all providers',
			},
            {
				name: 'Get Models',
				value: 'getModels',
				action: 'Get provider models',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a provider',
			},
		],
		default: 'getAll',
	},
];

export const providerFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                provider:create                             */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['create'],
			},
		},
		required: true,
	},
	{
		displayName: 'Base URL',
		name: 'base_url',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['create'],
			},
		},
		required: true,
	},
    {
        displayName: 'Is Active',
        name: 'is_active',
        type: 'boolean',
        default: true,
        displayOptions: {
            show: {
                resource: ['provider'],
                operation: ['create'],
            },
        },
    },

	/* -------------------------------------------------------------------------- */
	/*                                provider:update                             */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Provider ID',
		name: 'providerId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['update', 'delete', 'getModels'],
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
				resource: ['provider'],
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
				displayName: 'Base URL',
				name: 'base_url',
				type: 'string',
				default: '',
			},
            {
                displayName: 'Is Active',
                name: 'is_active',
                type: 'boolean',
                default: true,
            },
		],
	},
];
