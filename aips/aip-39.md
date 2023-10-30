---
aip: 39
title: Separate gas payer
author: gerben-stavenga, movekevin, davidiw, kslee8224, neoul, styner32
discussions-to: https://github.com/aptos-foundation/AIPs/issues/173
Status: Draft
last-call-end-date: TBD
type: Standard (Core)
created: 06/14/2023
---

# AIP 39 - Separate gas payer
## Summary

This AIP proposes a mechanism for specifying a different gas payer account from the transaction sender. The gas for the transaction is deducted from the gas payer account while not giving access to its signer for any other purposes - the transaction would be executed exactly the same regardless of who pays for gas.

## Motivation

It’s a common use case where an app can pay for gas on behalf of their users. Currently, transactions on Aptos always deduct gas from the sender from normal single-sender transactions or primary sender for multi-agent transactions. There is no direct support for specifying a different account where gas should be deducted from. Users can currently construct multi-agent transactions and call a custom proxy Move function so that:

1. The primary sender is the gas payer and gas is deducted from this account.
2. The secondary sender is the actual signer that would be used in the transaction execution. The proxy call would discard the first signer (from the gas payer) and pass the second signer to the destination function call.

Although this could achieve the desired effect of a separate gas payer, this approach is cumbersome and requires both custom on-chain and off-chain code. Furthermore, this would use the gas payer’s nonce, which creates a bottleneck for scaling gas paying operations where the gas payer account could be paying gas for many transactions from many different users.

## Proposal

We can properly support separating the gas payer account from the sender while preserving the same effects as if the sender sends the transaction themselves. This means:

- The nonce of the sender account should be used, not the gas payer’s. This allows for easier scaling of gas paying operations.
- Transactions with a separate gas payer should use the same payload as a normal transaction (both entry function and script calls) and should not require intermediate proxy code to deal with multiple signers.

### Generalizing multi-agent transactions

Multi-agent transactions have been useful in the past as a primitive construct for extending a standard transaction (with a list of secondary signers). Specifically, multi-agent transactions introduce [RawTransactionWithData](https://github.com/aptos-labs/aptos-core/blob/main/types/src/transaction/mod.rs#L421) - a wrapper data construct around a standard SignedTransaction that adds more data to it. This allows signature verification to then verify that a signed transaction from the user also contains extra data (e.g. secondary signers). We can leverage this same data structure to extend a transaction with data related to paying gas:

```
pub enum RawTransactionWithData {
    MultiAgent {
        raw_txn: RawTransaction,
        secondary_signer_addresses: Vec<AccountAddress>,
    },
    MultiAgentWithFeePayer {
        raw_txn: RawTransaction,
        secondary_signer_addresses: Vec<AccountAddress>,
        fee_payer_address: AccountAddress,
    },
}
```

This can be thought of as a generalization of MultiAgent transaction data, allowing an encompassing new transaction data type that can add a separate fee payer address and signature to all kinds of transactions, including MultiAgent. The flow works as below:

1. To send a transfer of USDC from 0xsender to 0xreceiver where a separate account 0xpayer pays for gas, the app can first construct a multi-agent transaction with the standard payload (entry function 0x1::aptos_account::transfer_coins where the sender is 0xsender). 0xpayer is specified as the fee_payer_address in RawTransactionWithData::MultiAgentWithFeePayer. All of this can be done easily with SDK support.
2. The app can prompt the user to sign the transaction payload with their account 0xsender. The user can clearly see they're signing a transaction with a separate gas fee payer address.
3. The payload and the signature can then be passed to the server side where 0xpayer will review and sign the transaction.
4. The transaction is now complete. 0xpayer can send the transaction themselves or passes back to the client side for the user (0xsender) to submit it themselves. Either way, gas will be deducted from 0xpayer and the transaction will be executed in the context of 0xsender, using their account’s nonce and signer.

The implementation is relatively straightforward:

1. Create new multi_agent prologue and epilogue functions where nonce/gas validation and final gas charge should be applied on the separate gas payer account instead of the sender. The execution flow should also verify that the gas payer signature is valid and both the sender and gas payer signed over the newly introduced RawTransactionWithData::MultiAgentWithFeePayer transaction data.
2. Update aptos_vm to correctly call the new prologue/epilogue flow instead when a separate gas payer address is present.
3. Update the SDK to support adding a separate gas payer at the end of the sender address list.
4. Changes to the coin_model used in the default coin processor in Indexer to correctly attribute the gas burn activity to the gas payer, instead of the sender

## Impact on indexing

In either approach, the coin processor/model would need to be updated to correctly attribute gas burn events (currently hardcoded to be the sender). Indexing service providers and ecosystem projects who run their own indexing would need to upgrade their code to get this change.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/8904

## Risks and Drawbacks

The primary risk is smart contract risk where there can be bugs or vulnerabilities in the VM (gas charging) and Move (transaction prologue/epilogue) changes

## Future Potential

Gas payer paves the way for many exciting extensions in the future, such as:

1. Paying for gas using an object instead of account
2. More generic account authentication with fully customized control over which account/object can be used for gas, or whether the account’s signer can be used for specific purposes. This is related to the gas change here as this is the first non-trivial modification of the transaction prologue/epilogue flow with rigid single sender mechanism that has existed since the Diem time

## Suggested implementation timeline

To be included in the v1.6 release, which goes to testnet by end of June 2023 and mainnet in July 2023
