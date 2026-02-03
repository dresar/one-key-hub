import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OneKeyHubApi implements ICredentialType {
	name = 'oneKeyHubApi';
	displayName = 'One Key Hub API';
	documentationUrl = 'https://github.com/your-repo/one-key-hub';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'url',
			type: 'string',
			default: 'http://localhost:3000/api',
            placeholder: 'http://localhost:3000/api',
			description: 'The Base URL of the One Key Hub API.',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
            description: 'The JWT Access Token for dashboard operations, or Unified API Key for Gateway operations.',
		},
	];
}
