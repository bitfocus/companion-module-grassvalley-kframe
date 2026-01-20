/**
 * Mock K-Frame UDP Server
 * Simulates the K-Frame protocol for testing the Companion module
 *
 * Usage: node mock-kframe.js
 */

import dgram from 'dgram'

// Configuration
const LISTEN_PORT = 5000 // Port where K-Frame listens for connections
const PORT_ANNOUNCE = 5001 // Port for port announcement
const CLIENT_LISTENER = 6131 // Port where client listens
let dynamicCommPort = 6001 // Will be announced to client (simulate dynamic port)

// Create sockets

const mainSocket = dgram.createSocket('udp4')
const portAnnounceSocket = dgram.createSocket('udp4')
let dynamicSocket = null // Do not create here, but dynamically

// Colors for console output
const colors = {
	reset: '\x1b[0m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
}

function log(color, prefix, message) {
	const timestamp = new Date().toISOString().substr(11, 12)
	console.log(`${colors[color]}[${timestamp}] ${prefix}${colors.reset} ${message}`)
}

// --- Binary handshake payloads ---
const payloadPacket2 = Buffer.from([0x00, 0x02, 0x00, 0x00])
const payloadPacket4 = Buffer.from([0x00, 0x02, 0x00, 0x00])
const payloadPacket6 = Buffer.from([0x00, 0x02, 0x00, 0x01])
const expectedPacket1 = Buffer.from([0x00, 0x06, 0x00, 0x00])
const expectedPacket3 = Buffer.from([0x00, 0x01, 0x00, 0x00])
const expectedPacket5 = Buffer.from('000400010002001f0000000b0000002c00010000636c69656e7400', 'hex')

