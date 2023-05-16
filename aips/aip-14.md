---
aip: 14
title: Update vesting contract
author: movekevin
Status: Accepted
last-call-end-date:
type: Standard (Framework)
created: 2023/02/10
updated: 2023/02/10
---

## Motivation

This AIP proposes an update to the current reward distribution logic in the vesting contract: [https://github.com/aptos-labs/aptos-core/blob/496a2ce5481360e555b670842ef63e6fcfbc7926/aptos-move/framework/aptos-framework/sources/vesting.move#L420](https://github.com/aptos-labs/aptos-core/blob/496a2ce5481360e555b670842ef63e6fcfbc7926/aptos-move/framework/aptos-framework/sources/vesting.move#L420).

The current reward calculation currently uses the underlying staking_contract’s recorded principal, which is updated every time staking_contract::request_commission is called.

## Proposal

Using the staking contract’s principal is indirect and the vesting contract can use it remaining grant amount as the base to get the actual amount of accumulated rewards so far. Here’s an example to make this clearer:

1. Vesting contract has 100 APT and 1 staking participant (to keep it simple). 100 APT is also the remaining amount. The underlying staking contract has a principal of 100 APT.
2. The stake pool earns 50 APT.
3. Before calculating outstanding rewards that belong to the vesting pool, vesting::unlock_rewards first requests commission to be paid out to the operator, which is 5 APT (10% of 50 APT earned). Remaining total active stake is 145 APT, all belonging to the vesting pool.
4. Since there’s been no tokens vested yet, the current vesting::unlock_rewards would calculate outstanding rewards to be 145 (total active in stake pool) - 100 (remaining_grant) = 45 to be distributed to staking contract participants.

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/6106](https://github.com/aptos-labs/aptos-core/pull/6106)

## Timeline

Targeted testnet release: February 2023
