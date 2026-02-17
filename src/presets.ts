import type { ModuleInstance } from './main.js'
import { CompanionPresetDefinitions, combineRgb } from '@companion-module/base'

const COLOR_GREEN = combineRgb(0, 204, 0)
const COLOR_WHITE = combineRgb(255, 255, 255)
const COLOR_DARK_BLUE = combineRgb(0, 0, 102)

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

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
