import type { ModuleInstance } from './main.js'

// Source labels for AUX routing dropdown
const sourceLabels: Record<number, string> = {
	701: 'M1A',
	702: 'M1B',
	703: 'M1C',
	704: 'M1D',
	705: 'M1pA',
	706: 'M1pC',
	707: 'M1pM',
	708: 'M2A',
	709: 'M2B',
	710: 'M2C',
	711: 'M2D',
	712: 'M2pA',
	713: 'M2pC',
	714: 'M2pM',
	715: 'M3A',
	716: 'M3B',
	717: 'M3C',
	718: 'M3D',
	719: 'M3pA',
	720: 'M3pC',
	721: 'M3pM',
	722: 'M4A',
	723: 'M4B',
	724: 'M4C',
	725: 'M4D',
	726: 'M4pA',
	727: 'M4pC',
	728: 'M4pM',
	729: 'PgA',
	730: 'PgB',
	731: 'PgC',
	732: 'PgD',
	733: 'PgpA',
	734: 'PgpC',
	735: 'PgpM',
	736: 'eDA',
	737: 'eDAk',
	738: 'eDC',
	739: 'eDCk',
	740: 'Blk',
	741: 'Wht',
	742: 'BlkKey',
	743: 'Test1',
	744: 'Test2',
	745: 'Bg1',
	746: 'Bg2',
	747: 'IS1A',
	748: 'IS1B',
	749: 'IS2A',
	750: 'IS2B',
	751: 'IS3A',
	752: 'IS3B',
	753: 'IS4A',
	754: 'IS4B',
	755: 'IS5A',
	756: 'IS5B',
	757: 'IS6A',
	758: 'IS6B',
	759: 'IS7A',
	760: 'IS7B',
	761: 'IS8A',
	762: 'IS8B',
	763: 'IS9A',
	764: 'IS9B',
	765: 'IS10A',
	766: 'IS10B',
	767: 'Mview1',
	768: 'Mview2',
	769: 'Mview3',
	770: 'Mview4',
	771: 'TBD5',
	772: 'TBD6',
	773: 'TBD7',
	774: 'TBD8',
	775: 'TBD9',
	776: 'TBD10',
	777: 'TBD11',
	778: 'TBD12',
	779: 'TBD13',
	780: 'TBD14',
	781: 'TBD15',
	782: 'TBD16',
	783: 'TBD17',
	784: 'TBD18',
	785: 'TBD19',
	786: 'TBD20',
	787: 'TBD21',
	788: 'TBD22',
	789: 'TBD23',
	790: 'TBD24',
	791: 'TBD25',
	792: 'TBD26',
	793: 'TBD27',
	794: 'TBD28',
	795: 'TBD29',
	796: 'TBD30',
	797: 'TBD31',
	798: 'TBD32',
	799: 'TBD33',
	800: 'TBD34',
	801: 'TBD35',
	802: 'TBD36',
	803: 'TBD37',
	804: 'TBD38',
	805: 'TBD39',
	806: 'TBD40',
	807: 'TBD41',
	808: 'TBD42',
}

// Generate source choices for dropdown (sources 1-850, with labels for known sources)
function getSourceChoices(): { id: number; label: string }[] {
	const choices: { id: number; label: string }[] = []
	for (let i = 1; i <= 850; i++) {
		choices.push({
			id: i,
			label: sourceLabels[i] ? `${i}: ${sourceLabels[i]}` : String(i),
		})
	}
	return choices
}

export function UpdateActions(self: ModuleInstance): void {
	const sourceChoices = getSourceChoices()

	self.setActionDefinitions({
		macro_recall: {
			name: 'Macro Recall',
			description: 'Trigger a macro on the K-Frame',
			options: [
				{
					id: 'macroNum',
					type: 'textinput',
					label: 'Macro',
					tooltip: 'Number 1-999',
					default: '1',
					required: true,
					useVariables: true,
				},
			],
			callback: async (event) => {
				const macroNumStr = await self.parseVariablesInString(String(event.options.macroNum))
				const macroNum = parseInt(macroNumStr, 10)
				if (!isNaN(macroNum) && macroNum >= 1 && macroNum <= 999) {
					self.sendMacro(macroNum)
				} else {
					self.log('warn', `Invalid macro number: ${macroNumStr}`)
				}
			},
		},

		aux_route: {
			name: 'AUX Route',
			description: 'Route a source to an AUX bus',
			options: [
				{
					id: 'auxNum',
					type: 'textinput',
					label: 'AUX',
					tooltip: 'Number 1-96',
					default: '1',
					required: true,
					useVariables: true,
				},
				{
					id: 'sourceMode',
					type: 'dropdown',
					label: 'Source Mode',
					default: 'list',
					choices: [
						{ id: 'list', label: 'Select from list' },
						{ id: 'variable', label: 'Use variable' },
					],
				},
				{
					id: 'sourceNum',
					type: 'dropdown',
					label: 'Source',
					tooltip: 'Select a source (1-850)',
					default: 1,
					choices: sourceChoices,
					isVisibleExpression: '$(options:sourceMode) == "list"',
				},
				{
					id: 'sourceVar',
					type: 'textinput',
					label: 'Source',
					tooltip: 'Number 1-850 or variable',
					default: '1',
					useVariables: true,
					isVisibleExpression: '$(options:sourceMode) == "variable"',
				},
			],
			callback: async (event) => {
				const auxNumStr = await self.parseVariablesInString(String(event.options.auxNum))
				const useVariable = event.options.sourceMode === 'variable'
				const sourceValue = useVariable ? event.options.sourceVar : event.options.sourceNum
				const sourceNumStr = await self.parseVariablesInString(String(sourceValue))
				const auxNum = parseInt(auxNumStr, 10)
				const sourceNum = parseInt(sourceNumStr, 10)
				if (!isNaN(auxNum) && !isNaN(sourceNum) && auxNum >= 1 && auxNum <= 96 && sourceNum >= 1 && sourceNum <= 850) {
					self.sendAuxRoute(auxNum, sourceNum)
				} else {
					self.log('warn', `Invalid AUX route: aux=${auxNumStr}, source=${sourceNumStr}`)
				}
			},
		},
	})
}
