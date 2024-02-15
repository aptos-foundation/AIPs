---
aip: TBD
title: Spread out transactions from the same entry functions for block space fairness
author: igor-aptos (https://github.com/igor-aptos), msmouse
discussions-to (*optional): TBD
Status: Draft
last-call-end-date (*optional): 
type: Core
created: 02/14/2024
updated (*optional):
requires (*optional):
---

# AIP-X - Spread out transactions from the same entry functions for block space fairness

## Summary

This AIP proposes to update the Transaction Shuffler logic to spread out adjacent transactions (in the proposed order) from the same module / entry function to give transactions from non-nominant modules / entry functions a better chance to surval a potential block cut resuling from the block gas limit being hit.

### Goals

Design a new transaction shuffler so that 
* Adjacent (defined by configurable conflict window size) transactions in the proposed order calling the same entry function gets spreaded out by bringing up transactions that are later in the block that are from different modules, by different senders and call different entry functions.
* With exceptions, the shuffler keeps the invariant that transactions calling the same entry function keep their reletive order after the shuffling. The same goes for transactions from the same sender and calling the same modules. This is to be conservative in that a module / entry function receives transactions in the same order as the proposed order after the shuffling.
* Modules from special addresses (0x0 - 0xF) are exempt from the above invariant. For example, a transaction that transfers the Aptos native token via `Account::transfer()` can be brought up even if in the proposed order there's another transaction before it that's from a different user. This is consistent (within modules from the special addresses) with the current shuffler logic that aims to spread out consecutive transactions from the same user.


## Motivation

With [AIP-33](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-33.md) and [AIP-57](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-57.md), we cut blocks short at execution time whenever the block latency is estimated to be too long. This is expected to happen in this particular situation where spikes of costly transactions from a popular module dominates the traffic, in which case most of the transactions from the proposed block are from a one single entry function and many "innocent transactions" from other modules / entry functions gets cut with the block limit being hit, resulting in universally degraded user experience. 

## Impact

Implementing the proposed shuffling logic will provide acceptable experience for the non-dominant modules even when the chain is under load that's dominated by a certain popular module.

## Alternative solutions


...

## Specification

The algorithm goes in two passes:
* In the first pass, each transaction is examined in the original proposed order to see if it is free from conflict within a sliding window for each aspact being considered (namnely, transaction sender address, entry function module and the entry function itself; sizes individually configurable), depending on the result, the transaction is select into the output order, or kept in a pending area.
  * As a result of a new transaction being selected, previously selected transactions are popped out of one of the sliding windows, making previously pending transactions free of confliction. At this point, the per-sender / per-module / per-entry-function order invarients are examined. If applicable, the unblocked transaction is selected to the output order. This process goes recursively.
* If after the first pass there are pending transactions left over, the "earlist" one of them in the originally proposed order will be selected.
  * As a result, transactions popped out of the conflict windows are processed recursively like done in the first pass.

Each transaction gets examined at most once for both passes, that's `O(2 * n)`. And each transaction comes out of the sliding window for each conflict type (transaction sender, entry function module and entry function) at most once, that's `O(3 * n)`. Each time one transaction comes out of a conflict window, it is examined by going through all 3
conflict types. So the time complexity is O(3 * 3 * n) = O(n). Or if we consider the number of conflict types a variable `m`, the time complexity is `O(m * m * n)`.

On-chain configuration:

```Rust
pub enum TransactionShufflerType {
    ...
    Fairness {
        sender_conflict_window_size: u32,
        module_conflict_window_size: u32,
        entry_fun_conflict_window_size: u32,
    },
}
```



## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/11882


## Risks and Drawbacks

* This further expands the complexity of the deterministic reordering of the transactions in a ordered block introduced by the transaction shuffling. Deterministic reordering can potentially be exploited for front running other transactions within a block although we don't yet have a concrete bad case now.
* If the competition on block space is intense, one can create many identical proxy modules / entry functions to get more "fairness", which is unfair.

## Future Potential

Similar fairness considerations can be put inside the process of forming the initial block proposals by picking transactions from the mempool.

## Timeline

### Suggested implementation timeline

Code is in 1.10 binary.

### Suggested developer platform support timeline

N/A

### Suggested deployment timeline

Feature hopefully goes with release 1.10.

## Security Considerations

See [Risks and Drawbacks](#Risks-and-Drawbacks)
