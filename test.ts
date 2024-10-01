import axios from "axios"
import {Connection, LAMPORTS_PER_SOL} from "@solana/web3.js";
import web3 from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import {readFile} from "./utils";
import {MigrationSnipeConfig} from "./interfaces/migrationSnipeConfig";

async function main() {
    const config = await readFile("migrationSnipeSettings.json") as MigrationSnipeConfig;

    const RPC_ENDPOINT = `${config.RPC}`;

    const connection = new Connection(RPC_ENDPOINT, {
        commitment: "confirmed"
    });

    let txn_details = await connection.getParsedTransaction("zDE6Rd6sAtCRrGyGeYw5qFoxJXGdqGwzNFfWUAaWchhuxtbiqUpaSkXdpUiFghsMUUUjJbQokqBRLJGYJcs8TaK", {
        maxSupportedTransactionVersion: 0
    })

    console.log(txn_details?.transaction.message.accountKeys[19].pubkey.toBase58())



}


main()

/*
axios.get("https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=6nMg3SRVwnP18r5tEZwQyjC4NLHqEf8LMFhGfH9Vpump&amount=1000000000&slippageBps=50&txVersion=V0")
.then(res => console.log(res.data.success))*/