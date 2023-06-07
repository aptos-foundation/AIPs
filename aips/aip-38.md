---
aip: 38
title: Deprecate Storage Gas Curve
author: msmouse
discussions-to (*optional):
Status: Draft
type: Core
created: 06/07/2023
---

# AIP-38 - Deprecate storage gas curves

## Summary

Now that **[AIP-17](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-17.md)** has deployed, it’s no longer necessary to leverage the [storage gas curves](https://github.com/aptos-labs/aptos-core/blob/0a2aba9f2b1755356caa21d31a56742518a9e327/aptos-move/framework/aptos-framework/sources/storage_gas.move#L1) to protect the storage from being filled quickly due to gas prices going super cheap. Proposing here to deprecate the curves and make IO gas prices stable.

## Motivation

To stabilize IO gas charges, free of price increments due to the existence of the curves. 

## Impact

The mainnet haven’t had a large enough state to trigger the initial price increment from the curves. Proposed is to set IO related gas charges that used to be governed dynamically by the curves to static values in the global gas schedule, mostly same values with the initial values on the curves (but a bit lower, see the specification section).

## Rationale

Read the storage curve [documentation](https://github.com/aptos-labs/aptos-core/blob/0a2aba9f2b1755356caa21d31a56742518a9e327/aptos-move/framework/aptos-framework/sources/storage_gas.move#L1) for the rationale of it. But in spirit back then when storage allocation cost was governed by gas price changes just like other aspects of the transaction cost, lowering the overall gas price put the storage to the danger of being filled for cheap. The gas curves were a defensive mechanism protecting the DB in case we lower the gas pricing. After AIP-17, such needs are gone in that: 1. the storage allocation are now governed by the storage fees which are decoupled from gas pricing, and 2. the IO gas charges are still under the control of the curves which doesn’t make sense anymore. So, we are cleaning it up, with the added benefit of a more stable gas schedule.

## Specification

Adding these dimensions to the global gas schedule, and setting to initial (and current) values on the curves (all of these are in gas units):

- storage_io_per_state_slot_write
- storage_io_per_state_byte_write
- storage_io_per_state_slot_read
- storage_io_per_state_byte_read

Notice that we don’t distinguish a new allocation and a modification of an existing item anymore, since the disk space cost of allocating a storage slot is covered by the storage fee, while these gas charges covers the IO cost, which is the same between an allocation and a modification.

## Reference Implementation

[TBD]

## Risks and Drawbacks

## Timeline

### Suggested implementation timeline

release 1.6

### Suggested developer platform support timeline

Not needed

### Suggested deployment timeline

with release 1.6

## Security Considerations
