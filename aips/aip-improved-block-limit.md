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
* adding block output limit, ending a block when predefined output size is reached. This allows having predictable bandwidth requirements needed for state-sync, allowing downstream nodes - VFNs/PFNs/indexers/etc to have predictable and small lag.
* improving block gas limit:
  * adding conflict-awareness. Gas of individual transactions is currently not dependent on other transctions, but it's execution speed depends on it. In order to have predictable execution time of the block, gas used from individual transactions are going to multiplied by a "conflict coefficient"
  * adding a flexible compute vs io multipliers, for a bit more flexibility, without the need to change the gas schedule as frequently.
  
### Goals

 > What are the goals and what is in scope? Any metrics?
 > Discuss the business impact and business value this change would impact.
 > 
...

### Out of Scope

 > What are we committing to not doing and why are they scoped out?

## Motivation

 > Describe the impetus for this change. What does it accomplish?
 > What might occur if we do not accept this proposal?

...

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?

...

## Alternative solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

...

## Specification

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

## Reference Implementation

[PR 10943](https://github.com/aptos-labs/aptos-core/pull/10943)

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

* This doesn't help with the incentives - as this computation is on top of and doesn't change what gas transactions are charged with. In addition to this, improvement to gas schedule should follow, to fairly charge users for chain utilization.
* As-is, this removes ability to see from onchain information whether blocks are full or not (which is for example used for gas estimation). So we need to follow-up with adding to StateCheckpoint transactions block-level information about it.

...

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

...

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

### Suggested developer platform support timeline

 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

...

### Suggested deployment timeline

 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

...

## Security Considerations

 > - Does this result in a change of security assumptions or our threat model?
 > - Any potential scams? What are the mitigation strategies?
 > - Any security implications/considerations?
 > - Any security design docs or auditing materials that can be shared?

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should
