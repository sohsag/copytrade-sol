import axios from "axios"
import {LAMPORTS_PER_SOL} from "@solana/web3.js";
import web3 from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import {readFile} from "./utils";
import {MigrationSnipeConfig} from "./interfaces/migrationSnipeConfig";




/*
axios.get("https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=6nMg3SRVwnP18r5tEZwQyjC4NLHqEf8LMFhGfH9Vpump&amount=1000000000&slippageBps=50&txVersion=V0")
.then(res => console.log(res.data.success))*/