import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { ConnectionState } from './udp/types.js'

// Colors
const COLOR_GREEN = combineRgb(0, 204, 0)
const COLOR_BLACK = combineRgb(0, 0, 0)

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		connection_status: {
			name: 'Connection Status',
			description: 'Change button style based on K-Frame connection status',
			type: 'boolean',
			defaultStyle: {
				bgcolor: COLOR_GREEN,
				color: COLOR_BLACK,
			},
			options: [
				{
					id: 'state',
					type: 'dropdown',
					label: 'When state is',
					default: ConnectionState.Connected,
					choices: [
						{ id: ConnectionState.Connected, label: 'Connected' },
						{ id: ConnectionState.Connecting, label: 'Connecting' },
						{ id: ConnectionState.Handshaking, label: 'Handshaking' },
						{ id: ConnectionState.Reconnecting, label: 'Reconnecting' },
						{ id: ConnectionState.Disconnected, label: 'Disconnected' },
					],
				},
			],
			callback: (feedback) => {
				const targetState = feedback.options.state as ConnectionState
				return self.getConnectionState() === targetState
			},
		},

		macro_sent: {
			name: 'Macro Sent',
			description: 'Briefly true when a macro command is sent',
			type: 'boolean',
			defaultStyle: {
				bgcolor: COLOR_GREEN,
				color: COLOR_BLACK,
			},
			options: [
				{
					id: 'macroNum',
					type: 'number',
					label: 'Macro Number (0 = any)',
					default: 0,
					min: 0,
					max: 999,
				},
			],
			callback: (feedback) => {
				const macroNum = Number(feedback.options.macroNum)
				if (macroNum === 0) {
					return self.lastMacroSent !== null
				}
				return self.lastMacroSent === macroNum
			},
		},

		aux_sent: {
			name: 'AUX Route Sent',
			description: 'Briefly true when an AUX route command is sent',
			type: 'boolean',
			defaultStyle: {
				bgcolor: COLOR_GREEN,
				color: COLOR_BLACK,
			},
			options: [
				{
					id: 'auxNum',
					type: 'number',
					label: 'AUX Number (0 = any)',
					default: 0,
					min: 0,
					max: 96,
				},
			],
			callback: (feedback) => {
				const auxNum = Number(feedback.options.auxNum)
				if (auxNum === 0) {
					return self.lastAuxSent !== null
				}
				return self.lastAuxSent === auxNum
			},
		},
	})
}
