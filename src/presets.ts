import type { ModuleInstance } from './main.js'
import { CompanionPresetDefinitions, combineRgb } from '@companion-module/base'

const COLOR_GREEN = combineRgb(0, 204, 0)
const COLOR_YELLOW = combineRgb(255, 204, 0)
const COLOR_RED = combineRgb(204, 0, 0)
const COLOR_WHITE = combineRgb(255, 255, 255)
const COLOR_BLACK = combineRgb(0, 0, 0)
const COLOR_DARK_BLUE = combineRgb(0, 0, 102)

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	// Connection Status Preset
	presets['connection_status'] = {
		type: 'button',
		category: 'Connection',
		name: 'Connection Status',
		style: {
			text: 'K-Frame\\nStatus',
			size: 'auto',
			color: COLOR_WHITE,
			bgcolor: COLOR_RED,
			show_topbar: false,
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'connection_connected',
				style: {
					bgcolor: COLOR_GREEN,
					color: COLOR_BLACK,
					text: 'K-Frame\\nConnected',
				},
				options: {},
			},
			{
				feedbackId: 'connection_connecting',
				style: {
					bgcolor: COLOR_YELLOW,
					color: COLOR_BLACK,
					text: 'K-Frame\\nConnecting...',
				},
				options: {},
			},
			{
				feedbackId: 'connection_disconnected',
				style: {
					bgcolor: COLOR_RED,
					color: COLOR_WHITE,
					text: 'K-Frame\\nDisconnected',
				},
				options: {},
			},
		],
	}

	// Macro Presets (1-10)
	for (let i = 1; i <= 10; i++) {
		presets[`macro_${i}`] = {
			type: 'button',
			category: 'Macros',
			name: `Macro ${i}`,
			style: {
				text: `Macro\\n${i}`,
				size: 'auto',
				color: COLOR_WHITE,
				bgcolor: COLOR_DARK_BLUE,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'macro_recall',
							options: {
								macroNum: i,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'macro_sent',
					style: {
						bgcolor: COLOR_GREEN,
					},
					options: {
						macroNum: i,
					},
				},
			],
		}
	}

	// AUX Route Template Preset
	presets['aux_route_template'] = {
		type: 'button',
		category: 'AUX',
		name: 'AUX Route Template',
		style: {
			text: 'AUX 1\\n→ Src 1',
			size: 'auto',
			color: COLOR_WHITE,
			bgcolor: COLOR_DARK_BLUE,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'aux_route',
						options: {
							auxNum: 1,
							sourceMode: 'list',
							sourceNum: 1,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'aux_sent',
				style: {
					bgcolor: COLOR_GREEN,
				},
				options: {
					auxNum: 1,
				},
			},
		],
	}

	self.setPresetDefinitions(presets)
}