// --- Suite command payloads (copied from handshake-client-module.js) ---
const suiteCommands = {
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

const expectedPacket12 = Buffer.from([0x00, 0x06, 0x00, 0x00])
const payloadPacket13 = Buffer.from([0x00, 0x02, 0x00, 0x00])
const expectedPacket14 = Buffer.from([0x00, 0x01, 0x00, 0x00])
const payloadPacket15 = Buffer.from([0x00, 0x02, 0x00, 0x00])
const expectedPacket16Base = Buffer.from('000400010002001f0000000b0000002c', 'hex')
//const expectedPacket16Client = Buffer.from('636c69656e7400', 'hex') // unused
const payloadPacket17 = Buffer.from([0x00, 0x02, 0x00, 0x01])
const expectedHeartbeat = Buffer.from([0x00, 0x01, 0x00, 0x00])
const heartbeatResponse = Buffer.from([0x00, 0x02, 0x00, 0x00])

function resetState() {
	handshakeStage = 1
	listenerHandshakeStage = 1
	lastMacroId = null
	// Increment the dynamic port to simulate a real server
	dynamicCommPort++
	if (dynamicSocket) {
		try {
			dynamicSocket.close()
		} catch {
			// ignore
		}
	}
	dynamicSocket = dgram.createSocket('udp4')
	dynamicSocket.on('message', onDynamicMessage)
	dynamicSocket.on('error', (err) => {
		log('yellow', '[ERROR]', `Dynamic socket error: ${err}`)
	})
	dynamicSocket.bind(dynamicCommPort, () => {
		log('green', '[STARTED]', `Dynamic socket listening on port ${dynamicCommPort}`)
	})
}

function onDynamicMessage(msg, rinfo) {
	log('yellow', '[DEBUG]', `[DYN] Received: ${msg.toString('hex')} (stage ${handshakeStage})`)
	// Suite management: detect and change suite on the fly
	if (handshakeStage === 9) {
		// Check if the message matches a known suite
		for (const [suiteName, payloads] of Object.entries(suiteCommands)) {
			if (msg.equals(payloads[0])) {
				log('green', '[SUITE]', `Suite changed: ${suiteName} (message 1)`)
				// Respond as if the server accepts the suite (optional)
				return
			} else if (msg.equals(payloads[1])) {
				log('green', '[SUITE]', `Suite ${suiteName} (message 2)`)
				// Respond as if the server accepts the suite (optional)
				return
			}
		}
	}
	// ...existing code...
	if (handshakeStage === 6 && msg.equals(expectedPacket12)) {
		log('cyan', '[RECV]', `Packet 12 from ${rinfo.address}:${rinfo.port} (initial)`)
		dynamicSocket.send(payloadPacket13, rinfo.port, rinfo.address)
		handshakeStage = 7
		log('yellow', '[DEBUG]', `handshakeStage -> 7`)
	} else if (handshakeStage > 6 && handshakeStage < 8 && msg.equals(expectedPacket12)) {
		log('cyan', '[RECV]', `Packet 12 from ${rinfo.address}:${rinfo.port} (repeated)`)
		dynamicSocket.send(payloadPacket13, rinfo.port, rinfo.address)
	} else if (handshakeStage === 7 && msg.equals(expectedPacket14)) {
		log('cyan', '[RECV]', `Packet 14 from ${rinfo.address}:${rinfo.port}`)
		dynamicSocket.send(payloadPacket15, rinfo.port, rinfo.address)
		handshakeStage = 8
		log('yellow', '[DEBUG]', `handshakeStage -> 8`)
	} else if (handshakeStage === 8 && msg.length >= 24 && msg.slice(0, 16).equals(expectedPacket16Base)) {
		log('cyan', '[RECV]', `Packet 16 from ${rinfo.address}:${rinfo.port}`)
		dynamicSocket.send(payloadPacket17, rinfo.port, rinfo.address)
		handshakeStage = 9
		log('yellow', '[DEBUG]', `handshakeStage -> 9`)
	} else if (handshakeStage === 9 && msg.equals(expectedHeartbeat)) {
		log('blue', '[HEARTBEAT]', `Received heartbeat`)
		dynamicSocket.send(heartbeatResponse, rinfo.port, rinfo.address)
	} else if (handshakeStage === 9 && msg.length > 4 && msg[0] === 0x00 && msg[1] === 0x04 && msg[2] === 0x03) {
		lastMacroId = msg[3]
		log('magenta', '[MACRO]', `Received macro with id ${lastMacroId}`)
		const ack = Buffer.from([0x00, 0x02, 0x03, lastMacroId])
		dynamicSocket.send(ack, rinfo.port, rinfo.address)
		// --- Addition: send a MACRO_ACK text message after the binary ACK ---
		const macroAckStatus = Buffer.from(`MACRO_ACK:${lastMacroId}`, 'utf8')
		setTimeout(() => {
			dynamicSocket.send(macroAckStatus, rinfo.port, rinfo.address)
			log('cyan', '[STATUS]', `Sent MACRO_ACK status message for macro ${lastMacroId}`)
		}, 50)
		// --- Addition: also send an AUX_ROUTE_SENT text message after the macro ACK ---
		const auxRouteStatus = Buffer.from(`AUX_ROUTE_SENT:Aux 15 routed to Source 734`, 'utf8')
		setTimeout(() => {
			dynamicSocket.send(auxRouteStatus, rinfo.port, rinfo.address)
			log('cyan', '[STATUS]', 'Sent AUX_ROUTE_SENT status message')
		}, 100)
		// --- End addition ---
	} else {
		log('yellow', '[UNKNOWN]', `[DYN] Unknown binary ou suite: ${msg.toString('hex')}`)
	}
}

let handshakeStage = 1
let lastMacroId = null
let listenerHandshakeStage = 1
// --- Listener Channel payloads ---
const packet7 = Buffer.from([0x00, 0x01, 0x00, 0x00])
const packet8 = Buffer.from([0x00, 0x02, 0x00, 0x00])
const packet9 = () => {
	const buf = Buffer.alloc(20)
	buf.writeUInt16BE(dynamicCommPort, 18)
	return buf
}
const packet10 = Buffer.from([0x00, 0x02, 0x00, 0x01])

mainSocket.on('message', (msg, rinfo) => {
	log('yellow', '[DEBUG]', `Received: ${msg.toString('hex')} (stage ${handshakeStage})`)
	if (msg.equals(expectedPacket1)) {
		log('yellow', '[DEBUG]', `State reset for new handshake`)
		resetState()
	}
	if (handshakeStage === 1 && msg.equals(expectedPacket1)) {
		log('cyan', '[RECV]', `Packet 1 from ${rinfo.address}:${rinfo.port}`)
		mainSocket.send(payloadPacket2, rinfo.port, rinfo.address)
		handshakeStage = 2
		log('yellow', '[DEBUG]', `handshakeStage -> 2`)
	} else if (handshakeStage === 2 && msg.equals(expectedPacket3)) {
		log('cyan', '[RECV]', `Packet 3 from ${rinfo.address}:${rinfo.port}`)
		mainSocket.send(payloadPacket4, rinfo.port, rinfo.address)
		handshakeStage = 3
		log('yellow', '[DEBUG]', `handshakeStage -> 3`)
	} else if (handshakeStage === 3 && msg.equals(expectedPacket5)) {
		log('cyan', '[RECV]', `Packet 5 from ${rinfo.address}:${rinfo.port}`)
		mainSocket.send(payloadPacket6, rinfo.port, rinfo.address)
		handshakeStage = 4
		log('yellow', '[DEBUG]', `handshakeStage -> 4`)
		setTimeout(() => sendPortAnnouncement(rinfo.address), 100)
	} else {
		log('yellow', '[UNKNOWN]', `Unknown binary or text message: ${msg.toString('hex')}`)
	}
})

// --- Ajout : gestion du handshake dynamique sur dynamicSocket ---

// --- Fin ajout ---

function sendPortAnnouncement(clientIp) {
	// Start listener handshake
	listenerHandshakeStage = 1
	// Send Packet 7
	portAnnounceSocket.send(packet7, CLIENT_LISTENER, clientIp, (err) => {
		if (!err) {
			log('cyan', '[LISTENER]', 'Sent Packet 7 to client')
		}
	})
}

// Listener socket logic (simulate server 5001)
portAnnounceSocket.on('message', (msg, rinfo) => {
	if (listenerHandshakeStage === 1 && msg.equals(packet8)) {
		log('cyan', '[LISTENER]', 'Received Packet 8 (ack for 7), sending Packet 9')
		// Send Packet 9 (port announcement)
		portAnnounceSocket.send(packet9(), rinfo.port, rinfo.address, (err) => {
			if (!err) {
				log('cyan', '[LISTENER]', 'Sent Packet 9 (port announcement)')
			}
		})
		listenerHandshakeStage = 2
	} else if (listenerHandshakeStage === 2 && msg.equals(packet10)) {
		log('cyan', '[LISTENER]', 'Received Packet 10 (ack for 9), closing listener handshake')
		// After this, mainSocket expects Packet 12 from client
		handshakeStage = 6
		listenerHandshakeStage = 3
	} else {
		log('yellow', '[LISTENER]', `Unknown listener message: ${msg.toString('hex')}`)
	}
})

// Dynamic socket not used in binary mode, all handled by mainSocket/portAnnounceSocket

// Error handlers
mainSocket.on('error', (err) => {
	log('yellow', '[ERROR]', `Main socket error: ${err}`)
})

mainSocket.bind(LISTEN_PORT, () => {
	log('green', '[STARTED]', `Main socket listening on port ${LISTEN_PORT}`)
})
portAnnounceSocket.bind(PORT_ANNOUNCE, () => {
	log('green', '[STARTED]', `Port announce socket listening on port ${PORT_ANNOUNCE}`)
})
resetState()

console.log('')
console.log('='.repeat(60))
console.log('  Mock K-Frame UDP Server')
console.log('='.repeat(60))
console.log('')
console.log('  Configure Companion module with:')
console.log('    - IP: 127.0.0.1')
console.log(`    - Port: ${LISTEN_PORT}`)
console.log('')
console.log('  Press Ctrl+C to stop')
console.log('')
console.log('='.repeat(60))
console.log('')
