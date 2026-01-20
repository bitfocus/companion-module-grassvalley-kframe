# companion-module-grassvalley-k-frame

Companion module for controlling GrassValley K-Frame video production systems via UDP protocol.

## Features

- **Macro Recall**: Trigger macros 1-999 on the K-Frame
- **AUX Routing**: Route sources (1-850) to AUX buses (1-96)
- **Suite Switching**: Switch between suites (1A-4B)
- **Connection Status**: Real-time feedback on connection state
- **Auto-Reconnect**: Automatic reconnection with configurable retry attempts

## Configuration

| Parameter                 | Description                               | Default |
| ------------------------- | ----------------------------------------- | ------- |
| K-Frame IP Address        | IP address of the K-Frame system          | -       |
| Port                      | Initial connection port                   | 5000    |
| Keepalive Interval        | Heartbeat interval in milliseconds        | 2000    |
| Max Reconnection Attempts | Number of retry attempts before giving up | 5       |

## Actions

| Action       | Description                    | Parameters                               |
| ------------ | ------------------------------ | ---------------------------------------- |
| Macro Recall | Trigger a macro on the K-Frame | Macro Number (1-999)                     |
| AUX Route    | Route a source to an AUX bus   | AUX Number (1-96), Source Number (1-850) |
| Suite Switch | Switch the active suite        | Suite (1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B)   |

## Feedbacks

| Feedback          | Description                             |
| ----------------- | --------------------------------------- |
| Connection Status | Changes style based on connection state |
| Connected         | True when connected to K-Frame          |
| Disconnected      | True when disconnected                  |
| Connecting        | True when connecting or reconnecting    |
| Macro Sent        | Briefly true when a macro is sent       |
| AUX Sent          | Briefly true when an AUX route is sent  |

## Presets

The module includes pre-configured presets:

- **Connection Status**: Button showing current connection state (green/yellow/red)
- **Macro 1-10**: Quick access buttons for macros 1 through 10
- **AUX Route Template**: Template for AUX routing

## Protocol

This module implements the K-Frame UDP protocol:

1. **Handshake**: Client sends `connect` to port 5000, K-Frame responds with dynamic port
2. **Keepalive**: Periodic heartbeat messages to maintain connection
3. **Commands**: Macro, AUX, and Suite commands sent to dynamic port

## License

MIT - See [LICENSE](./LICENSE)

## Disclaimer

This plugin is not affiliated with Grass Valley®. Grass Valley® is a registered trademark of its respective owner. The User agrees to indemnify and hold harmless the Developer from all claims, damages, or liabilities arising from use of this Software with any Grass Valley® hardware or systems.

## Credits

Based on the protocol implementation from [gv-macro-player-streamdeck](https://github.com/Orthiconnn/gv-macro-player-streamdeck).
