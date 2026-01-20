/**
 * Connection state machine states
 */
export enum ConnectionState {
	Disconnected = 'disconnected',
	Connecting = 'connecting',
	Handshaking = 'handshaking',
	Connected = 'connected',
	Reconnecting = 'reconnecting',
}

/**
 * UDP ports used for K-Frame communication
 */
export const UDP_PORTS = {
	CLIENT_MAIN: 6130,
	CLIENT_LISTENER: 6131,
	SERVER_INITIAL: 5000,
	SERVER_ANNOUNCE: 5001,
} as const

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
	KEEPALIVE_INTERVAL: 2000,
	MAX_RETRIES: 5,
	TIMEOUT: 5000,
} as const

/**
 * K-Frame command types
 */
export enum CommandType {
	Handshake = 'handshake',
	Keepalive = 'keepalive',
	Macro = 'macro',
	AuxRoute = 'aux',
	SuiteSwitch = 'suite',
}

/**
 * Suite options for K-Frame
 */
export const SUITE_OPTIONS = [
	{ id: 'suite1a', label: 'Suite 1A' },
	{ id: 'suite1b', label: 'Suite 1B' },
	{ id: 'suite2a', label: 'Suite 2A' },
	{ id: 'suite2b', label: 'Suite 2B' },
	{ id: 'suite3a', label: 'Suite 3A' },
	{ id: 'suite3b', label: 'Suite 3B' },
	{ id: 'suite4a', label: 'Suite 4A' },
	{ id: 'suite4b', label: 'Suite 4B' },
] as const

/**
 * Suite command payloads (two messages per suite)
 */
export const SUITE_COMMANDS: Record<string, Buffer[]> = {
	suite1a: [
		Buffer.from('0004017c000200060000000c0000001417960200010000070000000a', 'hex'),
		Buffer.from('000407a700020005000000090000001004b600000100000700', 'hex'),
	],
	suite2a: [
		Buffer.from('0004017a000200060000000c0000001417960200010000070000000c', 'hex'),
		Buffer.from('000407a700020005000000090000001004b600000100000700', 'hex'),
	],
	suite3a: [
		Buffer.from('0004017e000200060000000c0000001417960200010000070000000e', 'hex'),
		Buffer.from('000407ab00020005000000090000001004b600000100000700', 'hex'),
	],
	suite4a: [
		Buffer.from('000401f7000200060000000c00000014179602000100000700000010', 'hex'),
		Buffer.from('000407ab00020005000000090000001004b600000100000700', 'hex'),
	],
	suite1b: [
		Buffer.from('0004017c000200060000000c0000001417960200010000070000000b', 'hex'),
		Buffer.from('000407a700020005000000090000001004b600000100000700', 'hex'),
	],
	suite2b: [
		Buffer.from('0004017a000200060000000c0000001417960200010000070000000d', 'hex'),
		Buffer.from('000407a700020005000000090000001004b600000100000700', 'hex'),
	],
	suite3b: [
		Buffer.from('0004017e000200060000000c0000001417960200010000070000000f', 'hex'),
		Buffer.from('000407ab00020005000000090000001004b600000100000700', 'hex'),
	],
	suite4b: [
		Buffer.from('00040232000200060000000c00000014179602000100000700000011', 'hex'),
		Buffer.from('000407ab00020005000000090000001004b600000100000700', 'hex'),
	],
}

/**
 * Command result with ACK status
 */
export interface CommandResult {
	success: boolean
	command: CommandType
	error?: string
}

/**
 * Connection event callbacks
 */
export interface ConnectionCallbacks {
	onStateChange: (state: ConnectionState) => void
	onCommandResult: (result: CommandResult) => void
	onError: (error: string) => void
}
