
import { Connection, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import bs58 from "bs58";
import axios from "axios";
import {Config} from "./interfaces/Config.ts";
import {delay, getCurrentLocalTime, logToFile, SOL} from "./utils.ts"



export async function jupiterTransact(inputMint: string, outputMint: string, inputAmount: number, outputAmount: number, config: Config) {
    const RPC_ENDPOINT = `https://rpc.shyft.to?api_key=${config.shyft_api_key}`;
    const USER_KEYPAIR = web3.Keypair.fromSecretKey(
        bs58.decode(config.private_key),
    );

    const SWAP_TOKEN_FROM = inputMint;
    const SWAP_TOKEN_TO = outputMint;
    const SWAP_AMOUNT = SWAP_TOKEN_FROM === SOL ?
        config.amount * LAMPORTS_PER_SOL : inputAmount; // If we are swapping from sol to whatever, then we use the amount given from config
    const COMMITMENT_LEVEL = "confirmed";
    const PRIORITY_FEE_LAMPORTS = Math.trunc(LAMPORTS_PER_SOL * config.priority_fee);
    const TX_RETRY_INTERVAL = 200; // TODO: How many times per second can i call?

    const connection = new Connection(RPC_ENDPOINT, {
        commitment: COMMITMENT_LEVEL,
    });


    let blockhash = await connection.getLatestBlockhash();

    let swapApiResult;

    let quoteResponse;
    let jupiterSwapTransaction;

    let txSignature = null;
    let confirmTransactionPromise = null;
    let confirmedTx = null;

    try {
        console.log(`[${getCurrentLocalTime()}] Fetching swap quote`);

        // Get quote for swap
        swapApiResult = await axios.get(`https://quote-api.jup.ag/v6/quote?inputMint=${SWAP_TOKEN_FROM}&outputMint=${SWAP_TOKEN_TO}&amount=${SWAP_AMOUNT}&slippageBps=${Math.trunc(config.slippage*100)}`);

        // throw error if response is not ok
        if (!(swapApiResult.status >= 200) && swapApiResult.status < 300) {
            throw new Error(
                `Failed to fetch swap quote: ${swapApiResult.status}`
            );
        }

        quoteResponse = swapApiResult.data;

        console.log(`[${getCurrentLocalTime()}] Fetched swap quote`);

        console.log(
            `[${getCurrentLocalTime()}] Fetching swap transaction`
        );


        swapApiResult = await axios.post(`https://quote-api.jup.ag/v6/swap`, {
            quoteResponse: quoteResponse,
            userPublicKey: USER_KEYPAIR.publicKey.toBase58(),
            wrapAndUnwrapSol: false,

            // Setting this to `true` allows the endpoint to set the dynamic compute unit limit as required by the transaction
            dynamicComputeUnitLimit: true,


            prioritizationFeeLamports: PRIORITY_FEE_LAMPORTS,
        });

        // throw error if response is not ok
        if (!(swapApiResult.status >= 200) && swapApiResult.status < 300) {
            throw new Error(
                `Failed to fetch swap transaction: ${swapApiResult.status}`
            );
        }

        jupiterSwapTransaction = swapApiResult.data;

        console.log(`[${getCurrentLocalTime()}] Fetched swap transaction`);

        const swapTransactionBuf = Buffer.from(
            jupiterSwapTransaction.swapTransaction,
            "base64"
        );

        const tx = VersionedTransaction.deserialize(swapTransactionBuf);
        tx.message.recentBlockhash = blockhash.blockhash;

        // Sign the transaction
        tx.sign([USER_KEYPAIR]);

        // Simulating the transaction
        const simulationResult = await connection.simulateTransaction(tx, {
            commitment: "confirmed",
        });

        if (simulationResult.value.err) {
            throw new Error(
                `Transaction simulation failed with error ${JSON.stringify(
                    simulationResult.value.err
                )}`
            );
        }

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
        while (!confirmedTx) {
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
            if (numberOfRetries === 150) {
                throw new Error(
                    "Too many retries. Fetching data again"
                );
            }
            numberOfRetries++;




            await connection.sendRawTransaction(tx.serialize(), {

                skipPreflight: true,

                maxRetries: 0,
            });
        }
    } catch (e) {
        console.error(`[${getCurrentLocalTime()}] Error: ${e}`);
        await logToFile(`Error ${e}`)
        console.log("Trying again")
    }

    if (!confirmedTx) {
        console.log(`[${getCurrentLocalTime()}] Transaction failed`);
        await delay(1000)
        await jupiterTransact(inputMint, outputMint, inputAmount, outputAmount, config)
        return;
    }

    let status = await connection.getSignatureStatus(txSignature as string);
    if (status.value?.err) {
        console.log("Slippage was exceeded")
        await delay(5000);
        return await jupiterTransact(inputMint, outputMint, inputAmount, outputAmount, config);
    }



    console.log(`[${getCurrentLocalTime()}] Transaction successful`);
    console.log(
        `[${getCurrentLocalTime()}] https://solscan.io/tx/${txSignature}`
    );
    let buy_or_sell = inputMint === SOL ?
        ["BOUGHT", config.amount, outputMint] :
        ["SOLD", Math.round((outputAmount/LAMPORTS_PER_SOL) * 100) / 100, inputMint]; // Virker jo ik, det er hans 2 sol



    await axios.post(config.webhook, {
        "username": "star",
        "embeds": [
            {
                "title": `${buy_or_sell[0]} ${buy_or_sell[1]} SOL of ${buy_or_sell[2]}`,
            },

        ],
    })



}