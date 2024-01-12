---
aip: 60
title: Improve fairness of shared computation resources 
author: igor-aptos (https://github.com/igor-aptos), vgao1996 (https://github.com/vgao1996)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Gas)
created: 01/04/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-60 - Improve fairness of shared computation resources 
  
## Summary

Currently per-transaction `max_execution_gas` and `max_io_gas` limits allow single transaction to unfairly hog resources, and take `~1s` to execute.
Proposal is to reduce the limits to `~100ms` short term, with target of `10ms` mid-term.

### Out of Scope

Any gas calibration changes, or block limit changes. 
This also doesn't touch overall transactions gas limit, which are much larger - as storage fees themselves are much larger.

## Motivation

Allowing large individual transactions, makes it easy for individual transactions to unfarily hog computation resources, makes it harder to fairly share resources, and makes chain less responsive.

From investigations, most common causes for single transaction taking a lot of time to execute are:
- inefficient implementations
- batching of many individual operations into single transaction

Less commonly, and mostly on the lower end of around the ~10-30ms range is a set of use cases with actual need, for example using cryptographic expensive primitives.

This suggests reducing transaction limit should be overall beneficial:
- innefficient contracts will get early information to optimize
- reducing batching allows for more parallelism and higher throughput
- chain will be more responsive and fair

We will work to understand use cases with real need - and see how they can be handled. Reach out if your transactions fall into this category.

## Impact, Risks and Drawbacks

Any transaction that exceeds reduced `max_execution_gas` or `max_io_gas` will be rejected.
Valid use cases that want to do larger amount of work will need to be split across multiple transactions.

## Reference Implementation

Modifying two configs in [transaction.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/aptos-gas-schedule/src/gas_schedule/transaction.rs#L176)

[PR](https://github.com/aptos-labs/aptos-core/pull/11581) to apply changes and create mainnet proposal 

## Timeline

### Suggested deployment timeline

By mid-January, reduce mainnet limits to `100ms`, to improve fairness immediatelly. Less than `0.1%` of mainnet transaction fall into this cateogry.

Gradually, in collaboration with the ecosystem, reduce limits further down to `10ms`, in the coming weeks/months.

On devnet/testnet, we will more aggressively reduce limits, to help everyone understand impact on their applications, and do the mainnet transition more smoothly.

## Security Considerations

None
