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
    checkWSOLAssociatedAccount,
    createTokenAccountWithRetry
} from "./utils"
import {main} from "./index";
import input from "@inquirer/input";
// https://www.quicknode.com/docs/solana/quote
// Vi vil gerne bare bruge dexes = raydium find uaf hvordan man gør det. vi må kalde 10 gange i sekundet vi gør bare hver 0.15 sekund
// når den findes så bruger vi bare jupitertransact og kører

//https://github.com/chainstacklabs/raydium-sdk-swap-example-typescript
//https://github.com/raydium-io/raydium-sdk

//
/*
Dette er api 1 for at få quote
https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50&txVersion=V0
{
    "id": "a85a6290-d43b-41b1-b23e-fee18c2ae8e4",
    "success": true,
    "version": "V1",
    "data": {
        "swapType": "BaseIn",
        "inputMint": "So11111111111111111111111111111111111111112",
        "inputAmount": "1000000000",
        "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "outputAmount": "156989496",
        "otherAmountThreshold": "156204548",
        "slippageBps": 50,
        "priceImpactPct": 0,
        "referrerAmount": "0",
        "routePlan": [
            {
                "poolId": "3nMFwZXwY1s1M5s8vYAHqd4wGs4iSxXE4LRoUMMYqEgF",
                "inputMint": "So11111111111111111111111111111111111111112",
                "outputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                "feeMint": "So11111111111111111111111111111111111111112",
                "feeRate": 1,
                "feeAmount": "100000",
                "remainingAccounts": [
                    "6W9iz52hgBAGmpWf6rWVm2cBkNU583KB3AfnRAa4gJHo",
                    "12ufQ8tc6AmvwetwDfdmupAT4xBVFdp596gznfJjSzuM",
                    "6uJ1PTZemryZA2SuDLk9EJcC1iX8BcvzYagYx1ZmPpqo"
                ],
                "lastPoolPriceX64": "7309039676286052831"
            },
            {
                "poolId": "BZtgQEyS6eXUXicYPHecYQ7PybqodXQMvkjUbP4R8mUU",
                "inputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "feeMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                "feeRate": 1,
                "feeAmount": "15698",
                "remainingAccounts": [
                    "FULWc1hWdGMBGSB4Ut3QZBCU74muZmLmM9z9UqheWoUw",
                    "2PufrkkvNj7nF32GRvoR1DEmXs8F99gYzyzCQtmbndxd",
                    "2CntbsRKrr4an5zekGb8WZyPyPzbXv9R2CErrRQSQVo2"
                ],
                "lastPoolPriceX64": "18445181599137265398"
            }
        ]
    }
}
Dette er api 2 for at få transactions data
https://transaction-v1.raydium.io/transaction/swap-base-in
er hvad vi sender
{'computeUnitPriceMicroLamports': '10465',
 'outputAccount': 'fw71qoLHbo4RevuggMfA6cefgMkFbjdNaTNw7bWgAYo',
 'swapResponse': {'data': {'inputAmount': '1000000000',
                           'inputMint': 'So11111111111111111111111111111111111111112',
                           'otherAmountThreshold': '156204548',
                           'outputAmount': '156989496',
                           'outputMint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                           'priceImpactPct': 0,
                           'referrerAmount': '0',
                           'routePlan': [{'feeAmount': '100000',
                                          'feeMint': 'So11111111111111111111111111111111111111112',
                                          'feeRate': 1,
                                          'inputMint': 'So11111111111111111111111111111111111111112',
                                          'lastPoolPriceX64': '7309039676286052831',
                                          'outputMint': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                                          'poolId': '3nMFwZXwY1s1M5s8vYAHqd4wGs4iSxXE4LRoUMMYqEgF',
                                          'remainingAccounts': ['6W9iz52hgBAGmpWf6rWVm2cBkNU583KB3AfnRAa4gJHo',
                                                                '12ufQ8tc6AmvwetwDfdmupAT4xBVFdp596gznfJjSzuM',
                                                                '6uJ1PTZemryZA2SuDLk9EJcC1iX8BcvzYagYx1ZmPpqo']},
                                         {'feeAmount': '15698',
                                          'feeMint': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                                          'feeRate': 1,
                                          'inputMint': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                                          'lastPoolPriceX64': '18445181599137265398',
                                          'outputMint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                                          'poolId': 'BZtgQEyS6eXUXicYPHecYQ7PybqodXQMvkjUbP4R8mUU',
                                          'remainingAccounts': ['FULWc1hWdGMBGSB4Ut3QZBCU74muZmLmM9z9UqheWoUw',
                                                                '2PufrkkvNj7nF32GRvoR1DEmXs8F99gYzyzCQtmbndxd',
                                                                '2CntbsRKrr4an5zekGb8WZyPyPzbXv9R2CErrRQSQVo2']}],
                           'slippageBps': 50,
                           'swapType': 'BaseIn'},
                  'id': 'a85a6290-d43b-41b1-b23e-fee18c2ae8e4',
                  'success': True,
                  'version': 'V1'},
 'txVersion': 'V0',
 'unwrapSol': False,
 'wallet': '2HTQdxnKTKyUcXMnsFXxXDqL5ZppTmV4SMcwYu4Mumtc',
 'wrapSol': True}

 */


