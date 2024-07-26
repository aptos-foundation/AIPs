---
aip: 68
title: Use Case Aware Block Reordering
author: igor-aptos (https://github.com/igor-aptos), msmouse
discussions-to: https://github.com/aptos-foundation/AIPs/issues/333
Status: Accepted
last-call-end-date (*optional): 
type: Core
created: 02/14/2024
updated: 07/15/2024
requires:
---

# AIP-68 - Use Case Aware Block Reordering


## Summary

Conflicting transactions require sequential execution, and can waste resources and reduce throughput of the system.

This AIP proposes to update the Transaction Shuffler logic to add other reasons for conflicts to how transactions are ordered in the block. In addition to using senders to spread out transactions (from [AIP-27](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-27.md)), this AIP will extend that to spread out adjacent transactions (in the proposed order) that are relevant to the same "use case", as an approximation of having higher likelihood of conflicting. Defining a "use case" as the author of the contract being invoked by the transaction, for now, the new algorithm gives transactions from non-dominant contract a better chance of surviving a potential block cut resulting from the conflicting transactions hitting the effective block gas limit early, without meaningfully affecting conflicting workload, unless the system is heavily overloaded.

### out of scope

The Transaction Shuffler being updated concerns only the ordering of transactions within a block that's elected to be included on-chain by the consensus of validators. There's opportunity to further enhance the block packing for increasing throughput as well, however that's out of scope for this discussion.

## High-level Overview

With [AIP-33](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-33.md) and [AIP-57](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-57.md), we cut blocks short at execution time whenever the block latency is estimated to be too long. Specifically, AIP-57 makes block gas limit be conflict aware, and once sequential workload exceeds single threads gas limit, block is cut (even if other threads had plenty of idle time). This is expected to happen in this particular situation where spikes of conflicting/sequential transactions from a popular module dominates the traffic, in which case most of the transactions from the proposed block are from a one single entry function and many "innocent transactions" from other modules / entry functions gets cut with the block limit being hit, resulting in wasted resources (idle cores) and universally degraded user experience. By spreading out transactions from the same use case, these "innocent transactions" gets pushed earlier in a block, allowing them to utilize those idle cores, and giving them a better chance to survive the cut, with most likely block itself being cut at the same single-thread block gas limit. This uses approximation that transaction from different use cases tend to utilize non-conflicting resources.

Similar to [AIP-27](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-27.md), the proposed algorithm tries to spread out "conflicting" transactions while generally maintaining the input order. While the shuffler used to consider the transaction sender as the sole factor of "conflict", we propose to consider two dimensions: the transaction sender and the "use case" of the transaction. At this point, the use case is defined as the author of the contract being called by the transaction, however it's imaginable to have more sophisticated ways to categorize transactions to exclusive use cases in the context of a block.


## Impact

Implementing the proposed shuffling logic will provide acceptable experience for the non-dominant modules even when the chain is under load that's dominated by a certain popular module.

## Specification and Implementation Details

For each spot in the output transaction sequence, the algorithm selects a transaction from either the input transaction pool or a pending transaction pool which contains previously "delayed" transactions. As the the decision of which pool to select from is made, transactions from the input sequence can be moved from there to the pending pool.

The main data structure being utilized is a pending transaction queue, that tracks the earliest "ready" time, "time" defined by the output index, of a pending transaction, considering three factors:
    * if there are previous pending transaction from the same account
    * the last time a transaction from the same account was selected into the output
    * the last time a transaction from the same use case was selected into the output

At anytime, the queue can return the earliest ready transaction and the ideal ready "time" (output index) for that transaction.

The algorithm goes like this:

For each output spot:
1. see if any transaction in the pending pool is ready at the current output index, if so, select it.
1. In a loop, examine the next transaction in the input queue
    1. consult the pending queue, to see if the transaction is subject to delaying because any of the three factors described above; if so, put the transaction into the pending queue.
    1. otherwise, select the transaction directly to the output. But inform the pending queue to update the last selected output index for the respective account and use case.
1. if the input sequence has been drained, select the earliest ready transaction from the pending pool forcibly, no matter if it's already ready at the current output index.


On-chain configuration:

```Rust
pub enum TransactionShufflerType {
    ...
    UseCaseAware {
        sender_spread_factor: usize,
        platform_use_case_spread_factor: usize,
        user_use_case_spread_factor: usize,
    },
}
```

Notably, contracts under `0x0` - `0xF` are collectively identified as "platform use cases", which subject to a separately configured spread factor.


## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/13738

The reference implementation makes use of a nested priority queue structure to implement the pending transaction pool.

``` Rust

/// Structure to track:
///     1. all use cases and accounts that are subject to delaying, no matter they have pending txns
/// associated or not.
///     2. all txns that are examined and delayed previously.
///
///     * A delayed txn is attached to an account and the account is attached to a priority queue in a use
/// case, which has an entry in the main priority queue.
///     * Empty accounts and use cases are still tracked for the delay so that a next txn in the
/// input stream is properly delayed if associated with such an account or use case.
#[derive(Debug, Default)]
pub(crate) struct DelayedQueue<Txn> {
    /// Registry of all accounts, each of which includes the expected output_idx to delay until and
    /// a queue (might be empty) of txns by that sender.
    ///
    /// An empty account address is tracked in `account_placeholders_by_delay` while a non-empty
    /// account address is tracked under `use_cases`.
    accounts: HashMap<AccountAddress, Account<Txn>>,
    /// Registry of all use cases, each of which includes the expected output_idx to delay until and
    /// a priority queue (might be empty) of non-empty accounts whose head txn belongs to that use case.
    ///
    /// An empty use case is tracked in `use_case_placeholders_by_delay` while a non-empty use case
    /// is tracked in the top level `use_cases_by_delay`.
    use_cases: HashMap<UseCaseKey, UseCase>,

    /// Main delay queue of txns. All use cases are non-empty of non-empty accounts.
    /// All pending txns are reachable from this nested structure.
    ///
    /// The DelayKey is derived from the head account's DelayKey combined with the use case's own
    /// DelayKey.
    ///
    /// The head txn of the head account of the head use case in this nested structure is the
    /// next txn to be possibly ready.
    use_cases_by_delay: BTreeMap<DelayKey, UseCaseKey>,
    /// Empty account addresses by the DelayKey (those w/o known delayed txns), kept to track the delay.
    account_placeholders_by_delay: BTreeMap<DelayKey, AccountAddress>,
    /// Empty UseCaseKeys by the DelayKey (those w/o known delayed txns), kept to track the delay.
    use_case_placeholders_by_delay: BTreeMap<DelayKey, UseCaseKey>,

    /// Externally set output index; when an item has try_delay_till <= output_idx, it's deemed ready
    output_idx: OutputIdx,

    config: Config,
}
```

## Testing

In a local testing cluster, in certain cases, simple platform


## Risks and Drawbacks + Security Considerations

* This further expands the complexity of the deterministic reordering of the transactions in a ordered block introduced by the transaction shuffling. Deterministic reordering can potentially be exploited, though above rules applied to the reordering try to hinder any such attacks.
* Any workload cannot unfairly exploit the reordering and degrade performance of other workloads, but can potentially try to avoid above rules from being applied to it. That makes situation at least not worse than without this AIP.
* Due to the approximations used in this AIP, in case system is in a situation that all of it's cores are overloaded, if there is an use-case producing majority of transactions, it might be affected by it's throughput being reduced (up until it is using 25% of the blockchain resources), without overall throughput of the system being increased. This is not a target outcome, but but not necessarily a bad one.
 

## Future Potential

* Similar throughput considerations can be put inside the process of forming the initial block proposals by picking transactions from the mempool.
* More sophisticated heuristics can be utilized to define "use cases", for example, by statically analyze the contracts and scripts being called, the transactions of a block can be categorized so that transaction across different categories are unlikely to access the same group of resources.

## Timeline

### Suggested implementation timeline

Code is planned to be included in the 1.18 release.

### Suggested developer platform support timeline

N/A

### Suggested deployment timeline

Release 1.18

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should
