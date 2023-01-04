---
aip: 8
title: Transaction fee distribution
author: georgemitenkov
discussions-to: https://github.com/aptos-foundation/AIPs/issues/23
Status: Draft
last-call-end-date (*optional):
type: Standard (framework)
created: 12/20/2022
---
## Summary

Currently, all transaction fees are burnt on Aptos. This design choice does not motivate validators to prioritise the highest value transactions, as well as use bigger blocks of transactions, leading to lower throughput of the system. For example, a validator can submit an empty block and still get rewarded. We would like to solve this issue by distributing transaction fees to validators. In particular, we want to collect transaction fees for each block, store them, and then redistribute at the end of each epoch.

## Motivation

If transaction fees are redistributed to validators, we will be able to both 1) ensure that the highest value transactions have a priority 2) increase the throughput of the system to gain more performance advantages of the parallel execution.

## Proposal

Enable collection and per-epoch distribution of transaction fees to validators. 

## Rationale

In order to keep the system configurable, we have an on-chain parameter which dictates what percentage of transaction fees should be burnt (called `burn_percentage`). This way, burning 100% of transaction fees would allow the system to have the same behaviour as it has now. Burning 0% would mean that all transaction fees are collected and distributed to validators. The formula deciding how much to burn and how much to collect is the following:

```
burnt_amount   = burn_percentage * transaction_fee / 100
deposit_amount = transaction_fee - burnt_amount
```

Based on the discussion with the community, the initial burning percentage can be set and later upgraded via a governance proposal. While it seems like 0% burning would be a reasonable initial parameter value, one has to consider the effects on the tokenomics, e.g. inflation.

## Alternatives

**Alternative I: Distributing fees every transaction**

Recall that we want to distribute transaction fee to the validator which proposed the block. Doing it per transaction has numerous disadvantages:

1. Updating the balances of validators per each transaction is a bottleneck for the parallel execution engine, as it creates a read-modify-write dependencies. While it can be alleviated by implementing balance as aggregator, it is not possible in the current system.

2. Validators obtain voting rewards on per-epoch basis, and certain smart contracts can rely on that fact. Having the balance of the validator change per transaction can break this logic and be not compatible.

**Alternative II: Distributing fees every block**

In order to solve the first disadvantage from Alternative I, we can instead collect into a special balance which uses aggregator to avoid read-modify-write conflicts in parallel execution. This way each transaction in the block updates the aggregator value with the fee, and when the block ends the total value is distributed to the proposer of the block.

Note that this approach does not solve the second disadvantage from Alternative I, which leads to our proposal.

## Implementation

Draft PR: [https://github.com/aptos-labs/aptos-core/pull/4967](https://github.com/aptos-labs/aptos-core/pull/4967)

**Algorithm overview**

1. When executing a single transaction in the block, the epilogue puts the gas fees into a special aggregatable coin stored on the system account. In contrast to standard coin, changing the value of aggregatable coin does not cause conflicts during the parallel execution. Aggregatable coin can be "drained" to produce the standard coin.

2. In the first transaction of the next block (i.e. `BlockMetadata`), we process collected fees in the following way:

- Drain the aggregatable coin to obtain the sum of transaction fees of the previous block. As mentioned above, draining returns a standard coin.
- Decide what proportion of fees is burnt and what is distributed later (see the formula in rationale).
- Burn the amount which is not supposed to be distributed.
- Store the amount which is supposed to be distributed to a special table stored on the systems account. Basically, this creates (or updates) a map entry from the proposer's address to the fee yet to be distributed.
- Store the address of this block proposer so that the next block we can repeat the procedure in (2) and process fees.

3. At the end of the current epoch, distribute collected fees. For each pending active and inactive validator, get the collected fee and deposit it to the stake pool of the validator.

*Note: in the current implementation fees for governance proposals are simply burnt. This is subject to discussion and can change in the future*

## Risks and Drawbacks

Decentralization - no impact or changes.

Performance - the usage of aggregator avoids the conflicts in parallel executor.

Security - the added code will go through strict testing and auditing.

Tooling - no impact or changes.

## Future Potential

The proposed change allows to control what fraction of the transaction fees is collected and what fraction is burnt. In the future it can be adjusted using a governance proposal.

## Timeline

The change is currently being tested using e2e Move tests and smoke tests. Ideally, it should be enabled in the testnet soon.
