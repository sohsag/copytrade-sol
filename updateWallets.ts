// update_wallet_stats.ts

import axios from 'axios';
import { fetchWallets } from './findWallets';
import {CURRENT_DIR, getCurrentLocalTime} from "./utils.ts";
import {FindWallet} from "./interfaces/FindWallet.ts";
import fs from "node:fs";
import path from "path";

interface Wallet {
    wins: number;
    losses: number;
    pnl: number;
    winrate: number;
    roi: number;
}

interface Holding {
    last_active_timestamp: number;
    total_profit: number;
}

interface WalletResponse {
    data: {
        next: any;
        holdings: Holding[];
    };
}

async function updateWalletStats(walletAddress: string, wallets: Record<string, Wallet>, timeframe: number, maxTrades: number, roi: number): Promise<Wallet> {
    let cursor = "";
    const wallet = wallets[walletAddress];
    const maxTime = Date.now() / 1000 - timeframe * 24 * 60 * 60;
    console.log(`[${getCurrentLocalTime()}]Calculating for ${walletAddress}`);
    let count = 0;

    while (cursor !== null) {
        try {
            const url = `https://gmgn.ai/defi/quotation/v1/wallet/sol/holdings/${walletAddress}?orderby=last_active_timestamp&direction=desc&showsmall=true&sellout=true&limit=50${cursor}&tx30d=true`;
            const response = await axios.get<WalletResponse>(url);

            if (response.status === 200) {
                const { data } = response.data;
                cursor = data.next;
                for (const holding of data.holdings) {
                    if (holding.last_active_timestamp < maxTime) {
                        return wallet;
                    }
                    if (count >= maxTrades) {
                        throw new Error('Too many trades');
                    }
                    if (holding.total_profit > 0) {
                        wallet.wins += 1;
                    } else {
                        wallet.losses += 1;
                    }
                    wallet.pnl += holding.total_profit;
                    wallet.roi = roi;
                    count += 1;
                }
            } else {
                console.log(`[${getCurrentLocalTime()}] ${response.status.toString()}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(`[${getCurrentLocalTime()}] ${error instanceof Error ? error.message : String(error)}`);
            throw new Error('Too many trades')
        }
    }
    return wallet;
}

export type OrderBy = 'pnl' | 'winrate' | 'roi';

export async function goodWallets(settings: FindWallet, contractAddress: string): Promise<[string, Wallet][]> {
    const acceptedWallets: Record<string, Wallet> = {};
    const wallets = await fetchWallets(contractAddress, settings.helius_api_key);
    let idx = 0;
    for (const [wallet] of Object.entries(wallets)) {
        if (wallet.startsWith('DCA')) {
            idx++;
            continue;
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const response = await axios.get(`https://gmgn.ai/defi/quotation/v1/smartmoney/sol/walletNew/${wallet}?period=7d`);
            if (response.data.data.pnl_7d < settings.minimumROI/100) {
                idx++;
                continue;
            }

            const updatedWallet = await updateWalletStats(wallet, wallets, settings.timeframe, settings.maximumAmountOfTrades, response.data.data.pnl_7d);
            const walletWinrate = Math.round((updatedWallet.wins / (updatedWallet.wins + updatedWallet.losses)) * 100);
            const walletPnl = updatedWallet.pnl;
            const numberOfTrades = updatedWallet.wins + updatedWallet.losses;

            if (numberOfTrades > settings.maximumAmountOfTrades) {
                idx++;
                continue;
            }


            updatedWallet.winrate = walletWinrate;
            console.log(`[${getCurrentLocalTime()}]${Object.keys(wallets).length - idx} left to check`);

            if (settings.minimumWinrate <= walletWinrate &&
                settings.minimumAmountOfTrades <= numberOfTrades &&
                numberOfTrades <= settings.maximumAmountOfTrades &&
                settings.minimumPnl <= walletPnl)
            {
                acceptedWallets[wallet] = updatedWallet;
            }
            idx++;
        } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            idx++;
        }
    }
    const filePath = path.join(CURRENT_DIR, "findWalletResults", `${contractAddress}.txt`);
    fs.writeFileSync(filePath, JSON.stringify(Object.entries(acceptedWallets).sort((a, b) => b[1][settings.orderBy] - a[1][settings.orderBy]), null, 4))
    return Object.entries(acceptedWallets).sort((a, b) => b[1][settings.orderBy] - a[1][settings.orderBy]);
}

// Example usage:
// const liste: string[] = [];
// for (const ca of liste) {
//   const result = await goodWallets(ca, 14, 10, 350, 40, 25000, 'winrate');
//   // Write result to file
// }