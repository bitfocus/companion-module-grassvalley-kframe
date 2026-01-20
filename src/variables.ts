import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions([
		{ variableId: 'connection_status', name: 'Connection Status' },
		{ variableId: 'last_macro', name: 'Last Macro Sent' },
		{ variableId: 'last_aux', name: 'Last AUX Routed' },
		{ variableId: 'last_aux_source', name: 'Last AUX Source' },
	])
}
