---
aip: 32
title: Storage Deletion Refund
author: msmouse
discussions-to: https://github.com/aptos-foundation/AIPs/issues/127
Status: On Hold
last-call-end-date: TBD
type: Standard (Core)
created: 05/05/2023
---

# AIP 32 - Storage Deletion Refund

# Summary

Proposed is to refund part of storage fee (introduce in [API-17](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-17.md)) paid for storage slot allocation to the original payer when a slot is freed by deletion.

# Motivation

To reflect that freed storage slots no longer impose costs to the blockchain.

Now that [AIP-17](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-17.md) has been implemented and deployed, storage allocation is charged on a per slot basis and according to native currency based pricing without being affected by the gas price. On top of that, we propose to keep a record of the amount paid for the allocation, so that we will be able to refund it. 

Storage refund incentivizes cleaning up unused storage slots.

## Alternative - Ephemeral Slots

We can provide interfaces for a Move contract to allow a storage slot to go away automatically in the short future, in exchange for lowering fees. A slot can be allocated for cheap if it's "promised" to be deleted (user can delete it explicitly before set TTL for a bit additional refund, or the system will reclaim it after it expires).

Because the allowed life span can't be too short due to practicality and cost associated, it's fairly possible for one to fill up the storage for cheap if the upfront charge is too low, defeating the purpose. At the same time items that goes away automatically and permanently can result in user confusion and fraud.

Nonetheless this can be a user experience improvement but is a more intrusive semantic change for a developer and a user. Could be something to consider in the future.

## Alternative - Rent

All or most storage slots except small whitelist of state item types, are forced to have a TTL since last access. Expiring (TTL reached) causes the slot to be "mark deleted" to free most of the on-chain cost, but the user is given the ability to resurrect the slot for a cost. The allocation will be charged for its permanent existence, which one can argue is always undercharged - because the charge is finite while the time span it can exist is infinite. Counterarguments against Rent/TTL:

1. Storage gets cheaper over time. If charged properly on creation, the cost a permanent slot imposes, although permanently, might not matter in the long run.
2. The idea of a storage slot can go away by itself forcibly without a user declared TTL is frustrating.
3. In the world of smart contract, especially one that only has a very loose account-based model like ours, the rent interface can be very intrusive on the ecosystem level - a small piece of data expiring can cost the liveness a whole bunch of contracts.
4. "Resurrect-able" is the bottom line I can imagine we must provide - things won't go away "permanently", people can at least get it back by paying. However, not only implementing resurrection and the auxiliary system that serves the expired data (with proof) implies much resource cost, but it also means permanent on-chain data that can't be cleaned up (tombstones).

# Specification

## Language and framework

No visible change to how one writes Move. But the economics changes:

## Economics

- The current on-chain timestamp and the amount paid for slot allocation will be tracked as metadata attached to the slot. For simplicity, the refundable part of the gas charge will be burnt even if other parts of the gas charge are redistributed, lowering the global supply of the native token.
- For a deleted slot, a refund is mintted and issued to the transaction payer, increasing the global supply of the native token.

# Reference Implementation

[TBD]

# Risks and Drawbacks

1. Refunding to the deleter makes it profitable for a malicious module developer to update the code and delete user data.
2. Refunding to the deleter makes it easy to resell storage slots, which promotes speculation on storage pricing.
3. Full refund provides no protection against reserving storage for future usage or reselling. In expectation of higher storage pricing, one can speculatively reserve storage slots for long at virtually no cost (aside from locking up the value).

# Future Potential

## Declining Refund Ratio Over Time

To protect against speculation on storage pricing and incentivize timely storage clean up, the refund can be implemented as declining over time -- If deleted swiftly, the refund will be full, and over time the refund ratio declines to a configurable minimal.

## Storage Deposit

The refundable amount can be tracked globally or on a per acount basis (call it storage deposit), providing clarity and potentially enables incentivizing the validators for storing the onchain data by generating and redistributing interest from the deposit.

# Suggested Implementation Timeline

Release 1.8
