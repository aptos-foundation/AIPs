---
aip: 27
title: Sender Aware Transaction Shuffling
author: skedia@aptoslabs.com
Status: Draft
last-call-end-date: 04/19/2023
type: Execution
created: 04/18/2023
---

# AIP-27 - Sender Aware Transaction Shuffling
  
## Summary

Sender-aware shuffling enables the shuffling of transactions within a single block so that transactions from the same sender are apart from each other as much as possible. This is done to reduce the number of conflicts and re-execution during parallel execution. Our end-to-end performance benchmark show that sender-aware shuffling can improve the TPS by 25%. 

## Motivation

The performance of BlockSTM (our parallel execution framework) heavily depends on input transaction types - particularly dependencies between adjacent transactions. If the read/write set of the adjacent transactions is non-overlapping, BlockSTM performs the best because there will be no conflict between them and hence optimistic execution of transactions will not require any re-execution. Based on the above idea, we introduce a sender-aware shuffling of transactions, that aims to minimize the conflict between adjacent transactions as much as possible by putting transactions from the same sender at least a defined window size (w) apart. This is done because transactions from the same sender are always conflicting as they tend to read/write to the same set of resources (sender’s account balance and sequence number)

## Specification

We define `conflict window size` as the size of the window within which transactions can conflict with each other.  The shuffler maintains a set of senders added to the block in the last `conflict_window_size` transactions. When trying to select a new transaction to the block, the shuffler tries to find a transaction that is not part of the conflicting senders in the window. If it does, it adds the first non-conflicting transaction it finds to the block, if it doesn't then it preserves the order and adds the first transaction in the remaining block. It always maintains the following invariant in terms of ordering

1. The relative ordering of all transactions from the same before and after shuffling is the same
2. The relative ordering of all transactions across different senders will also be maintained if they are non-conflicting. In other words, if the input block has only one transaction per sender, the output order will remain unchanged.

The shuffling algorithm is O(n) and the following is its pseudo-code.

 ```
 loop:
   if a sender fell out of the sliding window in previous iteration,
      then: we add the first pending transaction from that sender to the block
   else while we have transactions to process in the original transaction order
         take a new one,
         if it conflicts, add to the pending set
         else we add it to the block
  else
      take the first transaction from the pending transactions and add it to the block
   ```


## Reference Implementation

An implementation is code complete in main. It is gated by an onchain config, so it will not be live until a governance proposal is executed on the network.

- https://github.com/aptos-labs/aptos-core/pull/6518

## Risks and Drawbacks

Risk 1: Changes in system behavior. This changes the existing behavior around transaction ordering - if there are systems that rely on existing transaction ordering implicitly, then they are going to break. 

## Future Potential

- In the future, we can extend this idea to get read/write set for a set of transactions (either through pre-execution or support from Move side) and the shuffling can be made smart enough to place conflicting transactions far apart from each other.
- This idea can further be extended into smarter transaction selection into the block. If the read/write set for a set of transactions is known beforehand, we can select non-conflicting transactions into the block to make parallel execution as efficient as possible.

## Suggested implementation timeline

- Milestone 1 (completed): Code complete with unit and e2e tests
- Milestone 2 (completed): Previewnet performance verification


## Suggested deployment timeline

- Milestone 1 (planned): Cut into release v1.4
- Milestone 2 (planned): Onchain config change in devnet
- Milestone 3 (planned): Onchain config change in testnet
- Milestone 4 (planned): Onchain config change in mainnet via governance proposal
