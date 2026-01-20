import { Regex, type SomeCompanionConfigField } from '@companion-module/base'
import { DEFAULT_CONFIG } from './udp/types.js'

export interface ModuleConfig {
	host: string
	keepaliveInterval: number
	maxRetries: number
	suite: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'K-Frame IP Address',
			width: 6,
			regex: Regex.IP,
			required: true,
		},
		{
			type: 'dropdown',
			id: 'suite',
			label: 'Default Suite Name',
			width: 3,
			choices: [
				{ id: 'suite1a', label: '1a' },
				{ id: 'suite1b', label: '1b' },
				{ id: 'suite2a', label: '2a' },
				{ id: 'suite2b', label: '2b' },
				{ id: 'suite3a', label: '3a' },
				{ id: 'suite3b', label: '3b' },
				{ id: 'suite4a', label: '4a' },
				{ id: 'suite4b', label: '4b' },
			],
			default: 'suite1a',
		},
		{
			type: 'number',
			id: 'keepaliveInterval',
			label: 'Keepalive Interval (ms)',
			width: 3,
			min: 500,
			max: 10000,
			default: DEFAULT_CONFIG.KEEPALIVE_INTERVAL,
			required: true,
		},
		{
			type: 'number',
			id: 'maxRetries',
			label: 'Max Reconnection Attempts',
			width: 3,
			min: 1,
			max: 20,
			default: DEFAULT_CONFIG.MAX_RETRIES,
			required: true,
		},
	]
}
