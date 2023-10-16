---
aip: 53
title: Make Fee Payer Address Optional in Transaction Authenticator
author: davidiw
discussions-to: https://github.com/aptos-foundation/AIPs/issues/257
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 10/08/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): 39
---

# AIP-53 - Make Fee Payer Address Optional in Transactions Authenticator

## Summary

When submitting sponsored transactions to the blockchain, a client-side user may not know who is the actual fee payer. The current way these transactions are generated requires the client-side user to know who will be the fee payer for each transaction submitted to the blockchain. This AIP proposes making the knowledge of the fee payer optional enabling a better user and developer experience.

### Goals

This AIP makes it easier for a client to submit a sponsored transaction and be ignorant of who ultimately pays for it. As result, this will substantially improve the developer experience on Aptos.

## Alternative solutions

While there are a few discussions on refactoring the transaction layout to eliminate legacy quirks introduced by the long history of the Aptos code base, those proposals have yet to be published and will regretablly take substantial effort to gain adoption. Furthermore, these updates would require changes across many pieces within the Aptos software stack including SDKs, Indexers, as well as transaction and Move code resulting in several months of dedicated engineering ignoring the social challenges of pushing such an update.

## Specification

Currently, when signing a transaction, the fee payer's address is included within the data to be signed. As a result, all parties must first know the fee payer's address prior to being able to submit a transaction.

This AIP dictates that for non-fee payer signers, the fee payer's address may either be set to the actual address or to `0x0`, a non-allocated address within Move. The fee payer must still sign their address to ensure the intent to be the fee payer. As a result, during verification, each signature besides the fee payer's must be compared against the raw transaction computed with the actual fee payer's address and that of `0x0`.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/10443

## Testing

Verified via end-to-end tests.

## Risks and Drawbacks

There may be a slight performance degradation for sponsored transactions as now many formats need to be checked. These tend to be cheap and at worst case double the cost of verification. As most SDKs will likely conform to the simpler method of using `0x0`, this will inevitably become a negligible cost.

## Security Considerations

In the current model, everyone knows who the fee payer is. This gives a false sense of some form of security. The transaction is already unique by all the other components within so signing it with or without an explicit fee payer address is irrelevant.

This does, however, empower the user to generate a single transaction that can then be wrapped by distinct fee payers. From a visible perspective, this is not entirely different than what exists today. In either case, the Aptos Mempool design prevents two transactions with the same sequence number from being registered or executed, hence there is no consequence that comes from this change as extra transactions will be discarded prior to charging the fee payer.

## Timeline

The intended timeline for this AIP is release 1.8.
