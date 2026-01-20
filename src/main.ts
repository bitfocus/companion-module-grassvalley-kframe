import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UdpConnection } from './udp/connection.js'
import { ConnectionState, CommandType, DEFAULT_CONFIG, UDP_PORTS } from './udp/types.js'

const FEEDBACK_CLEAR_DELAY = 500 // ms to show feedback before clearing

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	private udpConnection: UdpConnection | null = null
	private connectionState: ConnectionState = ConnectionState.Disconnected

	// Feedback state
	lastMacroSent: number | null = null
	lastAuxSent: number | null = null
	private macroFeedbackTimer: ReturnType<typeof setTimeout> | null = null
	private auxFeedbackTimer: ReturnType<typeof setTimeout> | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateStatus(InstanceStatus.Disconnected)

		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()

		// Initialize UDP connection
		this.initConnection()
	}

	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		this.clearFeedbackTimers()
		if (this.udpConnection) {
			this.udpConnection.disconnect()
			this.udpConnection = null
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config

		// Update UDP connection with new config
		if (this.udpConnection) {
			this.udpConnection.updateConfig(
				config.host || '',
				UDP_PORTS.SERVER_INITIAL,
				config.keepaliveInterval || DEFAULT_CONFIG.KEEPALIVE_INTERVAL,
				config.maxRetries || DEFAULT_CONFIG.MAX_RETRIES,
				config.suite || 'suite1a',
			)
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	/**
	 * Initialize UDP connection
	 */
	private initConnection(): void {
		this.udpConnection = new UdpConnection(
			{
				onStateChange: (state) => this.handleStateChange(state),
				onCommandResult: (result) => this.handleCommandResult(result),
				onError: (error) => this.handleError(error),
			},
			(level, message) => this.log(level, message),
		)

		// Start connection if host is configured
		if (this.config.host) {
			this.udpConnection.updateConfig(
				this.config.host,
				UDP_PORTS.SERVER_INITIAL,
				this.config.keepaliveInterval || DEFAULT_CONFIG.KEEPALIVE_INTERVAL,
				this.config.maxRetries || DEFAULT_CONFIG.MAX_RETRIES,
				this.config.suite || 'suite1a',
			)
			this.udpConnection.connect()
		}
	}

	/**
	 * Handle connection state changes
	 */
	private handleStateChange(state: ConnectionState): void {
		this.connectionState = state

		// Update connection status variable
		let statusText = 'Unknown'
		switch (state) {
			case ConnectionState.Connected:
				this.updateStatus(InstanceStatus.Ok)
				statusText = 'Connected'
				break
			case ConnectionState.Connecting:
				this.updateStatus(InstanceStatus.Connecting)
				statusText = 'Connecting'
				break
			case ConnectionState.Handshaking:
				this.updateStatus(InstanceStatus.Connecting)
				statusText = 'Handshaking'
				break
			case ConnectionState.Reconnecting:
				this.updateStatus(InstanceStatus.Connecting)
				statusText = 'Reconnecting'
				break
			case ConnectionState.Disconnected:
				this.updateStatus(InstanceStatus.Disconnected)
				statusText = 'Disconnected'
				break
		}

		this.setVariableValues({ connection_status: statusText })
		this.checkFeedbacks('connection_status', 'connection_connected', 'connection_disconnected', 'connection_connecting')
	}

	/**
	 * Handle command results
	 */
	private handleCommandResult(result: { success: boolean; command: CommandType; error?: string }): void {
		if (!result.success) {
			this.log('warn', `Command ${result.command} failed: ${result.error}`)
		}
	}

	/**
	 * Handle connection errors
	 */
	private handleError(error: string): void {
		this.log('error', `Connection error: ${error}`)
	}

	/**
	 * Get current connection state
	 */
	getConnectionState(): ConnectionState {
		return this.connectionState
	}

	/**
	 * Send macro command
	 */
	sendMacro(macroNum: number): void {
		if (this.udpConnection) {
			this.udpConnection.sendMacro(macroNum)

			// Set feedback state and variable
			this.lastMacroSent = macroNum
			this.setVariableValues({ last_macro: macroNum.toString() })
			this.checkFeedbacks('macro_sent')

			// Clear feedback after delay
			this.clearMacroFeedbackTimer()
			this.macroFeedbackTimer = setTimeout(() => {
				this.lastMacroSent = null
				this.checkFeedbacks('macro_sent')
			}, FEEDBACK_CLEAR_DELAY)
		}
	}

	/**
	 * Send AUX route command
	 */
	sendAuxRoute(auxNum: number, sourceNum: number): void {
		if (this.udpConnection) {
			this.udpConnection.sendAuxRoute(auxNum, sourceNum)

			// Set feedback state and variables
			this.lastAuxSent = auxNum
			this.setVariableValues({
				last_aux: auxNum.toString(),
				last_aux_source: sourceNum.toString(),
			})
			this.checkFeedbacks('aux_sent')

			// Clear feedback after delay
			this.clearAuxFeedbackTimer()
			this.auxFeedbackTimer = setTimeout(() => {
				this.lastAuxSent = null
				this.checkFeedbacks('aux_sent')
			}, FEEDBACK_CLEAR_DELAY)
		}
	}

	/**
	 * Clear macro feedback timer
	 */
	private clearMacroFeedbackTimer(): void {
		if (this.macroFeedbackTimer) {
			clearTimeout(this.macroFeedbackTimer)
			this.macroFeedbackTimer = null
		}
	}

	/**
	 * Clear AUX feedback timer
	 */
	private clearAuxFeedbackTimer(): void {
		if (this.auxFeedbackTimer) {
			clearTimeout(this.auxFeedbackTimer)
			this.auxFeedbackTimer = null
		}
	}

	/**
	 * Clear all feedback timers
	 */
	private clearFeedbackTimers(): void {
		this.clearMacroFeedbackTimer()
		this.clearAuxFeedbackTimer()
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
