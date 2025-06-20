---
aip: 33
title: Block Gas Limit
author: danielxiangzl
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Execution
created: 05/07/2023
---

# AIP-33 - Block Gas Limit
  

## Summary

The per-block gas limit (or simply block gas limit) is a new feature that terminates block execution when the gas consumed by the committed prefix of transactions exceeds the block gas limit. This ensures that each block is executed within a predetermined limit of computational resources / time, thereby providing predictable latencies for latency-critical applications that involve even highly sequential and computationally heavy transactions.

## Motivation

Providing **predictable latency guarantee** is one of the most critical feature of Aptos blockchain. For instance, some gaming application expects an average latency of 2 secs, where the user experience is hugely affected by the latency when they mint / transfer in-game NFTs. Even when the system is overloaded, the high fee transactions are expected to be committed with predictable latency guarantees under the gas fee market. 
However, currently high fee transactions may incur large latency, when the blockchain is under highly sequential or computation heavy workloads. It is because the executor will always finish executing the entire block, so if the execution pipeline contains many computation heavy transactions, the execution of those transactions will cause a huge delay on high fee transactions. 


## Rationale

The existing solution is to rely on consensus back-pressure. If the execution pipeline contains too many transactions, consensus will be back-pressured to reduce the block size, then hopefully reducing the block execution time so that the execution / consensus throughput can be aligned. However, it is hard to predict what kind of workloads the blockchain will be handling and thus difficult to setup a back-pressure mechanism to accurately predict and adjust the block execution latency. 

A much better prediction of block execution latency is via **block gas limit**, namely the executor only commits the prefix of the transactions in the block whose accumulated gas cost is below the block gas limit, and feeds rest of the transactions back to mempool for retry. The block gas limit gives an upper bound on the block execution time, where the upper bound can be determined by sequential transactions that are computationally heavy (consumes execution gas but no storage gas). Once the per-block execution time becomes predictable, the block commit latency also becomes predictable as the consensus latency is already predictable (2 roundtrips in the common case).

This mechanism also works well with our gas fee market, which prioritizes the transactions with high gas fees when fetching transactions from the mempool. Since we make block execution fast and predictable, high gas fee transactions can be included in blocks faster than without block gas limit where they may be stuck in the mempool due to high commit latency.

## Specification

Conceptually, it is straightforward to implement per-block gas limit, if we resolve the following two technical challenges:

1. How to determine the prefix of committed transactions in parallel execution (BlockSTM).
2. How to properly terminate the parallel execution as threads may be pending on read dependencies.

We explain how we address these two challenges in the section below. Assuming we have a way to solve them, then adding per-block gas limit is as simple as updating the accumulated gas whenever a transaction gets committed, and terminate the parallel execution when the accumulated gas exceeds the per-block gas limit. 

There are some subtleties on how we change the state checkpointing logic with the block gas limit, as will be explained below as well.

For challenge 1, we already designed and implemented the [rolling commit](https://github.com/aptos-labs/aptos-core/pull/6079), which allows the BlockSTM to accurately keep track of the committed transaction prefix. The main idea of rolling commit is to record the “wave” of the validation tasks of any transaction, similar to the “incarnation” of execution tasks. Roughly speaking, if a validation task of the latest wave succeeds, then the transaction can be committed. More details of the algorithm description can be found in the comments [here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/block-executor/src/scheduler.rs#L133).

For challenge 2, roughly speaking, we let one thread to mark the termination of execution, resolve the conditional variables of all transactions, and mark the execution status of transactions as ExecutionHalted ([code](https://github.com/aptos-labs/aptos-core/blob/daniel-per-block-gas/aptos-move/block-executor/src/scheduler.rs#L548)). Then any read-dependency pending thread will wake up and stop pending on the dependency as it will read the execution status as ExecutionHalted. 

For state checkpoint transactions, the invariant is that a block either ends with reconfiguration transaction, or a state checkpoint transaction. Before the block gas limit change, the executor will mark any transaction as Retry after the reconfiguration transaction. We reuse the same logic here to make sure transactions get cut due to per-block gas limit will be retried, but we also need to insert the state checkpoint transaction to keep the invariant. Details can be found in the code [here](https://github.com/aptos-labs/aptos-core/blob/daniel-per-block-gas/execution/executor/src/components/apply_chunk_output.rs#L139) and [here](https://github.com/aptos-labs/aptos-core/blob/daniel-per-block-gas/consensus/consensus-types/src/executed_block.rs#L122).

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/7488

## Risks and Drawbacks

Risk 1: Changes in system behavior. Currently all transactions inside a block will be executed and committed, except for epoch change where the transactions after the reconfiguration transaction will be sent to mempool for retry, or internal error where the whole block is discarded. After this change, only a part of the transactions inside a block may be executed and committed -- once a prefix of committed transactions exceeds the block gas limit, rest of the transactions will be sent to mempool for retry. 

Risk 2: Transactions at the end of the block are more likely to get cut by the block gas limit. This can be improved with a gas-aware transaction shuffling as described in the section below.

## Future Potential

- We can extend the design with a more sophisticated block gas limit rule that is a function of the transaction execution if necessary.

- To make gas fee market work better with per-block gas limit, we can introduce gas-aware transaction shuffling on top of the existing sender-aware transaction shuffling ([AIP-27](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-27.md)). If we prioritize the high gas fee transactions inside a block by moving them to the front of the block, then they are less likely to be cut by the block gas limit. 

- To make the block execution time prediction more accurate, this scheme works well with a **gas mechanism for parallel execution**. Roughly speaking, we want to charge more gas if the transaction has more conflicts with others, which can incentivize developers to write more parallelizable contract to better utilize our BlockSTM.

## Suggested implementation timeline

- Milestone 1 (completed): Code complete
- Milestone 2 (in progress): Fix existing unit and e2e tests, adding more tests

## Suggested deployment timeline

- Milestone 1 (planned): Cut into release v1.5
- Milestone 2 (TBD): Onchain config change in devnet
- Milestone 3 (TBD): Onchain config change in testnet
- Milestone 4 (TBD): Onchain config change in mainnet via governance proposal
