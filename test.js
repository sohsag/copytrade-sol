let axios = require('axios');
const {LAMPORTS_PER_SOL} = require("@solana/web3.js");
const web3 = require("@solana/web3.js");
const bs58 = require("bs58");
const fs = require("fs");

console.log(1000/50)
/*
axios.get("https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=So11111111111111111111111111111111111111112&outputMint=6nMg3SRVwnP18r5tEZwQyjC4NLHqEf8LMFhGfH9Vpump&amount=1000000000&slippageBps=50&txVersion=V0")
.then(res => console.log(res.data.success))*/