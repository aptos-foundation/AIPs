---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Validator Priority Fees
author: guy-goren
Status: Draft
type: Standard (Core)
created: <04/09/2025>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Validator Priority Fees
  
(Please give a temporary file name to your AIP when first drafting it, such as `aip-x.md`. The AIP manager will assign a number to it after reviewing.)

(Please remove the questions in the "quote box". Provide complete context to the questions being asked in the content that you provide.)

## Summary

 > Summarize in 3-5 sentences.
 > Define the problem we're solving.
 > How does this document propose solving it.
 > What are the goals and what is in scope? Any metrics?

There is currently no mechanism in the protocol that incentivizes validators to prioritize higher priced txns. Thus, a built-in priority market does not exist, leading to "black market" solutions. As we focus on trading use cases, the need for a priority market for fair competition rises (eg. facilitating open competitions for MEV opportunities in arbitrage). We propose a change to the current gas fee behavior.
Currently, it is fully burned, instead, we suggest to implement a partial burn with the remaining going to the validator. Specifically, the first 100 Octas per gas-unit (GU) are burned and the additional Octas -- if exists -- go directly to the validator that proposed the block which includes the tx. 


### Out of scope

 > What are we committing to not doing and why are they scoped out?

Incentives relating to Quorum Store. Other fees (eg. storage). Incentives for voting on blocks. Execution/Commit-certificate incentives.


## High-level Overview

 > Define the straw man solution with enough details to make it clear why this is the preferred solution.
 > Please write a 2-3 paragraph high-level overview here and defer writing a more detailed description in [the specification section](#specification-and-implementation-details).

...
Exactly like today, a user specifies a price per GU for a tx (minimum of 100 Octas/GU). Unllike today, when the tx is executed only 100 Octas/GU is being burned with the remining going to the validator proposing the block. This, in effect, provides a mechanism for users to pay directly to validators for prioritizing the tx over competing txns.

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?
 > What might occur if we do not accept this proposal?
 > List out other AIPs this AIP is dependent on
...
This is a cornerstone of a well functioning fee market. 

## Alternative Solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

...

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.
 > What is the feature flag(s)? If there is no feature flag, how will this be enabled?
...

## Testing 

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out. Some examples include user stories, network health metrics, system metrics, E2E tests, unit tests, etc.) 
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

 > - Express here the potential risks of taking on this proposal. What are the hazards? What can go wrong?
 > - Can this proposal impact backward compatibility?
 > - What is the mitigation plan for each risk or drawback?

## Security Considerations

 > - How can this AIP potentially impact the security of the network and its users? How is this impact mitigated?
 > - Are there specific parts of the code that could introduce a security issue if not implemented properly?
 > - Link tests (e.g. unit, end-to-end, property, fuzz) in the reference implementation that validate both expected and unexpected behavior of this proposal
 > - Include any security-relevant documentation related to this proposal (e.g. protocols or cryptography specifications)

...

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

...

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

### Suggested developer platform support timeline

 > **Optional:** Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable. 

...

### Suggested deployment timeline

 > **Optional:** Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

...


## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out, but we should

...
