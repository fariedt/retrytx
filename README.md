# Retry STX transactions with a higher fee

## Build:

    npm install
    npm run build

## Use:

### View a transaction's status:

    node dist/retrytx.js --txid 0xwhatever [--network testnet | mainnet]

`--network` can be `testnet` or `mainnet`; defaults to `mainnet`.

### Retry with a larger fee:

    node dist/retrytx.js --txid 0xwhatever --fee new-fee-in-ustx \
    --key secret-key [--network testnet | mainnet]

The secret key can also be specified in the `$SECRET_KEY` environment
variable:

    env SECRET_KEY=secret-key node dist/retrytx.js \
    --txid 0xwhatever --fee new-fee-in-ustx \
    [--network testnet | mainnet]

## Caveats:

* Lightly tested on the testnet.
* It doesn't support sponsored transactions right now.
* How do tell if a transaction has been mined?
