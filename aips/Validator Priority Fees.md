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

There is currently no mechanism in the Aptos protocol that incentivizes validators to prioritize higher-priced transactions. As a result, no built-in priority fee market exists, which encourages the emergence of informal or "black market" mechanisms for transaction ordering. This becomes increasingly problematic as trading use cases grow, particularly those involving arbitrage opportunities, where fair and open competition over ordering is essential.

This proposal introduces a simple and incentive-compatible mechanism for priority fees. We modify the current gas fee behavior so that only the first 100 Octas per gas unit (GU) are burned. Any excess over that threshold is paid directly to the validator who proposes the block containing the transaction. This allows users to compete for inclusion and ordering by paying validators directly, in a transparent and protocol-native way. 


### Out of scope

 > What are we committing to not doing and why are they scoped out?

This AIP does not address incentives for the Quorum Store, storage, block voting, or execution/commit certificates. These areas are important and may be addressed in future AIPs.

## High-level Overview

 > Define the straw man solution with enough details to make it clear why this is the preferred solution.
 > Please write a 2-3 paragraph high-level overview here and defer writing a more detailed description in [the specification section](#specification-and-implementation-details).

Users continue to specify a gas price per gas unit (GU) when submitting transactions, with a minimum of 100 Octas/GU. The key change is that only the first 100 Octas/GU are burned; any excess is paid directly to the validator that proposes the block containing the transaction.

There is no change to the transaction submission APIs — users interact with the system exactly as they do today. This preserves compatibility while enabling a native mechanism for users to bid for execution priority by offering additional fees to validators. The result is a transparent, protocol-aligned incentive structure for transaction ordering.

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?
 > What might occur if we do not accept this proposal?
 > List out other AIPs this AIP is dependent on

This proposal establishes a foundational mechanism for a well-functioning transaction fee market. Traders and other users who compete for ordering priority gain a seamless, protocol-native way to pay validators through an auction embedded in the gas price. Validators, in turn, are rewarded transparently and incentive-compatibly for their role as arbiters of transaction ordering.

Without a native priority fee mechanism, validators lack clear incentives to order transactions based on economically transparent rules. As trading activity increases, this misalignment is likely to encourage the rise of external, opaque ordering markets. These side channels benefit participants with privileged access and can erode fairness by creating unequal conditions for different users.

## Alternative Solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

**Alternative 1:** No burn, all fees to validator.
We considered redirecting the entire gas fee to the block proposer, but opted against it due to the economic value of burning. A fixed burn helps regulate inflation and aligns overall tokenomics with market demand.

**Alternative 2:** 50/50 split (e.g., Solana’s model).
A 50/50 burn-split is problematic because it still encourages side-channel payments. For example, a user could submit a transaction with the minimum fee (100 Octas/GU) and pay a validator off-chain to prioritize it, bypassing the auction. This weakens the incentive to participate in the transparent, protocol-defined fee market. A fixed burn threshold eliminates this vector and ensures users compete in-protocol.

**Alternative 3:** External ordering services (e.g., Jito on Solana).
Solana’s experience highlights the risks of a dysfunctional native fee market. As MEV and arbitrage value grew, an external solution (Jito) emerged to coordinate ordering. While effective, it comes with trade-offs: (1) centralization pressure, (2) an additional economic layer extracting fees from users, and (3) growing reliance on off-chain infrastructure for core network functionality. Our proposal avoids these issues by embedding the ordering market directly into the protocol.

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

- **Burn rate:** To make the transition seamless for users while maximizing the burn, we fix the burn on 100 Octas/GU. 
- **Operators and Stakers:** Validators are now able to earn additional income via priority fees, which raises the question of how to distribute this income between the operators and the stakers? An on-chain mechanism enforcing an agreed upon sharing of the fees is worthwhile. Similarly to the mechanism for sharing the protocol rewards which is done via a tunable parameter specifying the operator commission from the protocol rewards, we add a parameter sepecifying the operator comission from the pririty fees. This enables for flexibility and allows the market to determine the correct sharing ratio.
- **Execution pool:** In the execution pool a tx might be included in a block by validator A, but only executed later together with txns from a later block (eg. a block proposed by validator B). Nevertheless, the priority fees go to the including validator -- validator A.
- **Preparations for Quorum Store's incentives:** Thinking forward, we prerare the ground for future mechanisms that might tackle the Quorum Store incentives issues. Specifically, we prepare for the possibility of multiple fee receipients from a single tx. This includes (1) maintaining a field per tx accounting for fee receipients, (2) accumulating the fees across an epoch and distributing them at the end (to avoid many small distribution and small value problems).

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.
 > What is the feature flag(s)? If there is no feature flag, how will this be enabled?
...

@Guoteng

## Testing 

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out. Some examples include user stories, network health metrics, system metrics, E2E tests, unit tests, etc.) 
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...



## Risks and Drawbacks

 > - Express here the potential risks of taking on this proposal. What are the hazards? What can go wrong?
 > - Can this proposal impact backward compatibility?
 > - What is the mitigation plan for each risk or drawback?

- **Publicity.** Risk of drawing attention to the (currently) low participation incentives for validators.
- **Single dimensionality.** The prescribed mechanism only relates to gas fees. In practice, our blocks have multidimensional limits, which include storage costs, IO and #txns. These are not accounted for in the priority mechanism. A future transition to a multidimensional gas market will require a corresponding adaptation to the priority mechanism.
- **Gas estimation.** Our users are typically not sophisticated when it comes to gas consumptio. They often set the gas limit irrespectivaly of the tx actual requirements. This makes it hard to estimate the total fee going to the validator from the tx.  

## Security Considerations

 > - How can this AIP potentially impact the security of the network and its users? How is this impact mitigated?
 > - Are there specific parts of the code that could introduce a security issue if not implemented properly?
 > - Link tests (e.g. unit, end-to-end, property, fuzz) in the reference implementation that validate both expected and unexpected behavior of this proposal
 > - Include any security-relevant documentation related to this proposal (e.g. protocols or cryptography specifications)

...

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

...

The addition of a priority fee to the protocol will result in a built-in market for txns ordering in a block. This would facilitate arbitrage competition in an open and transparent manner. It will significantly reduce the economic incentive for side markets for ordering that are typically less fair and are easier to use for frontrunning/sandwiching.


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

**Q.** Why a priority fee per GU? Why not per tx?  
**A.** Because a priority payment per tx introduces the following vulnerability. A single tx paying a slightly higher amount but requiring substential more effort (measured in GU). This also leads to an side market for grouping multiple txns into a single huge tx, which is inefficient. 
