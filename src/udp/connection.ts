import dgram from 'dgram'
import crypto from 'crypto'
import {
	ConnectionState,
	UDP_PORTS,
	DEFAULT_CONFIG,
	CommandType,
	SUITE_COMMANDS,
	type ConnectionCallbacks,
} from './types.js'

/**
 * Handshake stages
 * 1: init, 2: expectP2, 3: expectP4, 4: expectP6, 5: wait_announce,
 * 6: expectP13, 7: expectP15, 8: expectP17, 9: connected
 */
enum HandshakeStage {
	Init = 1,
	ExpectP2 = 2,
	ExpectP4 = 3,
	ExpectP6 = 4,
	WaitAnnounce = 5,
	ExpectP13 = 6,
	ExpectP15 = 7,
	ExpectP17 = 8,
	Connected = 9,
}

/**
 * Binary payloads for K-Frame protocol
 */
const PAYLOADS = {
	// Handshake 1 (Main Client 6130 <-> Server 5000)
	PACKET_1: Buffer.from([0x00, 0x06, 0x00, 0x00]),
	EXPECTED_PACKET_2: Buffer.from([0x00, 0x02, 0x00, 0x00]),
	PACKET_3: Buffer.from([0x00, 0x01, 0x00, 0x00]),
	EXPECTED_PACKET_4: Buffer.from([0x00, 0x02, 0x00, 0x00]),
	PACKET_5: Buffer.from('000400010002001f0000000b0000002c00010000636c69656e7400', 'hex'),
	EXPECTED_PACKET_6: Buffer.from([0x00, 0x02, 0x00, 0x01]),

	// Listener Channel (Listener 6131 <-> Server 5001)
	EXPECTED_PACKET_7: Buffer.from([0x00, 0x01, 0x00, 0x00]),
	PACKET_8: Buffer.from([0x00, 0x02, 0x00, 0x00]),
	PACKET_10: Buffer.from([0x00, 0x02, 0x00, 0x01]),

	// Handshake 2 (Main Client 6130 <-> Dynamic Port)
	PACKET_12: Buffer.from([0x00, 0x06, 0x00, 0x00]),
	EXPECTED_PACKET_13: Buffer.from([0x00, 0x02, 0x00, 0x00]),
	PACKET_14: Buffer.from([0x00, 0x01, 0x00, 0x00]),
	EXPECTED_PACKET_15: Buffer.from([0x00, 0x02, 0x00, 0x00]),
	PACKET_16_BASE: Buffer.from('000400010002001f0000000b0000002c', 'hex'),
	PACKET_16_CLIENT: Buffer.from('636c69656e7400', 'hex'),
	EXPECTED_PACKET_17: Buffer.from([0x00, 0x02, 0x00, 0x01]),

	// Heartbeat
	HEARTBEAT: Buffer.from([0x00, 0x01, 0x00, 0x00]),
	EXPECTED_HEARTBEAT_RESPONSE: Buffer.from([0x00, 0x02, 0x00, 0x00]),
} as const

/**
 * Macro payload template
 * Format: 000403{macro_id}000200050000000c000000130002000077000000{macro_specific}
 */
const MACRO_TEMPLATE = '000403{macro_id}000200050000000c000000130002000077000000{macro_specific}'

/**
 * Aux payload template
 * Format: 0004{message_id}000200050000000c00000013007e0000{aux_source_specific}0001
 */
const AUX_TEMPLATE = '0004{message_id}000200050000000c00000013007e0000{aux_source_specific}0001'

/**
 * UDP Connection Manager for K-Frame
 * Handles state machine, sockets, keepalive, and reconnection using binary protocol
 */
export class UdpConnection {
	private state: ConnectionState = ConnectionState.Disconnected
	private handshakeStage: HandshakeStage = HandshakeStage.Init
	private mainSocket: dgram.Socket | null = null
	private listenerSocket: dgram.Socket | null = null

	private host: string = ''
	private keepaliveInterval: number = DEFAULT_CONFIG.KEEPALIVE_INTERVAL
	private maxRetries: number = DEFAULT_CONFIG.MAX_RETRIES

	private announcedTargetPort: number = 0
	private dynamicCommPort: number = 0
	private secondPhaseSequence: number = 3

