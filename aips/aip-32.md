---
aip: 32
title: Add Smart Contract developer fee sharing
author: schultzie-lavender.five nodes
discussions-to (*optional): https://github.com/aptos-labs/aptos-core/issues/7146
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 5/5/2023
---

# AIP-32 - Add Smart Contract developer fee sharing

Implement a fee-sharing mechanism, where half of the transaction fee of a smart contract call 
will go to the contract’s contributor address(es), and the other half will be burnt as usual, 
or distributed per [AIP-7](https://github.com/aptos-foundation/AIPs/issues/23). 

## Motivation

Developers historically have had a difficult time finding funding sources unless they 
either a) create their own token, or b) are funded by a foundation/grant. In the United States 
especially, creating your own token creates significant legal hurdles so as to not be considered
a security by the SEC. Receiving grants from a foundation is also a difficult task, but not 
insurmountable. 
**Adding a clear money/incentivization path for smart contract developers would be a massive boon for the Aptos ecosystem.**

In several competing ecosystems, including [Near](https://near.org/), Smart Contract developers 
get [30%](https://docs.near.org/concepts/basics/transactions/gas) of all fees spent invoking a 
smart contract. This incentivizes Smart Contract developers to build on the platform, as getting 
further mindshare means further smart contract invocations. Further, this gives a clearer incentive/monetary 
path for developers.

[Juno](https://www.junonetwork.io/) is another such Smart Contract platform that has recently 
added a [fee-share mechanism](https://commonwealth.im/juno/discussion/7095-implement-a-feesharing-mechanism),   
with developers receiving 50% of fees and validators receiving the other 50%.

## Pitch

Rather than burn all fees spent on block creation, share part of it with smart contract developers. Ideally this would be a value configurable by governance so an on-the-fly change can be made.
