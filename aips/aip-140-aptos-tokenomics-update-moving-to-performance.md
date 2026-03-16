---
aip: 140
title: "Aptos Tokenomics Update: Moving to Performance-Driven Supply Mechanisms"
author: Aptos Foundation
discussions-to (*optional): https://x.com/Aptos/status/2024216329826230392
Status: Draft
last-call-end-date (*optional): 03/06/2026
type: Tokenomics
created: 02/18/2026
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-140: Aptos Tokenomics Update: Moving to Performance-Driven Supply Mechanisms

**TL;DR:** The Aptos network is transitioning to performance-driven tokenomics designed to align supply mechanics with network utilization. This update replaces bootstrap-era subsidy with mechanisms tied to transaction activity, establishing a framework where burns can exceed emissions as high-throughput applications scale. This new phase marks an evolution into a performance-driven financial network.

---

## Technical Validation and Network Maturity

Aptos launched mainnet in October 2022. Nearly four years later, the network has transitioned from generalized L1 infrastructure to supporting specific high-throughput use cases at enterprise scale.

The network operates with <50ms block times, 99.99% uptime, and zero major exploits. A native ecosystem developed with nearly 500 active monthly developers across 9.7k open-source repositories and over 200 projects in production across DeFi, payments, and infrastructure, with app revenue growth up 1,552% to $33.5M. Major institutions, including BlackRock, Franklin Templeton, and Apollo, deployed hundreds of millions onchain.

Decibel will launch on Aptos as the first fully onchain decentralized exchange, executing every order, match, and cancel onchain. This represents a shift from generalized blockchain infrastructure to high-frequency, scalable products made for Aptos's Global Trading Engine architecture.

The tokenomics update below establishes economic mechanisms designed for this new phase of high-throughput financial applications built on Aptos.

---

## From Bootstrap Subsidy to Deflationary Supply

Bootstrap-era high inflation supported infrastructure development. That model is not sustainable for a network processing institutional-grade economic activity. Aptos Foundation is proposing structural reforms that replace subsidy-based emissions with performance-driven mechanisms, establishing conditions for reduced emissions, increased burns, and potential decline in circulating supply.

### Current APT Supply and Emission Schedule

There are currently 1.196 billion APT in circulation. Supply dynamics are already improving without intervention: the four-year unlock cycle for initial investors and core contributors concludes in October 2026, reducing annualized supply unlocks by 60%. Foundation grant distributions are declining as bootstrap commitments complete, decreasing over 50% year-over-year from 2026 to 2027.

This natural inflection point reduces emissions substantially, but structural constraints are still required. Without reform, emissions continue indefinitely with no hard ceiling, no performance requirements, and no connection between issuance and network activity. The mechanisms below establish these constraints.

---

## Tokenomics Updates

### 1. Staking Reward Rate Reduction and Long-Term Staker Incentives

Aptos Foundation believes it is critical to balance strong validator incentives with long-term supply discipline. To support this objective, Aptos Foundation intends to initiate a governance proposal to reduce the annual staking rewards rate from **5.19% to 2.6%**. This new proposal builds on the recent reduction to 5.19% that was proposed in AIP-119.

In addition, Aptos Foundation is exploring a governance proposal to change the staking framework to better align incentives with long-term network participation. Under this approach, participants who elect longer staking commitments would be eligible for higher reward rates relative to those choosing shorter staking durations. The aggregate rewards distributed would remain consistent with the reduced overall emissions level described above. In tandem, new validator architecture in AIP-139 is intended to reduce operational cost significantly. These combined changes are intended to encourage stable, long-term participation in securing the network while ensuring appropriate token supply emissions.

As Aptos Foundation continues to develop the details, additional information will be shared with the community, including as part of any formal governance proposal.

### 2. 10X Gas Fee Increase

Aptos blockchain is currently one of the lowest cost blockchains with transaction fees orders of magnitude below other blockchains. All transaction or "gas" fees, paid in the form of APT, are burned. As a result, given how low transaction fees are, Aptos Foundation will propose via governance to increase the "gas" fees initially by **10X the current amount**, with consideration of additional increases in the future. Even with a 10X increase, stablecoin transfers would still be the lowest in the world at around **$0.00014**, making it the ideal blockchain for stablecoins, payments, and any other similar high-volume transactions.

This, in conjunction with increased onchain activity and transactions from new applications being built on Aptos, would substantially increase the aggregate amount of APT that is burned and removed from circulation.

### 3. Trading Utilization and Fees

High-throughput activity isn't just a performance metric — it directly reduces APT supply.

Decibel, the onchain decentralized exchange protocol built on Aptos, introduces a powerful new deflationary mechanism: high-frequency transaction activity consuming and burning APT in gas fees at scale.

Currently, all transaction or "gas" fees paid on the network are permanently burned. Decibel, which was incubated by Aptos Labs in partnership with the Decibel Foundation, represents one of the first fully decentralized exchanges that executes all trading activity onchain: every order, match, and cancel. With 100% onchain execution, the launch of Decibel mainnet will dramatically increase the transaction throughput on the Aptos blockchain.

