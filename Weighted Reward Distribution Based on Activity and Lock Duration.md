# AIP: Weighted Reward Distribution Based on Activity and Lock Duration

**Author**: Ali ([@BoulkemhA](https://x.com/BoulkemhA))  
**Status**: Draft  
**Category**: Tokenomics / Incentive Mechanisms  
**Date**: May 29, 2025  

---

## 1. Title
**Weighted Reward Distribution Based on User Activity and Lock Duration**

---

## 2. Author
Ali ([@BoulkemhA](https://x.com/BoulkemhA))

---

## 3. Status
Draft

---

## 4. Category
Tokenomics / Incentive Mechanisms

---

## 5. Motivation
The current reward distribution models in many decentralized protocols primarily favor users based on token quantity held or staked. This approach often benefits large holders ("whales") while overlooking users who actively contribute to the protocol's growth and governance.

This proposal seeks to implement a **weighted reward mechanism** that encourages both **user engagement** and **long-term commitment**, thus better aligning incentives with protocol sustainability.

---

## 6. Abstract
This AIP introduces a dual-weighted reward distribution model on Aptos. The new system calculates a user’s reward share based on:
- **Activity Score**: Measures on-chain interaction and protocol contributions.
- **Lock Duration Score**: Reflects the user's commitment through locked token duration.

Rewards will be proportionally allocated using a tunable formula that balances both dimensions.

---

## 7. Specification

### Reward Weight Formula

```
weight = (activity_score × α) + (lock_duration_score × β)
```

Where:
- `activity_score` is based on user interactions (e.g., voting, using the protocol, referrals).
- `lock_duration_score` = (user lock duration) / (maximum lock duration)
- `α` and `β` are constants that define the importance of each component (suggested defaults: α = 0.6, β = 0.4)

### Example Activity Scoring

| Activity                     | Score |
|-----------------------------|-------|
| Daily protocol usage        | +1    |
| Voting in governance        | +3    |
| Referring active users      | +5    |
| Providing liquidity         | +2    |
| Completing missions/tasks   | Variable |

---

## 8. Rationale
This design discourages passive holding and motivates sustained interaction and support for the ecosystem. It also adds a flexible layer for projects to adapt scoring models to their specific dynamics.

---

## 9. Implementation
This mechanism can be integrated into:
- Reward contracts
- DAO distributions
- Airdrop logic
- Token farming programs

**Optional:** Provide a web dashboard showing user scores, estimated rewards, and breakdown of activity.

---

## 10. Backward Compatibility
No changes to existing token balances or user state. Can coexist with current distribution models and be phased in gradually.

---

## 11. Security Considerations
- Anti-Sybil protection measures should be applied to activity scoring.
- Referrals and repeated actions must be verified to avoid farming.
- Lock duration manipulation can be mitigated with time-based score freezing.

---

## 12. Copyright
© 2025 Ali - Released under CC0
