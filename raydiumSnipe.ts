import { Raydium } from '@raydium-io/raydium-sdk-v2'
import {Connection} from "@solana/web3.js";

async function main() {
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=ee5539a3-a64b-46e3-ad65-7b8ff6c9c163")
    const raydium = await Raydium.load({
        connection,
        disableLoadToken: false // default is false, if you don't need token info, set to true
    });
    let t0 = performance.now()
    //console.log(await raydium.api.getTokenInfo(['DtR4D9FtVoTX2569gaL837ZgrB6wNjj6tkmnX9Rdk9B2']))

    console.log(await raydium.api.fetchPoolByMints({mint1: 'So11111111111111111111111111111111111111112',
        mint2: 'FMsBBYMnMGx2gA6vR14MAZcCUagnRaLEqMjqddsFpump' // optional,
    // extra params: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/api/type.ts#L249

    }));
    let t1 = performance.now()
    console.log(t1 - t0)

}

main()