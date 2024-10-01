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
import WebSocket from "ws";

export const SOL = "So11111111111111111111111111111111111111112";

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export function getCurrentLocalTime(): string {
    const now = new Date();

    return now.getDate() + '-' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0') + ':' +
        String(now.getMilliseconds()).padStart(3, '0');
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
): Promise<PublicKey> {

    // Convert mint address string to PublicKey
    const mintPublicKey = new PublicKey(mintAddress);

    // Derive the associated token account address
    const associatedTokenAddress = PublicKey.findProgramAddressSync(
        [
            payerAndOwner.publicKey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mintPublicKey.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

    // Create the instruction to create the associated token account
    const createAccountInstruction = createAssociatedTokenAccountInstruction(
        payerAndOwner.publicKey,
        associatedTokenAddress,
        payerAndOwner.publicKey,
        mintPublicKey
    );

    // Create and send the transaction
    const transaction = new Transaction().add(createAccountInstruction);
    const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payerAndOwner]
    );



    return associatedTokenAddress;

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

export async function startPing(ws: WebSocket) {
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
            /*
                Her kan vi tjekke om hvad vi har og opdaterer det fordi hvis vi nu gerne vil lave en tp givet at
                Hver gang vi laver en handel så kan vi tracke det på en notepad hvor vores entry var henne
             */


        }
    }, 30000); // Ping every 30 seconds
}

export async function decodeBuffer(websocketData: WebSocket.Data) {
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