	private keepaliveTimer: ReturnType<typeof setInterval> | null = null
	private timeoutTimer: ReturnType<typeof setTimeout> | null = null
	private packet1RetryTimer: ReturnType<typeof setInterval> | null = null
	private handshakeTimeoutTimer: ReturnType<typeof setTimeout> | null = null

	private retryCount: number = 0
	private initialHeartbeatSent: boolean = false
	private isClosing: boolean = false

	private nextMacroId: number = 0
	private lastSentMacroId: number | null = null
	private recentlyUsedMacroIds: number[] = []

	private currentSuite: string = 'suite1a'

	private callbacks: ConnectionCallbacks
	private log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void

	constructor(
		callbacks: ConnectionCallbacks,
		log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void,
	) {
		this.callbacks = callbacks
		this.log = log
	}

	/**
	 * Get current connection state
	 */
	getState(): ConnectionState {
		return this.state
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.state === ConnectionState.Connected && this.handshakeStage === HandshakeStage.Connected
	}

	/**
	 * Update configuration and reconnect if needed
	 */
	updateConfig(host: string, _port: number, keepaliveInterval: number, maxRetries: number, suite?: string): void {
		const hostChanged = this.host !== host
		const suiteChanged = suite && SUITE_COMMANDS[suite] && this.currentSuite !== suite

		this.host = host
		this.keepaliveInterval = keepaliveInterval
		this.maxRetries = maxRetries

		// Set the suite if provided
		if (suite && SUITE_COMMANDS[suite]) {
			this.currentSuite = suite
			this.log('debug', `Suite set to ${suite}`)
		}

		// Reconnect if host or suite changed
		if ((hostChanged || suiteChanged) && this.state !== ConnectionState.Disconnected) {
			this.log('info', 'Configuration changed, reconnecting...')
			this.disconnect()
			this.connect()
		}
	}

	/**
	 * Connect to K-Frame
	 */
	connect(): void {
		if (!this.host) {
			this.log('warn', 'Cannot connect: no host configured')
			return
		}

		if (this.state !== ConnectionState.Disconnected) {
			this.log('debug', 'Already connecting or connected')
			return
		}

		this.log('info', `Connecting to K-Frame at ${this.host}`)
		this.setState(ConnectionState.Connecting)
		this.isClosing = false
		this.retryCount = 0
		this.handshakeStage = HandshakeStage.Init

		this.initSockets()
	}

	/**
	 * Disconnect from K-Frame
	 */
	disconnect(): void {
		this.log('info', 'Disconnecting from K-Frame')
		this.cleanup()
		this.setState(ConnectionState.Disconnected)
	}

	/**
	 * Set the current suite
	 */
	setSuite(suite: string): void {
		if (!SUITE_COMMANDS[suite]) {
			this.log('warn', `Invalid suite: ${suite}`)
			return
		}
		this.currentSuite = suite

		if (this.isConnected()) {
			this.sendSuiteCommand(suite)
		}
	}

	/**
	 * Send a macro command
	 */
	sendMacro(macroNum: number): void {
		if (!this.isConnected()) {
			this.callbacks.onCommandResult({
				success: false,
				command: CommandType.Macro,
				error: 'Not connected',
			})
			return
		}

		if (macroNum < 1 || macroNum > 999) {
			this.callbacks.onCommandResult({
				success: false,
				command: CommandType.Macro,
				error: 'Invalid macro number (must be 1-999)',
			})
			return
		}

		const macroIdNum = this.generateUniqueMacroId()
		const payload = this.createMacroPayload(macroNum, macroIdNum)

		this.lastSentMacroId = macroIdNum
		this.log('debug', `Sending macro ${macroNum} with ID ${macroIdNum}: ${payload.toString('hex')}`)

		this.mainSocket?.send(payload, this.dynamicCommPort, this.host, (err) => {
			if (err) {
				this.log('error', `Macro send error: ${err.message}`)
				this.lastSentMacroId = null
				this.callbacks.onCommandResult({
					success: false,
					command: CommandType.Macro,
					error: err.message,
				})
			} else {
				this.callbacks.onCommandResult({
					success: true,
					command: CommandType.Macro,
				})
			}
		})
	}

