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

This AIP proposes a 1.5% yearly decrease in staking rewards, which is part of the Aptos tokenomics requirement. 

## Motivation

Currently, the maximum reward rate starts at 7% annually and is evaluated at every epoch. The maximum reward rate declines by 1.5% annually until a lower bound of 3.25% annually (expected to take over 50 years).

## Rationale

**Considerations:**

1. Year starts from date of genesis: timestamp based (10/12)
2. 1.5% decrease happens at the end of every year. This means that at the current rewards rate (7%), the effective rewards rate at the end of the year would be 6.895% (7%-1.5%*7%)

**Alternative solutions:**

1. We can compute gradual decreases throughout the year, but this would make rewards calculations more complex 

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/7867](https://github.com/aptos-labs/aptos-core/pull/7867)

## Future Potential

All rewards and reward mechanisms are also modifiable via on-chain governance

## Suggested implementation timeline

Targeting end of Q2
