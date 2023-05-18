---
aip: 34
title: Unit Gas Price Estimation
author: bchocho
discussions-to (*optional): 
Status: Draft
last-call-end-date (*optional):
type: Standard
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-34 - Unit Gas Price Estimation

## Motivation

Transactions are prioritized at mempool, consensus, and execution based on unit gas price — the price (in APT) that each transaction has committed to pay for each unit of gas. Clients need a way to estimate the unit gas price they should use to get a transaction executed on chain in a reasonable amount of time. This proposal contains a design where Aptos fullnodes provide an API to be used by clients for this purpose.

## Rationale

Each client must use an estimate that satisfies their current cost-latency tradeoff. In other words, to give a good estimate, there are competing concerns:

1. The client would like to get a transaction executed within a reasonable time.
2. The client wants to pay the least required gas to get the transaction executed within a reasonable time.

A previous implementation of unit gas price estimation used a rolling average of unit gas fees paid as an estimate. This failed to provide (2) because prices did not “reset” — once gas fees went up, and most clients were using the estimation API, the fees failed to go back down, even if the load on the system was small enough that extra gas fees were not needed.

## Specification

We propose a design based on load on the Aptos blockchain, in addition to historical unit gas fees paid. At a high level, we will provide an estimate for the gas unit price required to get a transaction into the next block. The estimate is based on recent history, but it is impossible to predict the future. Thus, the API provides three values — low, market, and aggressive — based on the confidence of the estimate, that the client can use based on their current cost-latency tradeoff.

(We take inspiration from Ethereum’s [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) uses block load and [Metamask provides](https://metamask.io/1559/) low, market, and aggressive gas fees based on this information. Although the details deviate significantly, based on how the Aptos blockchain is built.)

### Full blocks

We take into account if blocks are “full”; if blocks are not full, then we should not raise the gas estimation regardless of what the transactions that were included in the non-full block paid. We can classify full blocks if they meet either of the following:

- **Transaction count.** Within consensus and execution, blocks are constrained by transaction count and sizes. In most cases, transaction count can be used as a measure of load — if the max transaction count is reached, the block is fully loaded, and if not then the block still had space for transactions.
  Transactions are added to blocks within Quorum Store batches, so the max transaction count may be reached with some fragmentation, e.g., the last batch considered did not fit in the block, so the block is smaller than the max, but still considered fully loaded.
  The max transaction count of a block is dynamically adjusted by the proposer based on current blockchain performance. For purposes of unit gas price estimation, we propose using the smallest possible max transaction count as an indicator for a fully loaded block.Then we divide this value by half, to account for fragmentation due to Quorum Store batching.
  With current default configs, the min block size is 250 transactions, and so the full block threshold would be 125 transactions.
- **Gas usage.** AIP-33 proposes a gas limit per block. This means that a block can have a small number of transactions because the transactions that were executed reached the gas limit. Thus blocks with a high gas usage are also classified as full.

### Minimum gas unit price for inclusion in block

Each block has a minimum inclusion price (min_inclusion_price), i.e., the lowest gas unit price that would have guaranteed inclusion in the block. For non-full blocks, we simply set min_inclusion_price = 100, which is the minimum system gas unit price. This is because a transaction would have been included regardless of the gas unit price.

For full blocks, we take the smallest gas unit price in the block and then bump up the gas bucket, taking the minimum end of the next gas bucket. This is because transactions are batched within buckets during dissemination, both at mempool and Quorum Store, so the minimum guaranteed inclusion is a higher bucket.

### Objectives and formulas

We define the following loose objectives, and their formulas below. A call to the estimation API will return the three values below - for backward compatibility, the old API will return market.

- Low: Take the minimum of the min_inclusion_price across the past 10 blocks.
- Market: Take the p50 of the min_inclusion_price across the last 30 blocks.
- Aggressive: Take the p90 of the min_inclusion_price across the last 120 blocks. Additionally, round up to the next gas bucket.

The more aggressive values look at a larger time window and take a higher percentile, to increase confidence that the transactions will be included in the next few blocks. The most aggressive value also bumps up an additional gas bucket, adding confidence that the transaction dissemination will not be delayed.

Note that because min_inclusion_price = 100 for non-full blocks, observing non-full blocks will reset all three values regardless of the gas fees used in the transactions, e.g., low will reset with any non-full block in the past 10 blocks, market will reset when 15 out of the last 30 blocks are non-full, and aggressive will reset when 108 out of the last 120 blocks are non-full.

### Examples

We illustrate how this works in different scenarios, we present some simple examples, using the current system configs.

(A) The blockchain is lightly loaded, so has no full blocks within the last 120 blocks. The estimation is:

- Low: 100 (= minimum system gas unit price)
- Market: 100
- Aggressive: 150 (= minimum of next bucket)

(B) The blockchain is heavily loaded, with only full blocks within the last 120 blocks, but with all transactions using the lowest gas unit price. The estimation is:

- Low: 150 (= minimum of next bucket > 100)
- Market: 150
- Aggressive: 300 (= minimum of next bucket > 150)

(B) The blockchain is moderately loaded, similar to above, but at least one non-full block in the last 10 blocks. The estimation is:

- Low: 100 (= minimum system gas unit price)
- Market: 150 (= minimum of next bucket > 100)
- Aggressive: 300 (= minimum of next bucket > 150)

## Reference Implementation

* https://github.com/aptos-labs/aptos-core/pull/8186
* Compatible changes after AIP-33: https://github.com/aptos-labs/aptos-core/pull/8208
  
## Risks and Drawbacks

- We are being very conservative with how small a full block is classified. This could result in gas fees rising despite moderate load.
- There is a dependency on consensus configs, and in particular chain health and backpressure configs. The formula is reliant on the consensus config for the minimal fully loaded block. Thus any changes to this consensus config require changes in the gas estimation.

## Future Potential

- For now, the estimation provides three values based on the defined objectives. If there is client demand, the general framework could be extended and more fine-grain statistics such as histograms.

## Suggested implementation timeline

- Milestone 1 (in progress): Code complete before v1.5 release cut

## Suggested deployment timeline

- Milestone 1 (planned): Cut into release v1.5
- Milestone 2 (TBD): Deployed into fullnodes. Clients will use the backwards compatible “market” values.
- Milestone 3 (TBD): Clients are deployed using the new API.