	/**
	 * Send an AUX route command
	 */
	sendAuxRoute(auxNum: number, sourceNum: number): void {
		if (!this.isConnected()) {
			this.callbacks.onCommandResult({
				success: false,
				command: CommandType.AuxRoute,
				error: 'Not connected',
			})
			return
		}

		if (auxNum < 1 || auxNum > 96) {
			this.callbacks.onCommandResult({
				success: false,
				command: CommandType.AuxRoute,
				error: 'Invalid aux number (must be 1-96)',
			})
			return
		}

		if (sourceNum < 1 || sourceNum > 850) {
			this.callbacks.onCommandResult({
				success: false,
				command: CommandType.AuxRoute,
				error: 'Invalid source number (must be 1-850)',
			})
			return
		}

		const payload = this.createAuxPayload(auxNum, sourceNum)
		this.log('debug', `Sending aux ${auxNum} -> source ${sourceNum}: ${payload.toString('hex')}`)

		this.mainSocket?.send(payload, this.dynamicCommPort, this.host, (err) => {
			if (err) {
				this.log('error', `Aux route send error: ${err.message}`)
				this.callbacks.onCommandResult({
					success: false,
					command: CommandType.AuxRoute,
					error: err.message,
				})
			} else {
				this.callbacks.onCommandResult({
					success: true,
					command: CommandType.AuxRoute,
				})
			}
		})
	}

	/**
	 * Send a suite switch command
	 */
	sendSuiteSwitch(suite: string): void {
		if (!this.isConnected()) {
			this.callbacks.onCommandResult({
				success: false,
				command: CommandType.SuiteSwitch,
				error: 'Not connected',
			})
			return
		}

		if (!SUITE_COMMANDS[suite]) {
			this.callbacks.onCommandResult({
				success: false,
				command: CommandType.SuiteSwitch,
				error: `Invalid suite: ${suite}`,
			})
			return
		}

		this.sendSuiteCommand(suite)
		this.callbacks.onCommandResult({
			success: true,
			command: CommandType.SuiteSwitch,
		})
	}

	/**
	 * Initialize UDP sockets
	 */
	private initSockets(): void {
		try {
			this.mainSocket = dgram.createSocket('udp4')
			this.mainSocket.on('error', (err) => this.handleSocketError(err, 'main'))
			this.mainSocket.on('message', (msg, rinfo) => this.handleMainMessage(msg, rinfo))

			this.listenerSocket = dgram.createSocket('udp4')
			this.listenerSocket.on('error', (err) => this.handleSocketError(err, 'listener'))
			this.listenerSocket.on('message', (msg, rinfo) => this.handleListenerMessage(msg, rinfo))

			this.mainSocket.bind(UDP_PORTS.CLIENT_MAIN, () => {
				this.log('debug', `Main socket bound to port ${UDP_PORTS.CLIENT_MAIN}`)
				this.startHandshake()
			})

			this.listenerSocket.bind(UDP_PORTS.CLIENT_LISTENER, () => {
				this.log('debug', `Listener socket bound to port ${UDP_PORTS.CLIENT_LISTENER}`)
			})

			// Start overall handshake timeout
			this.handshakeTimeoutTimer = setTimeout(() => {
				this.log('error', 'Handshake timeout')
				this.handleConnectionFailure()
			}, DEFAULT_CONFIG.TIMEOUT * 2)
		} catch (err) {
			this.log('error', `Failed to initialize sockets: ${err}`)
			this.handleConnectionFailure()
		}
	}

	/**
	 * Start the handshake process
	 */
	private startHandshake(): void {
		this.setState(ConnectionState.Handshaking)
		this.log('debug', 'Starting handshake - sending Packet 1')

		this.mainSocket?.send(PAYLOADS.PACKET_1, UDP_PORTS.SERVER_INITIAL, this.host, (err) => {
			if (err) {
				this.log('error', `Packet 1 send error: ${err.message}`)
				this.handleConnectionFailure()
			} else {
				this.log('debug', `Sent Packet 1: ${PAYLOADS.PACKET_1.toString('hex')}`)
				this.handshakeStage = HandshakeStage.ExpectP2

				// Retry Packet 1 every second until we get response
				this.packet1RetryTimer = setInterval(() => {
					if (this.handshakeStage === HandshakeStage.ExpectP2 && !this.isClosing) {
						this.mainSocket?.send(PAYLOADS.PACKET_1, UDP_PORTS.SERVER_INITIAL, this.host, (err) => {
							if (err) this.log('warn', `Packet 1 retry error: ${err.message}`)
							else this.log('debug', 'Retried Packet 1')
						})
					} else {
						this.clearPacket1Retry()
					}
				}, 1000)
			}
		})
	}

