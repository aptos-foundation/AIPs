---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Block Output Size Limit and Conflict-Aware Block Gas Limit
author: igor-aptos (https://github.com/igor-aptos)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core)
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Block Output Size Limit and Conflict-Aware Block Gas Limit
  
## Summary

This builds on top of [AIP-33](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-33.md), to improve latency predictability during arbitrary workload.
It includes:
* adding block output limit, ending a block when predefined output size is reached. 
* adding conflict-awareness to block gas limit.

As a consequence, information about whether block limit is reached would not be able to be infered onchain, so we are going to introduce a new type for StateCheckpoint transaction (i.e. replacing it with BlockEpilogue transaction), which will contain additional information

### Goals

Make execution of a single block have a more predictable and better bounded expected time (calibrated to 250ms-750ms range)

## Motivation

If single block can take arbitrary amount of time, it makes latency of any transactions submitted during that time arbitrarily large. So it is required to control single block execution time to be strictly sub-second, to allow for predictable end to end latency.

## Impact

It should enable us to have a predictable and consistent latency, no matter what the workload is. (if the chain is overloaded, low fee transaction will incur latency, but high fee transactions should go through.

Once the flag for it is enabled, StateCheckpoint transaction will be replaced with BlockEpilogue, which has a flexible payload, and will contain more information about how the block was ended in it.

## Alternative solutions

## Specification

It includes:
* adding block output limit, ending a block when predefined output size is reached. This allows having predictable bandwidth requirements needed for state-sync, allowing downstream nodes - VFNs/PFNs/indexers/etc to have predictable and small lag.
* improving block gas limit:
  * adding conflict-awareness. Gas of individual transactions is currently not dependent on other transctions, but it's execution speed depends on it. In order to have predictable execution time of the block, gas used from individual transactions are going to multiplied by a "conflict coefficient"
  * adding a flexible compute vs io multipliers, for a bit more flexibility, without the need to change the gas schedule as frequently.
  
As a consequence, information about whether block limit is reached would not be able to be infered onchain, so we are going to introduce a new type for StateCheckpoint transaction (i.e. replacing it with BlockEpilogue transaction), which will contain additional information

## Reference Implementation

[PR 10943](https://github.com/aptos-labs/aptos-core/pull/10943)
[PR 11287](https://github.com/aptos-labs/aptos-core/pull/11287)
[PR 11298](https://github.com/aptos-labs/aptos-core/pull/11298)

## Testing (Optional)

Preparing a variety of workloads, and running real-network forge tests, measuring change in latency and throughput. 

## Risks and Drawbacks

* This doesn't help with the incentives - as this computation is on top of and doesn't change what gas transactions are charged with. In addition to this, improvement to gas schedule should follow, to fairly charge users for chain utilization.

## Future Potential


## Timeline

To be included in 1.9 release

## Security Considerations

 > - Does this result in a change of security assumptions or our threat model?
 > - Any potential scams? What are the mitigation strategies?
 > - Any security implications/considerations?
 > - Any security design docs or auditing materials that can be shared?

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should
