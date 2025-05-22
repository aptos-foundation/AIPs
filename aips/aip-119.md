---
aip: 119
title: reduce staking rewards
author: moonshiesty - moonshiesty@protonmail.com
Status: Draft
discussions-to: https://github.com/aptos-foundation/AIPs/issues/587
type: Core
created: 4/17/2025
---

# AIP-119 - reduce staking rewards

## summary

adjustments to the APT monetary expansion rate:

- **reduce staking rate by an additional 1.5%, over the next 7 months, decreasing rewards from 6.79% to 5.26%**

the current Aptos staking rewards rate schedule calls for a 0.08% rewards rate decrease in October

> *Note: this AIP proposes we follow the October decrease as originally scheduled, and schedule the final 0.25% decrease for November, resulting in the scheduled decrease of 0.08% in addition to the proposed decrease of 1.5%.*

these changes are intended as a first-step to redesigning Aptos economics to more effectively support the ecosystem. we propose implementing these changes over 6 months to allow time to assess and mitigate any impacts.

## proposed monthly staking rate reduction

| Month     | Staking Rate | Decrease (%) |
|-----------|--------------|--------------|
| Current   | 6.79%        | 0.25%        |
| May       | 6.54%        | 0.25%        |
| June      | 6.29%        | 0.25%        |
| July      | 6.04%        | 0.25%        |
| August    | 5.79%        | 0.25%        |
| September | 5.54%        | 0.25%        |
| October   | 5.46%        | 0.08%        |
| November  | 5.21%        | 0.25%        |

## motivation

the primary motivation for this change is the current staking rate is too high, discouraging capital efficiency. this change will bring Aptos base staking rewards in-line with other layer-1 blockchains [1].

the Aptos staking rewards serves as a DeFi "risk-free" rate, providing base rewards to ecosystem participants who lock capital on-chain. similar to central banks, Aptos governance can modify the "risk-free" staking rate to motivate economic behavior.

lower staking rewards encourage participants to seek out opportunities that have associated costs or risks but earn more rewards than the "risk-free" staking rate:

- restaking
- DePIN infra: RPC, bundles, indexing
- MEV
- alternative sources of DeFi rewards

however, rewards also serve as an incentive for long-term holding of APT; all things equal, less ecosystem rewards means less incentive to hold APT.

we expect this will be offset by (1) the reduction in inflation from this AIP and (2) new rewards generating opportunities launching in the next 6 months.


### out of scope

we considered more complex solutions but i believe before deciding on any long-term or complex solution we need more community feedback.

## risks and drawbacks

### impact on the validator set

below we see an APT-price sensitivity table for validators with a (common) commission rate of 5%. Based on a survey, the high end of costs for validators is ~35,000$, which is the number we used for the table. (however the cost to spec the hardware on latitude.sh are ~15k)

| Stake Delegated | Profits with 7%; APT=5$ | Profits with 7%; APT=6$ | Profits with 7%; APT=8$ | Profits with 7%; APT=10$ |
| --- | --- | --- | --- | --- |
| 1M | $-17500 | $-14000 | $-7000 | $0 |
| 3M | $17500 | $28000 | $49000 | $70000 |
| 5M | $52500 | $70000 | $105000 | $140000 |
| 7M | $87500 | $112000 | $161000 | $210000 |
| 9M | $122500 | $154000 | $217000 | $280000 |

there are currently 53 validators with less than 3M APT stake. their total stake is 78,385,658 APT, which corresponds to a ~0.09 share of the total 865,000,000 that is actively staked.

given this impact on small validators, Aptos should consider a community validator program to give grants and stake to small validators contributing to the ecosystem.

### impact on decentralization

staking emissions provide a mechanism to decentralize stake with stakers with long-term alignment. we believe there should be further discussion on more efficient ways to reward long-term economic participants such as developers, protocols and users, not just validators.

## Timeline

- week 1-4: Community and foundation review
- week 5: submit proposal to mainnet

## tokenomics overview

significant expansion rates are used to bootstrap a blockchain, with the predominant necessity of incentivizing validators and early infrastructure building. we focus here on the monetary expansion due to staking rewards. in our case, most of the newly minted tokens go to the FDN (FDN/Labs own more than 90% of the staked APT). Aptos validators typically enjoy substantial grant delegations and live on commissions. this implies that, in practice, validators mostly benefit from the cost-of-capital (which is free to them). for example, given the current expansion rate of ~7%, a delegation grant of ~10M APT ([at least 30 validators have more than 10M APT](https://explorer.aptoslabs.com/Validators?network=mainnet)), and a commission of ~7%, a validator is making ~49,000 APT annually. taking into consideration that yearly costs for a professional validator are ~30,000$, this leaves them with a hefty profit.

![image.png](https://media.aptosfoundation.org/1709093797-aptos-tokenomics-overview-chart.jpg)

often, staking rewards are substantially lower than other DeFi options (e.g., [lending](https://app.ariesmarkets.xyz/lending) or liquidity providing), so competing purely on rewards is less likely. on the other hand, staking on Aptos does not require taking on risk, with a relatively short lockup.


## further discussion

### how to further incentivize validators?

1. give the priority gas from the block to validators [burn or split base gas](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md)
2. [foundation delegation program](https://solana.org/delegation-program)
3. [bundles, block-building APIs](https://jito-foundation.gitbook.io/mev/solana-mev/jitos-mev-priorities)

### how to further incentivize ecosystem?

these previous rewards going to stakers could be shifted to incentivize other key L1 metrics such as: liquidity, gas subsidies, grants.

additionally we should put thought into how to incentivize additional validator metrics such as community participation, geographic distribution and figuring out how to scale the satoshi coefficient into the thousands on high-performance hardware.

### next generation economics?

proof-of-liquidity, restaking

### motivation for amending original proposal

this AIP originally proposed a 3% rewards decrease:

> reduce staking by 1% each month, over the next 3 months, resulting in a 3.79% staking rewards rate

i modified the original proposal from 3%->1.5% and changed the duration from 3 months to 6 months. this change was based on feedback from many in the Aptos community, especially validators and DeFi protocols. the feedback from these stakeholders was:

1) the reduction in rewards would reduce the incentive to run validators. this would hurt small, low commission validators and could hurt validator decentralization

2) the reduction in rewards was too quick: blockchains are a complex system and it's important to take time with fundamental changes like staking rewards

i believe decreasing the rewards over a longer period of time will allow the Aptos community more time to assess any positive or negative impacts of the change to the aptos ecosystem

executing the rewards decrease over 7 months will give the Aptos foundation time to expand the delegated stake program, and ensure small validators have the tools and incentives to continue staking on Aptos
