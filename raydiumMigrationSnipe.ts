import { Connection, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import bs58 from "bs58";
import axios from "axios";
import {MigrationSnipeConfig} from "./interfaces/migrationSnipeConfig";
import {
    delay,
    getCurrentLocalTime,
    logToFile,
    SOL,
    readFile,
    checkAssociatedTokenAccount,
    checkWSOLAssociatedAccount, createTokenAccountAdvanced, startPing, decodeBuffer,

} from "./utils"
import {main} from "./index";
import WebSocket from "ws";



export async function migrationRaydiumSnipe(outputMint: string, inputAmount: number, priority_fee: number) {
    const config = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig;
    const RPC_ENDPOINT = `${config.RPC}`;
    const USER_KEYPAIR = web3.Keypair.fromSecretKey(
        bs58.decode(config.private_key),
    );
    const WSS_ENDPOINT = `${config.RPC_WSS}`

    const SWAP_TOKEN_FROM = SOL;
    const SWAP_TOKEN_TO = outputMint;
    const SWAP_AMOUNT = inputAmount * LAMPORTS_PER_SOL
    const COMMITMENT_LEVEL = "confirmed";
    const PRIORITY_FEE_LAMPORTS = Math.trunc(LAMPORTS_PER_SOL * priority_fee);
    const TX_RETRY_INTERVAL = 1200/config.txn_per_sec; // 1000/

    const connection = new Connection(RPC_ENDPOINT, {
        commitment: COMMITMENT_LEVEL,
    });






    let quoteResponse;
    let raydiumTransaction;

    let txSignature = null;
    let confirmTransactionPromise = null;
    let confirmedTx = null;
    let outputAccount;
    let accountAvailable = await checkAssociatedTokenAccount(connection, USER_KEYPAIR.publicKey.toBase58(), outputMint)
    if (accountAvailable.exists && accountAvailable.address !== null) {
        outputAccount = accountAvailable.address;
        console.log(`[${getCurrentLocalTime()}] Already set up`);
    } else {

        console.log(`[${getCurrentLocalTime()}] Setting up to buy`);
        outputAccount = await createTokenAccountAdvanced(connection, USER_KEYPAIR, outputMint)
        }
        console.log(`[${getCurrentLocalTime()}] Set up to buy`);

    }

    let checkWrappedSolAccount = await checkWSOLAssociatedAccount(connection, USER_KEYPAIR.publicKey.toBase58());
    if (!checkWrappedSolAccount.exists || checkWrappedSolAccount.address === null) {
        console.log("No wrapped sol (wSOL)");
        return
    }
    let wrappedSolAccount = checkWrappedSolAccount.address



    try {
        console.log(`[${getCurrentLocalTime()}] Fetching swap quote`);
        let successfulRequest = false
        /*
            TODO: en wss som tjekker hvornår liq bliver added. så skal vi have en
         */
        let socket = new WebSocket(WSS_ENDPOINT)
        // Connection opened
        socket.on('open', async () => {
            console.log(`[${getCurrentLocalTime()}] Connected`);
            let data = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "logsSubscribe",
                "params": [
                    {
                        "mentions": ["39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg"]
                    },
                    {
                        "commitment": "confirmed"
                    }
                ]
            }
            socket.send(JSON.stringify(data));


            await startPing(socket)
        });


        socket.on('message', async (websocketData) => {
            let message = await decodeBuffer(websocketData);
            if (!message.params || !message.params.result) return

            const signature = message.params.result.value.signature

            let parsedTxn = await connection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0
            })

            if (parsedTxn?.transaction.message.accountKeys.length === 23) {
                if (parsedTxn?.transaction.message.accountKeys[19].pubkey.toBase58() === outputMint) {
                    socket.close()

                }
            }

            // TODO: Leg lidt rundt med det og find ud af om vi kan finde ud af om den har en bestemt størrelse altså antallet af keys
            //       Og derefter finder vi ud den mint vi kigger på er inkluderet. Så hver gang vi har en liq add så må antallet af keys
            //       Være den samme.




            // TODO: call socket.close() when we see that there is a migration from the inputMint we are looking for then we can start spamming.

        });


        socket.on('close', async () => {
            let swapApiResult;
            console.log(`[${getCurrentLocalTime()}] Migrated!`)
            while (!successfulRequest) {
                try {
                    console.log(`[${getCurrentLocalTime()}] Waiting for swap quote`);
                    swapApiResult = await axios.get(`https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=${SWAP_TOKEN_TO}&amount=${SWAP_AMOUNT}&slippageBps=${100 * config.slippage}&txVersion=V0`);
                    successfulRequest = swapApiResult.data.success
                    // https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50&txVersion=V0

                } catch (e) {
                    console.log(e)
                    await delay(100)
                }
            }

            // @ts-ignore
            quoteResponse = swapApiResult.data;


            console.log(`[${getCurrentLocalTime()}] Fetched swap quote`);

            console.log(
                `[${getCurrentLocalTime()}] Fetching swap transaction`
            );


            swapApiResult = await axios.post(`https://transaction-v1.raydium.io/transaction/swap-base-in`, {
                computeUnitPriceMicroLamports: `${PRIORITY_FEE_LAMPORTS}`,
                inputAccount: wrappedSolAccount.toBase58(),
                outputAccount: outputAccount.toBase58(),
                swapResponse: quoteResponse,
                txVersion: "V0",
                unwrapSol: false,
                wallet: USER_KEYPAIR.publicKey.toBase58(),
                wrapSol: false
            });

            // throw error if response is not ok
            if (!(swapApiResult.status >= 200) && swapApiResult.status < 300) {
                throw new Error(
                    `Failed to fetch swap transaction: ${swapApiResult.status}`
                );
            }

            raydiumTransaction = swapApiResult.data.data[0].transaction;

            console.log(`[${getCurrentLocalTime()}] Fetched swap transaction`);

            const swapTransactionBuf = Buffer.from(
                raydiumTransaction,
                "base64"
            );
            let blockhash = await connection.getLatestBlockhash();
            const tx = VersionedTransaction.deserialize(swapTransactionBuf);
            tx.message.recentBlockhash = blockhash.blockhash;

            // Sign the transaction
            tx.sign([USER_KEYPAIR]);

            // Simulating the transaction
            /*const simulationResult = await connection.simulateTransaction(tx, {
                commitment: "confirmed",
            });

            if (simulationResult.value.err) {
                throw new Error(
                    `Transaction simulation failed with error ${JSON.stringify(
                        simulationResult.value.err
                    )}`
                );
            }*/

            console.log(
                `[${getCurrentLocalTime()}] Transaction simulation successful result:`
            );

            const signatureRaw = tx.signatures[0];
            txSignature = bs58.encode(signatureRaw);

            console.log(
                `[${getCurrentLocalTime()}] Subscribing to transaction confirmation`
            );


            confirmTransactionPromise = connection.confirmTransaction(
                {
                    signature: txSignature,
                    blockhash: blockhash.blockhash,
                    lastValidBlockHeight: blockhash.lastValidBlockHeight,
                },
                "confirmed"
            );

            console.log(
                `[${getCurrentLocalTime()}] Sending Transaction ${txSignature}`
            );
            await connection.sendRawTransaction(tx.serialize(), {

                skipPreflight: true,

                maxRetries: 0,
            });

            let numberOfRetries = 0;
            confirmedTx = null;
            let status = await connection.getSignatureStatus(txSignature as string);
            // @ts-ignore
            while ((status.value?.confirmationStatus !== "confirmed")  || (status.value?.confirmationStatus !== "finalized")) {
                confirmedTx = await Promise.race([
                    confirmTransactionPromise,
                    new Promise((resolve) =>
                        setTimeout(() => {
                            resolve(null);
                        }, TX_RETRY_INTERVAL)
                    ),
                ]);
                if (confirmedTx) {
                    break;
                }
                numberOfRetries++;

                if (numberOfRetries === 150) {
                    throw new Error(
                        "Too many retries."
                    );
                }


                await connection.sendRawTransaction(tx.serialize(), {
                    skipPreflight: true,
                    maxRetries: 0,
                });
                status = await connection.getSignatureStatus(txSignature as string);

            }
        });

            // Get quote for swap

    } catch (e) {
        console.error(`[${getCurrentLocalTime()}] Error: ${e}`);
        await logToFile(`Error ${e}`)
    }

    if (!confirmedTx) {
        console.log(`[${getCurrentLocalTime()}] Transaction failed`);
        await delay(1000)
        return await main()
    }

    console.log(`[${getCurrentLocalTime()}] Transaction successful`);
    console.log(
        `[${getCurrentLocalTime()}] https://solscan.io/tx/${txSignature}`
    );

    await delay(5000);
    return await main()

}