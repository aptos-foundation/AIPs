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
This is a cornerstone of a well functioning fee market. Traders, and any other user that competes for ordering priority, will benefit from a seamless method of payment to the validator deciding on the order. Validators will enjoy a built-in, incentive compatible, mechanism that benefits them for their role as the "de-facto" arbiters of the txns-order competition.

Without priority fees, there is no incentive for the validators to order txns according to clear and transparent rules. Since we expect trading to ramp up, this incentive incompatibility is likely to grow enough such that external "black market" mechanism will emerge. These external markets benefit the  players who participate in them on the expense of the others in a manner that often cannibilize on the fairness of the system (fairness in the sense that the rules are the same for different players).

## Alternative Solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

...

**Alternative 1.** No burn, all to validator.    &nbsp;&nbsp; We opted not to use this mechanism because of the extra economical value that burning offers. For example, it helps balance inflation automatically based on market demand.

**Alternative 2.** 50-50. Similar to Solana, 50% is burned and 50% goes to the validator.    &nbsp;&nbsp; This mechanism is problematic since it still encourges "side-channel agreements". For example: user A, instead of bidding 500 Octas/GU, an bid 100 Octas/GU while also paying the validator -- in a side channel -- 300 Octas/GU. In this way both user A and the validator benefit from using the side channel instead of the explicit fee market. (This example also serves as a crisp demonstration for the benefit of a fixed burn rate.)

**Alternative 3.** Using a 3rd party as a market maker (what Jito does for Solana).   &nbsp;&nbsp; Solana is an interesting case study in which the built-in fee market was disfunctional (due to several reasons). As the economic value of the competition for order grew, the need for a better functioning market became urgent, hushering in an external (side-channel) ordering service -- Jito. However, such an external service has negative implications for most of the involved players. It (1) introduces a strong centralization force to the eco-system, (2) imposes a tax on the users that is going to the service provider (in addition to what goes to the validators), and (3) might cause a dependency for the blockchain efficient functioning on an external service.  

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
