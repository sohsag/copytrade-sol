import * as fs from 'fs/promises';
import {Connection, Keypair} from "@solana/web3.js";
import {Helius} from "helius-sdk";
import {Config} from "./interfaces/Config";
import {Buys} from "./interfaces/Buys"
import WebSocket from 'ws';

import {jupiterTransact} from './jupiterTransact';
import {getCurrentLocalTime, delay, SOL, readFile, CURRENT_DIR} from './utils';
import axios from "axios";
import * as web3 from "@solana/web3.js";
import bs58 from "bs58";
import path from "path";



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
        SOL : swapDetails.tokenInputs[0].mint

    let outputMint = swapDetails.nativeOutput ?
        SOL : swapDetails.tokenOutputs[0].mint
    return [inputAmount, outputAmount, inputMint, outputMint]
}

async function startPing(ws: WebSocket) {
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
            console.log(`[${getCurrentLocalTime()}] Listening for transactions`);
            /*
                Her kan vi tjekke om hvad vi har og opdaterer det fordi hvis vi nu gerne vil lave en tp givet at
                Hver gang vi laver en handel så kan vi tracke det på en notepad hvor vores entry var henne
             */


        }
    }, 30000); // Ping every 30 seconds
}

async function takeProfit(ws: WebSocket, helius: Helius, keypair: Keypair) {
    setInterval(async () => {
        if (ws.readyState === WebSocket.OPEN) {
            let tokenBalance = await helius.rpc.searchAssets({
                page: 1,
                ownerAddress: keypair.publicKey.toString(),
                tokenType: 'fungible'
            })

        }
    }, 30000); // Ping every 30 seconds
}

export async function copyTrade(fileName: string) {
    try {
        const settings = await readFile(fileName) as Config;
        console.log(`[${getCurrentLocalTime()}] Copying the following wallets`)
        for (let wallet of settings.wallets_to_track) {
            console.log(wallet)
        }
        const keypair = web3.Keypair.fromSecretKey(
            bs58.decode(settings.private_key),
        );
        const helius = new Helius(settings.helius_api_key)
        const rpc_connection = `wss://mainnet.helius-rpc.com/?api-key=${settings.helius_api_key}`
        let socket = new WebSocket(rpc_connection)
        // Connection opened
        socket.on('open', async () => {
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

            await startPing(socket)
            // await takeProfit(socket, helius, keypair)

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
                // helius.connection.getParsedTransaction() kan måske optimeres med
                signatureSet.delete(signature)
                let data = response.data[0];
                if (data.type !== "SWAP") return
                console.log(`[${getCurrentLocalTime()}] Incoming transaction: https://solscan.io/tx/${signature}`)

                let checkSignature = await helius.connection.getSignatureStatus(signature)
                if (checkSignature.value?.err) return;
                if (!data.events.swap) return

                let [inputAmount, outputAmount, inputMint, outputMint] = getSwapDetails(data.events.swap)
                if (inputMint === SOL) {
                    return await jupiterTransact(inputMint, outputMint, inputAmount, outputAmount, settings)
                }
                let tokenBalance = await helius.rpc.searchAssets({page: 1, ownerAddress: keypair.publicKey.toString(), tokenType: 'fungible'})
                for (const item of tokenBalance.items) {
                    if (item.id === inputMint) {
                        if (typeof item.token_info?.balance === 'undefined') return;
                        // We could check what holder holds and sell the same % of ours token in similar way.
                        await jupiterTransact(inputMint, outputMint, item.token_info?.balance as number, outputAmount, settings);
                    }

                    // Skal være atomic, alsåts når vi sender en transaction så skal den gennemføres før andre på komme.

                    // Vi kan bare finde prisen af sol og bruge den imod usdc som vi får fra token balances
                    // på den måde ved vi hvad prisen var da vi købte det

                    // Protection imod at blive fucked af en som sælger køber sælger samme om og om igen for at fucke med copy trader
                    // hvis man har k'bt og solgt en pair så må man ikke enter samme possition igen. så hvis man har solgt så noteres det på en liste
                    // og så må man ikke handle med det mere på nær sol self

                    // måske også track record af dem og hvis de har flere end 3 losing trades så bliver de smidt af listen
                    // eller to, men så er det indenfor et kort interval e.g. 30 min

                    // USDC support?
                }
                /*
                const filePath = path.join(CURRENT_DIR, `copyTradeBuys.json`);
                let buy = await readFile<Buys[]>(filePath)
                let price_in_usdc = await axios.get(
                    "ttps://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112",
                    {headers: {'X-API-KEY': '8c85407ed09d46d9990d86a83db39912'}}
                );
                for (let b of buy) {
                    if (b.contract_address === inputMint) {
                        // Plus hvad man allerede har købt
                    }
                }
                buy.push({'contract_address': inputMint, 'price_in_usdc': price_in_usdc.data.data.value * inputAmount})
                fs.writeFile(filePath, JSON.stringify(buy, null, 4));
                // kan nok godt få en pris fra quote

                 */
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
            console.log('Reconnecting...');
            return copyTrade(fileName)
        });
        // const connection = new Connection()
        // const connection = new Connection()
        // Add your additional logic here
    } catch (err) {
        console.error('Error:', err);
    }
}


