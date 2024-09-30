// find_wallets.ts

import axios from 'axios';
import {getCurrentLocalTime} from "./utils";




interface Wallet {
    wins: number;
    losses: number;
    pnl: number;
    winrate: number;
    roi: number;
}

interface NativeOutput {
    account: string;
}

interface SwapEvent {
    nativeInput?: NativeOutput;
    nativeOutput?: NativeOutput;
}

interface Transaction {
    events?: {
        swap?: SwapEvent;
    };
    signature: string;
}

const wallets: Record<string, Wallet> = {};

function processSol(nativeOutput: NativeOutput | undefined): void {
    if (nativeOutput) {
        const account = nativeOutput.account;
        if (!(account in wallets)) {
            wallets[account] = { wins: 0, losses: 0, pnl: 0, winrate: 0, roi: 0};
        }
    }
}

export async function fetchWallets(coin: string, helius_api_key: string): Promise<Record<string, Wallet>> {
    let lastSignature = "";
    while (true) {
        try {
            const url = `https://api.helius.xyz/v0/addresses/${coin}/transactions?api-key=${helius_api_key}${lastSignature}&type=SWAP`;
            const response = await axios.get<Transaction[]>(url);

            if (response.status === 200) {
                const data = response.data;
                if (data.length > 0) {
                    for (const transaction of data) {
                        const events = transaction.events?.swap || {};
                        processSol(events.nativeInput);
                        processSol(events.nativeOutput);
                        // Uncomment if needed:
                        // processToken(events.tokenOutputs);
                        // processToken(events.tokenInputs);
                        lastSignature = "&before=" + transaction.signature;
                        if (!lastSignature) {
                            return wallets;
                        }
                    }
                } else {
                    break;
                }
            } else {
                console.log("Failed to fetch data:", response.status);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 600));
            console.log(`[${getCurrentLocalTime()}] Searching for wallets, currently ${Object.keys(wallets).length} wallets found`);
        } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            return wallets;
        }
    }
    return wallets;
}