export async function migrationRaydiumSnipe(outputMint: string, inputAmount: number, priority_fee: number) {
    const config = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig;
    const RPC_ENDPOINT = `${config.RPC}`;
    const USER_KEYPAIR = web3.Keypair.fromSecretKey(
        bs58.decode(config.private_key),
    );

    const SWAP_TOKEN_FROM = SOL;
    const SWAP_TOKEN_TO = outputMint;
    const SWAP_AMOUNT = inputAmount * LAMPORTS_PER_SOL
    const COMMITMENT_LEVEL = "confirmed";
    const PRIORITY_FEE_LAMPORTS = Math.trunc(LAMPORTS_PER_SOL * priority_fee);
    const TX_RETRY_INTERVAL = 1200/config.txn_per_sec; // 1000/

    const connection = new Connection(RPC_ENDPOINT, {
        commitment: COMMITMENT_LEVEL,
    });


    let blockhash = await connection.getLatestBlockhash();

    let swapApiResult;

    let quoteResponse;
    let raydiumTransaction;

    let txSignature = null;
    let confirmTransactionPromise = null;
    let confirmedTx = null;
    let outputAccount;
    let accountAvailable = await checkAssociatedTokenAccount(connection, USER_KEYPAIR.publicKey.toBase58(), outputMint)
    if (accountAvailable.exists && accountAvailable.address !== null) {
        outputAccount = accountAvailable.address;
        console.log(`[${getCurrentLocalTime()}] Token account already exists`);
    } else {
        console.log(`[${getCurrentLocalTime()}] Creating token account`);
        outputAccount = await createTokenAccountWithRetry(connection, USER_KEYPAIR, outputMint)
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
        // Get quote for swap
        while (!successfulRequest) {
            try {
                console.log(`[${getCurrentLocalTime()}] Waiting for swap quote`);
                swapApiResult = await axios.get(`https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=${SWAP_TOKEN_TO}&amount=${SWAP_AMOUNT}&slippageBps=${100*config.slippage}&txVersion=V0`);
                successfulRequest = swapApiResult.data.success
                // https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50&txVersion=V0

            } catch (e) {
                console.log(e)
                await delay(500)
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
            txVersion : "V0",
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

            if (numberOfRetries === 150) {
                throw new Error(
                    "Too many retries."
                );
            }


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
        return await main()
    }

    let status = await connection.getSignatureStatus(txSignature as string);
    if (status.value?.err) {
        console.log("Slippage was exceeded")
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