import * as path from "path";
import * as fs from 'fs/promises';
import {Config} from "./interfaces/Config";
import {
    Connection,
    PublicKey,
    Keypair,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction, VersionedTransaction,
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    getAssociatedTokenAddress,
    createSyncNativeInstruction,
    createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import * as web3 from "@solana/web3.js";
import bs58 from "bs58";

export const SOL = "So11111111111111111111111111111111111111112";

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export function getCurrentLocalTime(): string {
    const now = new Date();

    return now.getDate() + '-' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
}

export async function logToFile(message: string) {
    const logFile = path.join(__dirname, 'errorLogs.txt');
    const timestamp = getCurrentLocalTime();
    const logMessage = `${timestamp} - ${message}\n`;

    try {
        await fs.appendFile(logFile, logMessage);
    } catch (error) {

    }
}

export const CURRENT_DIR = process.cwd();

export async function readFile<T>(fileName: string): Promise<T> {
    try {
        const data = await fs.readFile(`${fileName}`, "utf8");
        return JSON.parse(data) as T;
    } catch (err) {
        console.error('Error reading or parsing file:', err);
        throw err;
    }
}

export async function checkAssociatedTokenAccount(
    connection: Connection,
    walletAddress: string,
    tokenMintAddress: string
): Promise<{ exists: boolean; address: PublicKey | null }> {
    try {
        const walletPublicKey = new PublicKey(walletAddress);
        const tokenMintPublicKey = new PublicKey(tokenMintAddress);

        // Derive the expected associated token account address
        const [associatedTokenAddress] = PublicKey.findProgramAddressSync(
            [
                walletPublicKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                tokenMintPublicKey.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Check if the account exists
        const account = await connection.getAccountInfo(associatedTokenAddress);

        return {
            exists: account !== null,
            address: associatedTokenAddress,
        };
    } catch (error) {
        console.error('Error checking associated token account:', error);
        return { exists: false, address: null };
    }
}

export async function createTokenAccountAdvanced(
    connection: Connection,
    payerAndOwner: Keypair,
    mintAddress: string
): Promise<string> {
    const mintPublicKey = new PublicKey(mintAddress);
    const [associatedTokenAddress] = PublicKey.findProgramAddressSync(
        [
            payerAndOwner.publicKey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mintPublicKey.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createAccountInstruction = createAssociatedTokenAccountInstruction(
        payerAndOwner.publicKey, // payer
        associatedTokenAddress,
        payerAndOwner.publicKey, // owner
        mintPublicKey
    );

    const transaction = new Transaction().add(createAccountInstruction);

    // Get a recent blockhash
    const blockhash = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash.blockhash;
    transaction.feePayer = payerAndOwner.publicKey;

    // Sign the transaction
    const signedTx = transaction.sign(payerAndOwner);
    const serializedTx = signedTx.serialize();

    // Create a VersionedTransaction
    const versionedTx = VersionedTransaction.deserialize(serializedTx);

    // Simulate the transaction
    const simulationResult = await connection.simulateTransaction(versionedTx, {
        commitment: 'confirmed',
    });

    if (simulationResult.value.err) {
        throw new Error(
            `Transaction simulation failed with error ${JSON.stringify(
                simulationResult.value.err
            )}`
        );
    }

    console.log(
        `[${getCurrentLocalTime()}] Transaction simulation successful`
    );

    const txSignature = bs58.encode(versionedTx.signatures[0]);

    console.log(
        `[${getCurrentLocalTime()}] Subscribing to transaction confirmation`
    );

    const confirmTransactionPromise = connection.confirmTransaction(
        {
            signature: txSignature,
            blockhash: blockhash.blockhash,
            lastValidBlockHeight: blockhash.lastValidBlockHeight,
        },
        'confirmed'
    );

    console.log(
        `[${getCurrentLocalTime()}] Sending Transaction ${txSignature}`
    );

    await connection.sendRawTransaction(serializedTx, {
        skipPreflight: true,
        maxRetries: 0,
    });

    let numberOfRetries = 0;
    let confirmedTx = null;

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

        if (numberOfRetries === MAX_RETRIES) {
            throw new Error('Too many retries. Fetching data again');
        }

        numberOfRetries++;

        await connection.sendRawTransaction(serializedTx, {
            skipPreflight: true,
            maxRetries: 0,
        });
    }

    console.log(`[${getCurrentLocalTime()}] Transaction confirmed`);
    console.log('Token account created successfully!');
    console.log('Transaction signature:', txSignature);
    console.log('Token account address:', associatedTokenAddress.toString());

    return txSignature;
}


export async function wrapSol(
    connectionString: string,
    payer: string,
    amountToWrap: number // in SOL
): Promise<string> {
    const connection = new Connection(connectionString, {
        commitment: "confirmed",
    });
    const USER_KEYPAIR = web3.Keypair.fromSecretKey(
        bs58.decode(payer),
    );
    // Convert SOL amount to lamports
    const lamports = amountToWrap * LAMPORTS_PER_SOL;

    // Get the associated token account address for wSOL
    const associatedTokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        USER_KEYPAIR.publicKey
    );

    // Check if the associated token account already exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAccount);

    const transaction = new Transaction();

    if (!accountInfo) {
        // If the account doesn't exist, add instruction to create it
        transaction.add(
            createAssociatedTokenAccountInstruction(
                USER_KEYPAIR.publicKey,
                associatedTokenAccount,
                USER_KEYPAIR.publicKey,
                NATIVE_MINT
            )
        );
    }

    // Add instruction to transfer SOL to the associated token account
    transaction.add(
        SystemProgram.transfer({
            fromPubkey: USER_KEYPAIR.publicKey,
            toPubkey: associatedTokenAccount,
            lamports,
        })
    );

    // Add instruction to sync the native account
    transaction.add(createSyncNativeInstruction(associatedTokenAccount));

    // Send and confirm the transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [USER_KEYPAIR]);

    console.log(`Wrapped ${amountToWrap} SOL to wSOL`);
    console.log(`Transaction signature: ${signature}`);
    console.log(`wSOL account address: ${associatedTokenAccount.toString()}`);

    return signature;
}

export async function checkWSOLAssociatedAccount(
    connection: Connection,
    walletAddress: string
): Promise<{ exists: boolean; address: PublicKey | null; balance: number | null }> {
    try {
        const walletPublicKey = new PublicKey(walletAddress);

        // Derive the expected associated token account address for wSOL
        const [associatedTokenAddress] = PublicKey.findProgramAddressSync(
            [
                walletPublicKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                NATIVE_MINT.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Check if the account exists
        const account = await connection.getAccountInfo(associatedTokenAddress);

        if (account !== null) {
            // If the account exists, get its balance
            const balance = await connection.getTokenAccountBalance(associatedTokenAddress);
            return {
                exists: true,
                address: associatedTokenAddress,
                balance: parseFloat(balance.value.amount) / Math.pow(10, balance.value.decimals)
            };
        } else {
            return { exists: false, address: associatedTokenAddress, balance: null };
        }
    } catch (error) {
        console.error('Error checking wSOL associated account:', error);
        return { exists: false, address: null, balance: null };
    }
}
