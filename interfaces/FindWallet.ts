import {OrderBy} from "../updateWallets.ts";

export interface FindWallet {
    'helius_api_key': string,
    'timeframe': number,
    'minimumWinrate': number
    'minimumAmountOfTrades': number
    'maximumAmountOfTrades': number
    'minimumPnl': number
    'minimumROI': number
    'orderBy': OrderBy
}