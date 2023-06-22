---
aip: 38
title: Deprecate Storage Gas Curves
author: msmouse
discussions-to (*optional):
Status: Draft
type: Core
created: 06/07/2023
---

# AIP-38 - Deprecate storage gas curves

## Summary

Now that **[AIP-17](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-17.md)** has deployed, storage space cost (the storage fee) is decoupled from gas pricing, it’s no longer necessary to leverage the [storage gas curves](https://github.com/aptos-labs/aptos-core/blob/0a2aba9f2b1755356caa21d31a56742518a9e327/aptos-move/framework/aptos-framework/sources/storage_gas.move#L1) to dynamically increase storage gas charges according to total state storage usage in order to protect against state explosion. Proposing here to deprecate the curves and make IO gas prices stable.

## Motivation

The storage gas curves are no longer necessary (see Rationale), and keeping them will still make the state read / write related gas charges increase with the growth of the global state storage, which makes the pricing unnecessarily unstable without a meaningful effect of protect the DB. The motivation of deprecating the curves is to remove the unstablizing effects on the gas pricing from them.

## Impact

The mainnet haven’t had a large enough state to trigger the initial price increment from the curves. Proposed is to set IO related gas charges that used to be governed dynamically by the curves to static values in the global gas schedule, mostly same values with the initial values on the curves (but a bit lower, see the specification section). 

The testnet had the curve kicked in already but will be realigned with mainnet after this deprecation is applied.

## Rationale
At Aptos launch, storage allocation and access are both charged according to the regular user specified gas pricing, which is expected to be low while the network throughput is low, which makes it possible to fill the blockchain storage space for cheap. The [storage curves](https://github.com/aptos-labs/aptos-core/blob/0a2aba9f2b1755356caa21d31a56742518a9e327/aptos-move/framework/aptos-framework/sources/storage_gas.move#L1) were put in place to dynamically increase the storage gas prices with the growth of the global state storage, providing economic pressure against allocating new storage space. **[AIP-17](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-17.md)** were proposed and implemented so that an additional category of charges, i.e. the storage fees, were imposed which are priced in absolute native token values hence decoupled from the user specified gas unit price. Now storage gas charges (excluding for the storage fees) cover only the transient aspects of storage accesss costs (IO and bandwidth), and should not increase according to storage space usage growth. However they are still being changed dynamically according to the storage gas curves in place.

## Specification

Adding these dimensions to the global gas schedule, and setting to initial (and current) values on the mainnet curves (all of these are in gas units):

- storage_io_per_state_slot_write
- storage_io_per_state_byte_write
- storage_io_per_state_slot_read
- storage_io_per_state_byte_read

Notice that we don’t distinguish a new allocation and a modification of an existing item anymore, since the disk space cost of allocating a storage slot is covered by the storage fee, while these gas charges covers the IO cost, which is the same between an allocation and a modification.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/8605

## Risks and Drawbacks

## Timeline

### Suggested implementation timeline

release 1.6

### Suggested developer platform support timeline

Not needed

### Suggested deployment timeline

with release 1.6

## Security Considerations