At scale, aggregate transaction fees generate substantial APT burns despite low per-transaction costs. Together with the increase in the gas fees noted above, this results in significant APT supply burn.

The math is straightforward: the more markets listed and products supported by Decibel, the higher operational TPS is necessary.

- As Decibel approaches **100+ markets** going into next year, it is projected to burn over **32 million APT per year**
- As Decibel scales further toward **10,000 TPS and beyond** across markets and new products, this burn rate grows commensurately

### 4. Hard Supply Cap: 2.1 Billion APT

Aptos Foundation will propose via governance a **hard protocol-level cap of 2.1 billion APT**. No tokens can ever be minted beyond this ceiling once approved by the community.

| Metric | Amount |
|---|---|
| Current circulating supply | 1.196B APT |
| Minted at mainnet | 1.000B APT |
| Distributed as staking rewards since mainnet | 196M APT |
| Remaining headroom under cap | ~904M APT (~43%) |

These additional tokens may be distributed as staking rewards in decreasing amounts over time to incentivize validators. As supply reaches the hard cap, staking rewards will eventually be phased out and validators will be funded by transaction fees. The expectation is that burns outpace emissions well before this ceiling is reached, making the hard cap a supply safety mechanism rather than an anticipated endpoint.

### 5. Foundation Permanent Lock: 210 Million APT

Aptos Foundation will ensure that **210 million APT will be locked and permanently staked** for the network. Such tokens would never be sold or distributed.

- Represents ~**18% of current circulating supply**
- Represents ~**37% of original Foundation-held tokens** at mainnet
- Functionally equivalent to a token burn — 210 million APT removed from any sale or distribution

The Foundation will stake these tokens perpetually, supporting operations through staking rewards rather than token sales. This model aligns Foundation incentives with long-term network security and performance.

### 6. Performance-Gated Grant Issuance

Going forward, Aptos Foundation will focus primarily on providing future grants and rewards that **vest only upon hitting key milestones** tied to Aptos' role as the global trading engine.

For new grants related to the global trading engine, if KPIs are not met, token grants are **deferred, not canceled** — delayed until performance is demonstrated. This creates a direct link between ecosystem success and token issuance: the network and its participants earn their inflation rather than receiving it unconditionally.

More details to come on this structure.

### 7. Programmatic Buyback Program

Aptos Foundation has committed to exploring a **protocol buyback program or reserve** that would programmatically purchase APT in the open market based on market opportunities. Such a program would be funded using a portion of cash on hand or future revenue of Aptos Foundation, including revenue from licensing, ecosystem investments, and other sources.

---

## Path to a Deflationary Token

These mechanisms are designed to work in concert:

**Supply declining:**
- Staking reward rates cut in half (proposal)
- 2.1 billion hard supply cap
- Natural unlock reduction (~60% YoY)
- Aptos Foundation permanently staking 210 million tokens

**Burns increasing:**
- Proposed higher gas fees
- Decibel DEX activity generating higher TPS and burning significantly more APT annually, scaling with market growth

**Programmatic buybacks:**
- Aptos Foundation exploring a potential protocol buyback program or reserve

Upon implementing these mechanisms, the combination of declining supply and emissions, Decibel-driven burns, and buybacks can create a **crossover point** where APT removed from circulation exceeds APT entering circulation — at which point the token supply becomes deflationary.

---

## Ecosystem Impact

**For tokenomics:** Supply pressure declines materially starting in 2027. The proposed decrease in staking rewards and additional APT burned from higher transaction fees and Decibel DEX activity reduce available APT supply. The 210 million APT permanently staked by Aptos Foundation removes significant potential supply. Future grants are tied to performance goals that network participants must achieve.

**For builders:** Grant programs transition to milestone-based vesting tied to measurable performance. Foundation resources concentrate on high-throughput trading and money movement infrastructure, where Aptos architecture provides differentiated capabilities.

**For validators:** Staking rewards continue, but the Foundation will propose a reduction to an annual rate of 2.6% to align incentives for both validators and other ecosystem participants. Hardware costs will also decline with AIP-139. Aptos Foundation's 210 million permanently staked tokens will continue to be staked with validators to ensure longevity and ongoing network security.

---

> **DISCLAIMER:** THIS DOCUMENT IS PROVIDED FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE AN OFFER TO SELL OR THE SOLICITATION OF AN OFFER TO PURCHASE TOKENS. THIS DOCUMENT CONTAINS HYPOTHETICAL AND FORWARD-LOOKING STATEMENTS AND/OR PROJECTED FIGURES THAT ARE NOT GUARANTEED; ACTUAL RESULTS AND NUMBERS MAY DIFFER. APTOS FOUNDATION MAKES NO REPRESENTATION OR WARRANTY, EXPRESS OR IMPLIED, AS TO THE ACCURACY OR COMPLETENESS OF THIS INFORMATION, AND IT IS SUBJECT TO CHANGE WITHOUT NOTICE.
