---
aip: 30
title: Implement decrease in staking rewards
author: michelle-aptos, xindingw
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/119
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 5/3/2023
updated (*optional): 5/3/2023
---

# AIP-30 - Implement decrease in staking rewards

## Summary

Currently, the maximum staking reward rate is a constant annualized rate of 7%. This AIP proposes a 1.5% yearly decrease in staking rewards:
- The maximum reward rate declines by 1.5% yearly until a lower bound of 3.25% annually (expected to take over 50 years).
- 

For example:
- Maximum reward rate in the 1st year(year starts from genesis timestam 2023/10/12): $7\%$
- Maximum reward rate in the 2nd year: $7\% * (100\%-1.5\%) = 6.895\%$
- Maximum reward rate in the 3rd year: $7\% * (100\%-1.5\%)^2 = 6.791575\%$
- ...
- Maximum reward rate in the 52nd year: $max\{3.25\%, 7\% * (100\%-1.5\%)^{51}\} = 3.25\%$

## Motivation

To fully align with [Aptos tokenomics overview](https://aptosfoundation.org/currents/aptos-tokenomics-overview).

## Rationale

**Considerations:**

1. Year starts from date of genesis: timestamp based (10/12)
2. 1.5% decrease happens at the end of every year. This means that at the current rewards rate (7%), the effective rewards rate at the end of the year would be 6.895% (7%-1.5%*7%)

**Alternative solutions:**

1. We can compute gradual decreases throughout the year(e.g. every 30 days), but this would make rewards calculations more complex 

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/7867](https://github.com/aptos-labs/aptos-core/pull/7867)

## Future Potential

All rewards and reward mechanisms are also modifiable via on-chain governance

## Suggested implementation timeline

Targeting end of Q2
