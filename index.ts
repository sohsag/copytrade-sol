import * as fs from 'fs/promises';
import {Connection} from "@solana/web3.js";

import {Helius} from "helius-sdk";
import {Config} from "./interfaces/Config";
import WebSocket from 'ws';

import {jupiterTransact} from './jupiterTransact.ts';
import {getCurrentLocalTime, delay} from './utils.ts';
import axios from "axios";


async function readFile(): Promise<Config> {
    try {
        const data = await fs.readFile("config.json", "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading or parsing file:', err);
        throw err;
    }
}

function decodeBuffer(websocketData: WebSocket.Data) {
    let buffer: string;
    if (typeof websocketData === 'string') {
        buffer = websocketData;
    } else if (websocketData instanceof Buffer) {
        buffer = websocketData.toString('utf-8');
    } else if (websocketData instanceof ArrayBuffer) {
        buffer = Buffer.from(websocketData).toString('utf-8');
    } else {
        buffer = Buffer.concat(websocketData).toString('utf-8');
    }
    return JSON.parse(buffer)
}

function getSwapDetails(swapDetails: any): [number, number, string, string] {
    let inputAmount = swapDetails.nativeInput ?
        swapDetails.nativeInput.amount : swapDetails.tokenInputs[0].rawTokenAmount

    let outputAmount = swapDetails.nativeOutput ?
        swapDetails.nativeOutput.amount : swapDetails.tokenOutputs[0].amount

    let inputMint = swapDetails.nativeInput ?
        "So11111111111111111111111111111111111111112" : swapDetails.tokenInputs[0].mint

    let outputMint = swapDetails.nativeOutput ?
        "So11111111111111111111111111111111111111112" : swapDetails.tokenOutputs[0].mint
    return [inputAmount, outputAmount, inputMint, outputMint]
}

function startPing(ws: WebSocket) {
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
            console.log(`[${getCurrentLocalTime()}] Listening for transactions`);
        }
    }, 30000); // Ping every 30 seconds
}

async function main() {
    try {
        const settings = await readFile();
        console.log(`[${getCurrentLocalTime()}] Copying the following wallets`)
        const helius = new Helius(settings.helius_api_key)
        for (let wallet of settings.wallets_to_track) {
            console.log(wallet)
        }
        const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${settings.helius_api_key}`)
        const rpc_connection = `wss://mainnet.helius-rpc.com/?api-key=${settings.helius_api_key}`
        let socket = new WebSocket(rpc_connection)
        // Connection opened
        socket.on('open', () => {
            console.log(`[${getCurrentLocalTime()}] Connected`);
            for (let wallet of settings['wallets_to_track']) {
                let data = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "logsSubscribe",
                    "params": [
                        {
                            "mentions": [wallet]
                        },
                        {
                            "commitment": "confirmed"
                        }
                    ]
                }
                socket.send(JSON.stringify(data));
            }

            startPing(socket)

        });


        const signatureSet = new Set<string>();
        // Listen for messages from the server
        socket.on('message', async (websocketData) => {
            let message = decodeBuffer(websocketData);
            if (!message.params || !message.params.result) return

            const signature = message.params.result.value.signature


            if (!signatureSet.has(signature)) {
                signatureSet.add(signature)
                let response = await axios.post(`https://api.helius.xyz/v0/transactions/?api-key=${settings.helius_api_key}`,
                    JSON.stringify({'transactions': [signature]}))
                while (response.data.length === 0) {
                    response = await axios.post(`https://api.helius.xyz/v0/transactions/?api-key=${settings.helius_api_key}`,
                        JSON.stringify({'transactions': [signature]}))
                    await delay(1000)
                }
                signatureSet.delete(signature)
                let data = response.data[0];
                if (data.type !== "SWAP") return
                console.log(`[${getCurrentLocalTime()}] Incoming transaction: https://solscan.io/tx/${signature}`)

                let [inputAmount, outputAmount, inputMint, outputMint] = getSwapDetails(data.events.swap)
                await jupiterTransact(inputMint, outputMint, inputAmount, settings)
            }












            /*
            let data = response.data[0];
            if (data.type !== "SWAP") return


            let [inputAmount, outputAmount, inputMint, outputMint] = getSwapDetails(data.events.swap)
            await jupiterTransact(inputMint, outputMint, inputAmount, settings)
            */

        });

        // Handle connection errors
        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        // Handle connection close
        socket.on('close', () => {
            console.log('Disconnected from WebSocket server');
            socket = new WebSocket(rpc_connection)
        });
        // const connection = new Connection()
        // const connection = new Connection()
        // Add your additional logic here
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
