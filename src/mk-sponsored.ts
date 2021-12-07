import fetch from "node-fetch";

import { StacksTestnet } from "@stacks/network";
import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  SignedContractCallOptions,
  SponsoredAuthorization,
  SponsorOptionsOpts,
  sponsorTransaction,
  stringAsciiCV,
} from "@stacks/transactions";

// creates the transaction
const creator = {
  mnemonic:
    "vessel cross have future dune shove zoo index tobacco theory volume solve trash rough supreme essence asthma husband desk doctor organ cactus omit script",
  keyInfo: {
    privateKey:
      "f6ba498a24cb97850567622cfebf3877c58059bef354286d3f8594c10d1ac03001",
    address: "ST2ZP2MA3GTJ5MFMVQR0MDD9QR8BYZBGH800N4XFR",
    btcAddress: "mxxswRkvsn2ez94G9VzQkymmkwK5m2a63f",
    wif: "L5VKMWjjfW8kLSPEnBXJ3DivyBRpTmVnukpomAu6Ux1V8whVxNvX",
    index: 0,
  },
};

// sponsors it
const sponsor = {
  mnemonic:
    "oval rain popular spend tired bachelor fuel just basket hard arrest label rib expand consider truck crash jaguar aware trip must melt useless panda",
  keyInfo: {
    privateKey:
      "ff50af39d13f9d34e0a10a666d78e4d448acbff5102ad18f99b86694e78e451d01",
    address: "ST30DSTGAB2VF12D6YM8QEBMW5QDRM77RHZX9TFHJ",
    btcAddress: "my6igGsxiZF9PDJL4Pyz4L1YnQ9mtCeMoU",
    wif: "L5n1Ycu3SFQ54sbrqWbh8kbpMu8fAqbJnMyL4eeu9VPQjtQGABp8",
    index: 0,
  },
};

const recipient = {
  mnemonic:
    "kingdom forget cycle shy century want vacant garlic immune lazy aim hover hip damage dose pact loan burden language sugar problem guess conduct fiber",
  keyInfo: {
    privateKey:
      "e8ca8018fae659875e15082c3a8deca5a31c345cc6222239154a488720b62ed301",
    address: "ST2CG4QWVTJZKT5FEJ9G4PRG0KW84320NK00MNWNY",
    btcAddress: "muTzXKGW1TQvrheZ3s7dD87JPte2c2MAmr",
    wif: "L52E5BkCL5Jzb6Zkd3TX9Gy5gBzKn1gJLbQsqgWbMCw9hAupnAkd",
    index: 0,
  },
};

const network = new StacksTestnet();

async function getNodeNonce(address: string): Promise<number> {
  const url = `${network.coreApiUrl}/v2/accounts/${address}`;
  // console.debug(`fetching from ${url}...`);
  const resp = await fetch(url);
  const data = await resp.json();
  if (resp.status !== 200) {
    console.error(`error: ${resp.status} ${JSON.stringify(data, null, 2)}`);
    process.exit(1);
  }

  return data.nonce;
}

void (async () => {
  const network = new StacksTestnet();

  const creatorNonce = BigInt(await getNodeNonce(creator.keyInfo.address));
  const txOptions: SignedContractCallOptions = {
    contractAddress: "ST3T6RJ8DKMJ4XB7DFTER1B9SX91GYBKXT27QC6FM",
    contractName: "c",
    functionName: "hello",
    functionArgs: [stringAsciiCV(new Date().toString())],
    senderKey: creator.keyInfo.privateKey,
    sponsored: true,
    fee: 0n,
    nonce: creatorNonce,
    anchorMode: AnchorMode.Any,
    network,
  };

  const tx1 = await makeContractCall(txOptions);

  console.log(`creator:
  ${tx1.serialize().toString("hex")},
  nonce ${tx1.auth.spendingCondition.nonce},
  txid ${tx1.txid()}
  `);

  const sponsorNonce = BigInt(await getNodeNonce(sponsor.keyInfo.address));
  const sponsorOptions: SponsorOptionsOpts = {
    transaction: tx1,
    sponsorPrivateKey: sponsor.keyInfo.privateKey,
    network,
    sponsorNonce,
    // fee: 320n,
  };

  const sponsoredTx = await sponsorTransaction(sponsorOptions);

  console.log(`sponsor:
  ${sponsoredTx.serialize().toString("hex")},
  sponsored nonce ${
    (sponsoredTx.auth as SponsoredAuthorization).sponsorSpendingCondition.nonce
  }
  txid ${sponsoredTx.txid()}
  `);

  const send = await broadcastTransaction(sponsoredTx, network);

  console.log(JSON.stringify(send, null, 2));
})();
