import fetch from "node-fetch";
import getopts from "getopts";
import { c32address } from "c32check";
import {
  AuthType,
  broadcastTransaction,
  createStacksPrivateKey,
  deserializeTransaction,
  getAddressFromPrivateKey,
  PayloadType,
  SpendingCondition,
  sponsorTransaction,
  StacksTransaction,
  TransactionSigner,
} from "@stacks/transactions";
import { StacksNetwork, StacksMainnet, StacksTestnet } from "@stacks/network";
import { TransactionVersion } from "@stacks/common";

interface Tx {
  network: StacksNetwork;
  tx: StacksTransaction;
  sp: SpendingCondition;
  txtype: string;
  from: string;
  to: string;
  fee: bigint;
  nonce: bigint;
  status: string;
}

const ENV_SECRET_KEY = process.env.SECRET_KEY || "";

const options = getopts(process.argv, {
  alias: { help: ["h"] },
  default: { network: "mainnet", fee: "" },
  string: ["txid", "key", "fee"],
});

function usage(exit: number) {
  console.log(`
usage:
  fetch and describe transaction:
    retrytx --txid 0xtransactionID [--network testnet | mainnet]

  resubmit transaction:
    retrytx --txid 0xtransactionID --key secret-key --fee new-fee-in-ustx [--network testnet | mainnet]

  secret key can also be set with the $SECRET_KEY environment variable
  network defaults to mainnet
`);

  process.exit(exit);
}

function checkreqs() {
  if (options.help) {
    usage(0);
  }

  if (options.fee !== "") {
    try {
      options.fee = BigInt(options.fee);
    } catch (e) {
      console.error(e);
      usage(1);
    }
  }

  options.key = options.key || ENV_SECRET_KEY;
  if (options.fee && options.key.length !== 66 && options.key.length !== 64) {
    console.error(`invalid secret key: ${options.key}`);
    usage(1);
  }

  if (options.txid.trim() === "") {
    console.error(`invalid txid: ${options.txid}`);
    usage(1);
  }

  if (options.txid.slice(0, 2) !== "0x") {
    options.txid = `0x${options.txid}`;
  }

  if (options.network !== "mainnet" && options.network !== "testnet") {
    console.error(`invalid network: ${options.network}`);
    usage(1);
  }
}

function stxaddress(signer: string): string {
  if (options.network === "mainnet") {
    return c32address(22, signer);
  } else {
    return c32address(26, signer);
  }
}

async function fetchtx(): Promise<Tx> {
  let network: StacksNetwork;

  if (options.network === "mainnet") {
    network = new StacksMainnet();
  } else {
    network = new StacksTestnet();
  }

  const url = `${network.coreApiUrl}/extended/v1/tx/${options.txid}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (resp.status !== 200) {
    console.error(`error: ${resp.status} ${JSON.stringify(data, null, 2)}`);
    process.exit(1);
  }

  const status = data.tx_status;

  const rawurl = `${network.coreApiUrl}/extended/v1/tx/${options.txid}/raw`;
  // console.debug(`fetching from ${url}...`);
  const rawresp = await fetch(rawurl);
  const rawdata = await rawresp.json();
  if (rawresp.status !== 200) {
    console.error(
      `error: ${rawresp.status} ${JSON.stringify(rawdata, null, 2)}`
    );
    process.exit(1);
  }
  const tx = deserializeTransaction(rawdata.raw_tx);

  // console.debug(rawdata.raw_tx);

  let sp: SpendingCondition;
  let txtype: string;
  let from: string;
  let to: string;
  let fee: bigint;
  let nonce: bigint;

  if (tx.auth.authType === AuthType.Sponsored) {
    if (tx.auth.sponsorSpendingCondition !== undefined) {
      txtype = "(sponsored) ";
      sp = tx.auth.sponsorSpendingCondition;
      fee = sp.fee;
      nonce = sp.nonce;
    }
  } else {
    txtype = "";
    sp = tx.auth.spendingCondition;
    fee = sp.fee;
    nonce = sp.nonce;
  }

  from = stxaddress(sp.signer);

  switch (tx.payload.payloadType) {
    case PayloadType.TokenTransfer:
      txtype += "stx transfer";
      to = stxaddress(tx.payload.recipient.address.hash160);
      break;
    case PayloadType.ContractCall:
      txtype += "contract call";
      to = `${stxaddress(tx.payload.contractAddress.hash160)}.${
        tx.payload.contractName.content
      }`;
      break;
    case PayloadType.SmartContract:
      txtype += "contract deployment";
      to = "n/a";
  }

  return { tx, status, network, sp, txtype, from, to, fee, nonce };
}

async function describe() {
  const { txtype, status, from, to, fee, nonce } = await fetchtx();

  console.log(`tx type: ${txtype}
from ${from} to ${to}
fee: ${fee}, nonce: ${nonce}
tx status: ${status}
`);
}

async function resubmit() {
  const { status, tx, network, fee, from } = await fetchtx();

  if (status !== "pending") {
    console.warn(
      `transaction ${options.txid} might already be mined; status: ${status}`
    );
  }

  if (options.fee <= fee) {
    console.error(
      `new fee isn't larger that existing fee: ${options.fee} <= ${fee} `
    );
    process.exit(1);
  }

  let tv: TransactionVersion;

  if (options.network === "mainnet") {
    tv = TransactionVersion.Mainnet;
  } else {
    tv = TransactionVersion.Testnet;
  }

  const address = getAddressFromPrivateKey(options.key, tv);
  if (address !== from) {
    console.error(`private key ${options.key} did not sign this transaction`);
    console.error(`signer: ${from}, given key: ${address}`);
    process.exit(1);
  }

  let newtx: StacksTransaction;

  const privkey = createStacksPrivateKey(options.key);
  if (tx.auth.authType === AuthType.Standard) {
    tx.setFee(options.fee);
    const signer = new TransactionSigner(tx);
    signer.signOrigin(privkey);
    newtx = signer.transaction;
  } else {
    newtx = await sponsorTransaction({
      transaction: tx,
      sponsorPrivateKey: options.key,
      fee: options.fee,
      network: network,
    });
  }

  const reply = await broadcastTransaction(newtx, network);
  console.log(reply);
}

void (async () => {
  checkreqs();
  if (options.fee === "") {
    await describe();
  } else {
    await resubmit();
  }
})();
