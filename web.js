#!/usr/bin/env node

const WebSocket = require('ws');

// Configuration
const serverUrl = 'wss://spacegame.io:443';
const connectionTimeout = 5000; // 5 seconds

console.log(`Checking if WebSocket server at ${serverUrl} is available...`);

// Create a WebSocket connection
const ws = new WebSocket(serverUrl, {
    handshakeTimeout: connectionTimeout
});

// Set a timeout in case the connection attempt hangs
const timeout = setTimeout(() => {
    console.log('Connection attempt timed out after', connectionTimeout, 'ms');
    ws.terminate();
    process.exit(1);
}, connectionTimeout);

// Connection opened successfully
ws.on('open', () => {
    clearTimeout(timeout);
    console.log('SUCCESS: WebSocket server is up and running!');

    // Send a simple message (optional)
    // ws.send('Hello Server');

    // Close the connection after we've confirmed it works
    setTimeout(() => {
        ws.close();
        process.exit(0);
    }, 500);
});

// Error occurred during connection
ws.on('error', (error) => {
    clearTimeout(timeout);
    console.error('ERROR: Could not connect to WebSocket server');
    console.error('Reason:', error.message);
    process.exit(1);
});

// Connection closed
ws.on('close', (code, reason) => {
    clearTimeout(timeout);
    if (code !== 1000) {
        console.log(`Connection closed with code ${code}${reason ? ': ' + reason : ''}`);
    }
});