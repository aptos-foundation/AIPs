---
aip: 94
title: Reduce stake lockup duration to 14 days and governance voting duration to 3 days per community vote
author: Tony (https://github.com/tony001242), Eric (eric@amnis.com)
discussions-to (*optional): 
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Core
created: 7/11/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <mm/dd/yyyy>
---

# Reduce stake lockup duration to 14 days and governance voting duration to 3 days per community vote

## Summary

Aptos (APT), the layer 1 blockchain that we’re building upon, employs a Proof of Stake (PoS) consensus mechanism, wherein validators stake tokens to participate in network operations and governance.
Currently, Aptos has a 30-day lock-up period for staked tokens, one of the longest among layer 1 protocols. This duration aims to ensure network stability and robust on-chain governance. However, feedback from various stakeholders suggests that reducing this period might offer significant benefits.
As such, we’re proposing some possible implementation options for our community to consider (see it here https://x.com/AmnisFinance/status/1805072839508418622). We conducted a survey within the community, and the winning option is to reduce the lock-up period to 14 days and the voting period to 3 days. This combination offers the best trade-offs between shorter staking lockup and providing ample time for the community to vote on governance proposals on Aptos.

## Rationale

Several factors drive the consideration to reduce the lock-up period for staked APT tokens:

- DeFi Partners and Projects Demands: Some of our DeFi partners, especially LSD and lending projects have expressed a desire for more flexible liquidity to facilitate more dynamic and responsive financial strategies.
- Industrial Standard: CEX like OKX that offer staking products for multiple chains also favor shorter lock-up periods to better align with industry standards and improve their service offerings.(Other chain: Solana & Sui)
- Community Demand: Our community members have also expressed their interest in actively participating in staking without committing to long lock-up periods. As such, reducing the lock-up duration could attract more users to stake their tokens, increasing overall network participation and security.
- Efficient Operation: Node operators sometimes miss the unlock date, leading to inefficiencies. Shorter lock-up periods could mitigate these issues by providing more frequent opportunities to adjust stakes, enhancing operational flexibility.
- Lowering Depeg Risk: Typically, when unstaking on Aptos, users wait for 30 days for their token return. To avoid this, some opt to swap to APT on other platforms, risking depeg and losing a significant amount of their original asset. Reducing the unstaking time can help shorten the waiting period, allowing users to unstake faster without worrying about depeg risks, thus maintaining a more stable peg for LSD tokens.

### Why updating voting duration while this AIP is focued on shoterning the lockup duration?

To vote for a proposal, the stake pool’s remaining lockup must be **at least** as long as the proposal’s duration (read more about Aptos Governance [here](https://aptos.dev/en/network/blockchain/governance)). If we shorten the lockup duration to 14 days without adjusting the voting duration, the possibility that the stake pool lacks sufficient lockup duration for voting will be significant higher than before, which could result in operational pain for a node operator attempting to vote for a proposal and not being able to vote. Because of this nature, when we adjust the lockup duration, we should ideally adjust the voting duration accordingly to make the governance process work smoothly. This can be revisit in the future on the implementation.

## Impact and risks

Despite the potential benefits, reducing the lock-up period introduces several risks:

- Operational & Governance Challenges: Tracking lock-up dates becomes challenging with frequent release cycles and varying schedules among validators, limiting participation in governance. This can overwhelm validators and participants, potentially leading to burnout and reduced engagement. Such challenges may weaken governance effectiveness by shrinking the pool of active and informed participants.
- Failing Governance Proposal: With validators on different lock-up schedules, it becomes challenging to ensure that enough voting power is available for proposals. This can lead to proposals failing not because of a lack of support, but due to insufficient participation. Tracking and managing this aspect would require additional resources and effort.
- Network Stability: Network stability might also be compromised due to more frequent unstaking, which could lead to volatility in validator participation and, consequently, in network security.
- Perceived Decentralization: A shorter voting period restricts stakeholder review time, risking hasty decisions that may not benefit the network. It could empower a minority to dominate, undercutting inclusiveness and governance deliberation. This perception may erode confidence in Aptos' decentralization, possibly prompting decentralized governance proponents to consider alternative projects.

Parties affected:
- All token holders who participates in governance voting: need to review and react to each proposal with shorter time, also shorter time window to voice concerns and reject proposals.
- Aptos Foundation board: for reviewing the proposal and make a decision within 3 days. There's lot of prep work can be done beforehand, but it would be a change of how Foundation reviews the source of truth and provide recommendations.
- Delegated voters: have to react within 3 days to validate the proposal and cast the vote, which could land in weekends too.
- Aptos core team: need to coordinate with the development cycle, testing process, provide writeup to the wider community to help with voting on proposals.

Advantages:

- Quicker Governance Decisions: A shorter voting period of 3 days allows the network to respond rapidly to changes and opportunities.
- Increased Liquidity: Faster governance cycles mean that tokens can be unstaked and redeployed more quickly, enhancing liquidity for stakeholders.

Disadvantages:

- Operational Complexity: The reduced voting period requires validators and network participants to make decisions more quickly, which can increase the risk of rushed or poorly considered decisions.
- Stakeholder Engagement: The shorter period may lead to participant burnout and disengagement, as the pace of governance becomes more demanding.
- Perceived Centralization: A 3-day voting period might allow a smaller group of active participants to dominate decision-making, which could undermine the perception of decentralization.

## Specification and Implementation Details

Create on-chain governance proposal to reduce the lock-up period to 14 days and the voting period to 3 days.

Configuration to update:
- `recurring_lockup_duration_secs`
- `voting_duration_secs`

### Suggested implementation timeline

The change should be available on mainnet in September 2024.

