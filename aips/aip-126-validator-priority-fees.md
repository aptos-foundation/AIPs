---
aip: 126
title: Validator Priority Fees
author: guy-goren, grao1991, Zekun Li
Status: Draft
type: Standard (Core)
created: <04/09/2025>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-126 - Validator Priority Fees
  
## Summary

There is currently no mechanism in the Aptos protocol that incentivizes validators to prioritize higher-priced transactions. As a result, no built-in priority fee market exists, which encourages the emergence of informal or "black market" mechanisms for transaction ordering. This becomes increasingly problematic as trading use cases grow, particularly those involving arbitrage opportunities, where fair and open competition over ordering is essential.

This proposal introduces a simple and incentive-compatible mechanism for priority fees. We modify the current gas fee behavior so that only the first 90 Octas per gas unit (GU) are burned. Any excess over that threshold is paid directly to the validator who proposes the block containing the transaction. This allows users to compete for inclusion and ordering by paying validators directly, in a transparent and protocol-native way. 


### Out of scope

This AIP does not address incentives for the Quorum Store, storage, block voting, or execution/commit certificates. These areas are important and may be addressed in future AIPs.

## High-level Overview

Users continue to specify a gas price per gas unit (GU) when submitting transactions, with a minimum of 100 Octas/GU. The key change is that only the first 90 Octas/GU are burned; the excess is paid directly to the validator that proposes the block containing the transaction.

There is no change to the transaction submission APIs — users interact with the system exactly as they do today. This preserves compatibility while enabling a native mechanism for users to bid for execution priority by offering additional fees to validators. The result is a transparent, protocol-aligned incentive structure for transaction ordering.

## Impact

This proposal establishes a foundational mechanism for a well-functioning transaction fee market. Traders and other users who compete for ordering priority gain a seamless, protocol-native way to pay validators through an auction embedded in the gas price. Validators, in turn, are rewarded transparently and incentive-compatibly for their role as arbiters of transaction ordering.

Without a native priority fee mechanism, validators lack clear incentives to order transactions based on economically transparent rules. As trading activity increases, this misalignment is likely to encourage the rise of external, opaque ordering markets. These side channels benefit participants with privileged access and can erode fairness by creating unequal conditions for different users.

## Alternative Solutions

**Alternative 1:** No burn, all fees to validator.
We considered redirecting the entire gas fee to the block proposer, but opted against it due to the economic value of burning. A fixed burn helps regulate inflation and aligns overall tokenomics with market demand.

**Alternative 2:** 50/50 split (e.g., Solana’s model until SIMD96).
A 50/50 burn-split is problematic because it still encourages side-channel payments. For example, a user could submit a transaction with the minimum fee (100 Octas/GU) and pay a validator off-chain to prioritize it, bypassing the auction. This weakens the incentive to participate in the transparent, protocol-defined fee market. A fixed burn threshold eliminates this vector and ensures users compete in-protocol.

**Alternative 3:** External ordering services (e.g., Jito on Solana).
Solana’s experience highlights the risks of a dysfunctional native fee market. As MEV and arbitrage value grew, an external solution (Jito) emerged to coordinate ordering. While effective, it comes with trade-offs: (1) centralization pressure, (2) an additional economic layer extracting fees from users, and (3) growing reliance on off-chain infrastructure for core network functionality. Our proposal avoids these issues by embedding the ordering market directly into the protocol.

## Specification and Implementation Details

**Burn rate:**
Reduced to 90 Octas/GU. Minimum paymnet remains at 100 Octas/GU. Any excess goes to the proposer. No changes to transaction format or APIs.  
_Rationale: preserves UX compatibility while enabling a simple, tunable priority fee mechanism._

**Operator/staker sharing:**
Use the existing fee_commission parameter, mirroring the existing protocol rewards commission.  
_Rationale: simplifies implementation while allowing on-chain enforcement of fair revenue sharing._

**Quorum Store prep (forward compatibility):**
  (1) Add a per-transaction field to track fee recipients.
  (2) Accumulate and distribute fees at epoch boundaries.  
 _Rationale: enables future extensions (e.g., multi-recipient fees) while avoiding micro-distributions and fragmentation._

**Implementation Decisions**

- Write the fee per transaction v.s. per block

Choose to do per block, because doing it per transaction will require us writing additional states every transaction, which is expensive at high tps.

- Distribute fee per block v.s. per epoch

Choose to do per epoch, because it aligns with how we distribute block rewards, requires less change.

- Make proposer information per transaction
  
To allow future extensions. For example Quorum Store batcher might also be included.


## Reference Implementation

https://github.com/pulls?q=is%3Amerged+is%3Apr+author%3Agrao1991+archived%3Afalse+%5BPriority+Fee%5D+

## Risks and Drawbacks

**Publicity risk:**
The proposed change may highlight the current lacuna in validator participation rewards.
This could prompt scrutiny but also serves to justify broader improvements to validator incentives.

**Single-dimensionallity:**
The mechanism only accounts for gas fees, while block limits are actually multidimensional — including storage, IO, and transaction count.
This mismatch means a less efficient market. A future move to a multidimensional gas market will require extending the prioritization mechanism accordingly.

**Unreliable gas estimates from users:**
Many users overestimate gas limits, often without regard to actual usage.
This introduces noise into the auction: it becomes harder to predict the real priority fee being paid, and it weakens the correlation between fee and marginal cost or value. However, a relatively good heuristic for the block packing problem is exactly based on the price per GU metric, which is the unaffected by the submitted gas limit.

## Security Considerations

Our proposal introduces minimal new attack surface, as it does not alter transaction execution logic or consensus behavior. However, a few considerations apply:

**Fee accounting correctness:**
The split between burn and validator reward must be precisely enforced. Incorrect fee calculations, rounding errors, or overflows—particularly in multi-recipient contexts—could result in loss or misallocation of funds.  
Mitigation: unit and integration tests should validate all fee flows, including edge cases (e.g., maximum gas price, zero burn, multi-recipient distributions).

**Auction griefing via inflated priority fees:**
Users may submit high-fee transactions solely to crowd out competitors. While they still pay the declared fee, this behavior can degrade UX.  
Mitigation: the economic cost of griefing is internalized by the attacker; further mitigation may require separate work on spam filtering or reservation (eg. future) auction design.

## Future Potential

The addition of a priority fee results in a built-in market for transaction ordering within a block. This enables arbitrage competition to occur in an open and transparent way.
The presence of such a mechanism significantly reduces the economic incentive to create side markets for ordering — markets that tend to be opaque, less fair, and more easily exploited for strategies such as frontrunning and sandwiching.

## Timeline

### Suggested implementation timeline

v1.33


## Open Questions (Optional)

**Q. Why implement the priority fee per gas unit (GU) rather than per transaction?**  
A fee per transaction introduces a misalignment between the fee paid and the actual cost imposed on the network. A user could submit a single transaction that pays slightly more in total than others but consumes significantly more gas, skewing validator incentives. This would favor bundling multiple actions into large, complex transactions, which is inefficient and may encourage new forms of off-chain coordination. A per-GU priority fee ensures better alignment between user bids and execution costs.
