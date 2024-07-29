import { Connection, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import bs58 from "bs58";
import axios from "axios";
import {MigrationSnipeConfig} from "./interfaces/migrationSnipeConfig.ts";
import {delay, getCurrentLocalTime, logToFile, SOL, readFile} from "./utils.ts"
import input from "@inquirer/input";
// https://www.quicknode.com/docs/solana/quote
// Vi vil gerne bare bruge dexes = raydium find uaf hvordan man gør det. vi må kalde 10 gange i sekundet vi gør bare hver 0.15 sekund
// når den findes så bruger vi bare jupitertransact og kører

//https://github.com/chainstacklabs/raydium-sdk-swap-example-typescript
//https://github.com/raydium-io/raydium-sdk




export async function migrationSnipe(outputMint: string, inputAmount: number, priority_fee: number) {
    const config = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig;
    const RPC_ENDPOINT = `https://rpc.shyft.to?api_key=${config.shyft_api_key}`;
    const USER_KEYPAIR = web3.Keypair.fromSecretKey(
        bs58.decode(config.private_key),
    );

    const SWAP_TOKEN_FROM = SOL;
    const SWAP_TOKEN_TO = outputMint;
    const SWAP_AMOUNT = inputAmount * LAMPORTS_PER_SOL
    const COMMITMENT_LEVEL = "confirmed";
    const PRIORITY_FEE_LAMPORTS = Math.trunc(LAMPORTS_PER_SOL * priority_fee);
    const TX_RETRY_INTERVAL = 40; // TODO: How many times per second can i call?

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
        let swapApiResult;
        // Get quote for swap
        while (typeof swapApiResult === "undefined") {
            try {
                console.log(`[${getCurrentLocalTime()}] Waiting for swap quote`)
                swapApiResult = await axios.get(`https://public.jupiterapi.com/quote?inputMint=${SWAP_TOKEN_FROM}&outputMint=${SWAP_TOKEN_TO}&amount=${SWAP_AMOUNT}&slippageBps=${Math.trunc(config.slippage*100)}&dexes=Raydium`);

            } catch (e) {
                console.log(e)
                await delay(120)
            }
        }

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


        swapApiResult = await axios.post(`https://public.jupiterapi.com/swap`, {
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
            numberOfRetries++;




            await connection.sendRawTransaction(tx.serialize(), {

                skipPreflight: true,

                maxRetries: 0,
            });
        }
    } catch (e) {
        console.error(`[${getCurrentLocalTime()}] Error: ${e}`);
        await logToFile(`Error ${e}`)
    }

    if (!confirmedTx) {
        console.log(`[${getCurrentLocalTime()}] Transaction failed`);
        await delay(1000)
        return;
    }

    let status = await connection.getSignatureStatus(txSignature as string);
    if (status.value?.err) {
        console.log("Slippage was exceeded")
        return
    }

    console.log(`[${getCurrentLocalTime()}] Transaction successful`);
    console.log(
        `[${getCurrentLocalTime()}] https://solscan.io/tx/${txSignature}`
    );

}