	/**
	 * Handle message on main socket
	 */
	private handleMainMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		this.log('debug', `[main] Received from ${rinfo.address}:${rinfo.port}: ${msg.toString('hex')}`)

		// Handshake 1 - expecting Packet 2
		if (this.handshakeStage === HandshakeStage.ExpectP2 && rinfo.port === UDP_PORTS.SERVER_INITIAL) {
			if (msg.equals(PAYLOADS.EXPECTED_PACKET_2)) {
				this.log('debug', 'Received Packet 2')
				this.clearPacket1Retry()
				this.handshakeStage = HandshakeStage.ExpectP4
				this.mainSocket?.send(PAYLOADS.PACKET_3, UDP_PORTS.SERVER_INITIAL, this.host, (err) => {
					if (err) this.log('error', `Packet 3 send error: ${err.message}`)
					else this.log('debug', `Sent Packet 3: ${PAYLOADS.PACKET_3.toString('hex')}`)
				})
			}
		}
		// Handshake 1 - expecting Packet 4
		else if (this.handshakeStage === HandshakeStage.ExpectP4 && rinfo.port === UDP_PORTS.SERVER_INITIAL) {
			if (msg.equals(PAYLOADS.EXPECTED_PACKET_4)) {
				this.log('debug', 'Received Packet 4')
				this.handshakeStage = HandshakeStage.ExpectP6
				this.mainSocket?.send(PAYLOADS.PACKET_5, UDP_PORTS.SERVER_INITIAL, this.host, (err) => {
					if (err) this.log('error', `Packet 5 send error: ${err.message}`)
					else this.log('debug', `Sent Packet 5: ${PAYLOADS.PACKET_5.toString('hex')}`)
				})
			}
		}
		// Handshake 1 - expecting Packet 6
		else if (this.handshakeStage === HandshakeStage.ExpectP6 && rinfo.port === UDP_PORTS.SERVER_INITIAL) {
			if (msg.equals(PAYLOADS.EXPECTED_PACKET_6)) {
				this.log('debug', 'Received Packet 6 - Handshake 1 complete')
				this.handshakeStage = HandshakeStage.WaitAnnounce

				// If we already have the announced port, start handshake 2
				if (this.announcedTargetPort > 0) {
					this.startHandshake2()
				}
			}
		}
		// Handshake 2 - expecting Packet 13
		else if (this.handshakeStage === HandshakeStage.ExpectP13 && rinfo.port === this.announcedTargetPort) {
			if (msg.equals(PAYLOADS.EXPECTED_PACKET_13)) {
				this.log('debug', 'Received Packet 13')
				this.dynamicCommPort = rinfo.port
				this.handshakeStage = HandshakeStage.ExpectP15
				this.mainSocket?.send(PAYLOADS.PACKET_14, this.dynamicCommPort, this.host, (err) => {
					if (err) this.log('error', `Packet 14 send error: ${err.message}`)
					else this.log('debug', `Sent Packet 14: ${PAYLOADS.PACKET_14.toString('hex')}`)
				})
			}
		}
		// Handshake 2 - expecting Packet 15
		else if (this.handshakeStage === HandshakeStage.ExpectP15 && rinfo.port === this.dynamicCommPort) {
			if (msg.equals(PAYLOADS.EXPECTED_PACKET_15)) {
				this.log('debug', 'Received Packet 15')
				this.handshakeStage = HandshakeStage.ExpectP17

				// Build Packet 16 with sequence
				const sequenceBuffer = Buffer.alloc(2)
				sequenceBuffer.writeUInt16BE(this.secondPhaseSequence, 0)
				const packet16 = Buffer.concat([
					PAYLOADS.PACKET_16_BASE,
					sequenceBuffer,
					Buffer.alloc(2),
					PAYLOADS.PACKET_16_CLIENT,
				])

				this.mainSocket?.send(packet16, this.dynamicCommPort, this.host, (err) => {
					if (err) this.log('error', `Packet 16 send error: ${err.message}`)
					else this.log('debug', `Sent Packet 16: ${packet16.toString('hex')}`)
				})
			}
		}
		// Handshake 2 - expecting Packet 17
		else if (this.handshakeStage === HandshakeStage.ExpectP17 && rinfo.port === this.dynamicCommPort) {
			if (msg.equals(PAYLOADS.EXPECTED_PACKET_17)) {
				this.log('info', 'Received Packet 17 - Handshake complete')
				this.completeHandshake()
			}
		}
		// Connected phase - handle heartbeat and macro ACKs
		else if (this.handshakeStage === HandshakeStage.Connected && rinfo.port === this.dynamicCommPort) {
			// Check for Macro ACK (format: 000203{macro_id})
			if (
				this.lastSentMacroId !== null &&
				msg.length === 4 &&
				msg[0] === 0x00 &&
				msg[1] === 0x02 &&
				msg[2] === 0x03 &&
				msg[3] === this.lastSentMacroId
			) {
				this.log('debug', `Macro ACK received for ID ${this.lastSentMacroId}`)
				this.lastSentMacroId = null
			}
			// Check for heartbeat response
			else if (msg.equals(PAYLOADS.EXPECTED_HEARTBEAT_RESPONSE)) {
				this.log('debug', 'Heartbeat response received')
				this.resetHeartbeatTimeout()
			}
		}
	}

	/**
	 * Handle message on listener socket
	 */
	private handleListenerMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		this.log('debug', `[listener] Received from ${rinfo.address}:${rinfo.port}: ${msg.toString('hex')}`)

		if (rinfo.port === UDP_PORTS.SERVER_ANNOUNCE) {
			// Packet 7 - initial message from server
			if (msg.equals(PAYLOADS.EXPECTED_PACKET_7)) {
				this.log('debug', 'Received Packet 7')
				this.listenerSocket?.send(PAYLOADS.PACKET_8, rinfo.port, rinfo.address, (err) => {
					if (err) this.log('error', `Packet 8 send error: ${err.message}`)
					else this.log('debug', `Sent Packet 8: ${PAYLOADS.PACKET_8.toString('hex')}`)
				})
			}
			// Packet 9 - port announcement (length >= 20)
			else if (msg.length >= 20) {
				const announcedPort = msg.readUInt16BE(18)
				if (announcedPort > 0 && announcedPort < 65536) {
					this.log('info', `Received port announcement: ${announcedPort}`)
					this.announcedTargetPort = announcedPort

					// Send Packet 10 acknowledgement
					this.listenerSocket?.send(PAYLOADS.PACKET_10, rinfo.port, rinfo.address, (err) => {
						if (err) {
							this.log('error', `Packet 10 send error: ${err.message}`)
						} else {
							this.log('debug', `Sent Packet 10: ${PAYLOADS.PACKET_10.toString('hex')}`)

							// If main client is waiting, start handshake 2
							if (this.handshakeStage === HandshakeStage.WaitAnnounce) {
								this.startHandshake2()
							}

							// Close listener socket as it's no longer needed
							this.closeListenerSocket()
						}
					})
				} else {
					this.log('warn', `Invalid port in announcement: ${announcedPort}`)
				}
			}
		}
	}

	/**
	 * Start handshake phase 2
	 */
	private startHandshake2(): void {
		this.log('debug', `Starting Handshake 2 to port ${this.announcedTargetPort}`)
		this.handshakeStage = HandshakeStage.ExpectP13

		this.mainSocket?.send(PAYLOADS.PACKET_12, this.announcedTargetPort, this.host, (err) => {
			if (err) this.log('error', `Packet 12 send error: ${err.message}`)
			else this.log('debug', `Sent Packet 12: ${PAYLOADS.PACKET_12.toString('hex')}`)
		})
	}

	/**
	 * Complete the handshake and start keepalive
	 */
	private completeHandshake(): void {
		// Clear handshake timeout
		if (this.handshakeTimeoutTimer) {
			clearTimeout(this.handshakeTimeoutTimer)
			this.handshakeTimeoutTimer = null
		}

		this.handshakeStage = HandshakeStage.Connected
		this.setState(ConnectionState.Connected)
		this.retryCount = 0
		this.initialHeartbeatSent = false

		this.log('info', 'Connected to K-Frame')

		// Send initial suite command
		if (this.currentSuite && SUITE_COMMANDS[this.currentSuite]) {
			this.sendSuiteCommand(this.currentSuite)
		}

		// Start heartbeat
		this.startKeepalive()
	}

	/**
	 * Send suite command
	 */
	private sendSuiteCommand(suite: string): void {
		const commands = SUITE_COMMANDS[suite]
		if (!commands) return

		this.log('debug', `Sending suite command for ${suite}`)

		// Send first command
		this.mainSocket?.send(commands[0], this.dynamicCommPort, this.host, (err) => {
			if (err) {
				this.log('error', `Suite command 1 send error: ${err.message}`)
			} else {
				this.log('debug', `Sent suite command 1: ${commands[0].toString('hex')}`)

				// Send second command after small delay
				if (commands.length > 1) {
					setTimeout(() => {
						this.mainSocket?.send(commands[1], this.dynamicCommPort, this.host, (err) => {
							if (err) this.log('error', `Suite command 2 send error: ${err.message}`)
							else this.log('debug', `Sent suite command 2: ${commands[1].toString('hex')}`)
						})
					}, 100)
				}
			}
		})
	}

	/**
	 * Start keepalive timer
	 */
	private startKeepalive(): void {
		this.stopKeepalive()

		this.keepaliveTimer = setInterval(() => {
			if (this.handshakeStage === HandshakeStage.Connected && !this.isClosing) {
				this.sendKeepalive()
			} else {
				this.stopKeepalive()
			}
		}, this.keepaliveInterval)
	}

	/**
	 * Stop keepalive timer
	 */
	private stopKeepalive(): void {
		if (this.keepaliveTimer) {
			clearInterval(this.keepaliveTimer)
			this.keepaliveTimer = null
		}
		this.clearHeartbeatTimeout()
	}

	/**
	 * Send keepalive packet
	 */
	private sendKeepalive(): void {
		if (!this.isConnected() || !this.mainSocket) return

		this.mainSocket.send(PAYLOADS.HEARTBEAT, this.dynamicCommPort, this.host, (err) => {
			if (err) {
				this.log('warn', `Heartbeat send error: ${err.message}`)
				this.handleConnectionFailure()
			} else {
				this.log('debug', `Sent heartbeat: ${PAYLOADS.HEARTBEAT.toString('hex')}`)

				// Start timeout after first heartbeat is sent
				if (!this.initialHeartbeatSent) {
					this.resetHeartbeatTimeout()
					this.initialHeartbeatSent = true
				}
			}
		})
	}

	/**
	 * Reset heartbeat timeout
	 */
	private resetHeartbeatTimeout(): void {
		this.clearHeartbeatTimeout()
		this.timeoutTimer = setTimeout(() => {
			this.log('warn', 'Heartbeat timeout')
			this.handleConnectionFailure()
		}, this.keepaliveInterval * 2.5)
	}

	/**
	 * Clear heartbeat timeout
	 */
	private clearHeartbeatTimeout(): void {
		if (this.timeoutTimer) {
			clearTimeout(this.timeoutTimer)
			this.timeoutTimer = null
		}
	}

	/**
	 * Generate unique macro ID (0-255)
	 */
	private generateUniqueMacroId(): number {
		let attempts = 0
		let candidateId: number

		do {
			candidateId = this.nextMacroId
			this.nextMacroId = (this.nextMacroId + 1) % 256
			attempts++

			if (attempts > 256) {
				if (this.recentlyUsedMacroIds.length > 0) {
					candidateId = this.recentlyUsedMacroIds.shift()!
				}
				break
			}
		} while (this.recentlyUsedMacroIds.includes(candidateId))

		this.recentlyUsedMacroIds.push(candidateId)
		if (this.recentlyUsedMacroIds.length > 50) {
			this.recentlyUsedMacroIds.shift()
		}

		return candidateId
	}

	/**
	 * Create macro payload
	 */
	private createMacroPayload(macroNumber: number, macroIdNum: number): Buffer {
		const macroIdHex = macroIdNum.toString(16).padStart(2, '0')
		const macroSpecific = (macroNumber - 1).toString(16).padStart(4, '0') + '0000'
		const payloadString = MACRO_TEMPLATE.replace('{macro_id}', macroIdHex).replace('{macro_specific}', macroSpecific)
		return Buffer.from(payloadString, 'hex')
	}

	/**
	 * Create aux payload
	 */
	private createAuxPayload(auxNum: number, sourceNum: number): Buffer {
		const messageId = crypto.randomInt(0, 65536)
		const messageIdHex = messageId.toString(16).padStart(4, '0')

		const auxIndex = auxNum - 1
		const auxHex = auxIndex.toString(16).padStart(2, '0')
		const sourceHex = sourceNum.toString(16).padStart(4, '0')

		const auxSourceSpecific = `190001${auxHex}${sourceHex}`

		const payloadString = AUX_TEMPLATE.replace('{message_id}', messageIdHex).replace(
			'{aux_source_specific}',
			auxSourceSpecific,
		)
		return Buffer.from(payloadString, 'hex')
	}

	/**
	 * Handle socket errors
	 */
	private handleSocketError(err: Error, socketName: string): void {
		this.log('error', `Socket error (${socketName}): ${err.message}`)
		this.callbacks.onError(err.message)

		if (this.state !== ConnectionState.Disconnected) {
			this.handleConnectionFailure()
		}
	}

	/**
	 * Handle connection failure and retry
	 */
	private handleConnectionFailure(): void {
		this.clearAllTimers()

		if (this.retryCount < this.maxRetries) {
			this.retryCount++
			this.log('warn', `Connection failed, retry ${this.retryCount}/${this.maxRetries}`)
			this.setState(ConnectionState.Reconnecting)

			this.closeSockets()

			setTimeout(() => {
				if (this.state === ConnectionState.Reconnecting) {
					this.setState(ConnectionState.Connecting)
					this.handshakeStage = HandshakeStage.Init
					this.announcedTargetPort = 0
					this.dynamicCommPort = 0
					this.initSockets()
				}
			}, this.keepaliveInterval)
		} else {
			this.log('error', `Max retries (${this.maxRetries}) reached`)
			this.cleanup()
			this.setState(ConnectionState.Disconnected)
		}
	}

	/**
	 * Clear Packet 1 retry timer
	 */
	private clearPacket1Retry(): void {
		if (this.packet1RetryTimer) {
			clearInterval(this.packet1RetryTimer)
			this.packet1RetryTimer = null
		}
	}

	/**
	 * Clear all timers
	 */
	private clearAllTimers(): void {
		this.clearHeartbeatTimeout()
		this.stopKeepalive()
		this.clearPacket1Retry()

		if (this.handshakeTimeoutTimer) {
			clearTimeout(this.handshakeTimeoutTimer)
			this.handshakeTimeoutTimer = null
		}
	}

	/**
	 * Set connection state and notify
	 */
	private setState(newState: ConnectionState): void {
		if (this.state !== newState) {
			this.log('debug', `State: ${this.state} -> ${newState}`)
			this.state = newState
			this.callbacks.onStateChange(newState)
		}
	}

	/**
	 * Close listener socket
	 */
	private closeListenerSocket(): void {
		if (this.listenerSocket) {
			try {
				this.listenerSocket.close()
			} catch {
				// Ignore close errors
			}
			this.listenerSocket = null
		}
	}

	/**
	 * Close all sockets
	 */
	private closeSockets(): void {
		if (this.mainSocket) {
			try {
				this.mainSocket.close()
			} catch {
				// Ignore close errors
			}
			this.mainSocket = null
		}

		this.closeListenerSocket()
	}

	/**
	 * Full cleanup
	 */
	private cleanup(): void {
		if (this.isClosing) return
		this.isClosing = true

		this.clearAllTimers()
		this.closeSockets()

		this.announcedTargetPort = 0
		this.dynamicCommPort = 0
		this.handshakeStage = HandshakeStage.Init
		this.retryCount = 0
		this.nextMacroId = 0
		this.recentlyUsedMacroIds = []
		this.lastSentMacroId = null
		this.initialHeartbeatSent = false
	}
}
