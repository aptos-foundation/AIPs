---
aip: 59
title: Storage IO Gas Adjustments
author: msmouse
discussions-to: https://github.com/aptos-foundation/AIPs/issues/291
Status: Accepted
last-call-end-date:
type: Gas
created: 12/12/2023
updated (*optional):
requires (*optional):
---

# AIP-59 - Storage IO Gas Adjustments
  
## Summary

Proposing here is to fine tune the logic of charging gas for both storage reads and writes in order to make the cost structure more fair and reflect better the system resource consumption from different transaction workloads. Specifically:

1. Charge the state read size at 4KB (dubbed "Page" onwards) intervals.
2. Tune the relative weight of per read charge over the size of the read (in pages).
3. Remove the per state write op free quota in bytes.
4. Lower the relative cost per byte write.

### Goals

Make the amount of IO gas charged a better indication of total IO latency of transactions carrying different workloads. The goal is suposed to be achieved by making the gas cost a more faithful reflection of the actual resource cost.


### Out of Scope


We limit the scope of this proposal to the area of IO gas, not including "Storage Fee". "Gas" measures the time or latency side of the transaction cost while the storage fee reflects the storage space side of things.

## Motivation


The current IO gas cost doesn't track the latency impacts over different workloads perfectly.

On the read side, loading a 50 bytes item from the state storage is virtually the same with loading one that's 2KB, while a 500 bytes item and a 20KB item makes a big difference. In most systems and at multiple levels of the software stack, bytes beyond 4KB might mean a second memory page, cache item, or even a separate random IO fetch to the filesystem.

At the same time, reading a 8KB item from the state doesn't impose 2x the cost of one that's 4KB, because there is a per read cost associated with state fetching. Amoung other factors, the cost is largely associated with the fact that a state item is authenticated via the Sparse Merkle Tree and the cost of the authentication is proportional to the height of the current tree, which is logarithmic to the total number of items in the state. That's the reason the relative weight of the per read gas cost needs to be calibrated as the state grows.

On the write side, the per write op free quota was designed back before Storage Fee was implemented, as a way to punish large writes while keeping simple txns' cost low. Now that the storage fee mechanism takes on the responsibiilty of protecting the disk space from being filled cheaply (replacing both the storage gas cruve, removed by AIP-38 and the per write free quota), we can remove it. With the free quota present, a txn that writes to a lot of smaller items is not expensive enough to reflect the latency impact relative to what's charged on a txn that writes to a few large items that takes roughly the same amount of time.

...

## Impact

Simple transactions commonly seen on the mainnet will have roughly the same cost after we fine tune the gas schedule by adjusting the reletive weight between IO gas cost and computational gas cost and scaling the whole schedule.

## Alternative solutions

N/A

## Specification

Read gas is still governed by these two gas parameters:
* `storage_io_per_state_slot_read`: tuned.
* `storage_io_per_state_byte_read`: while charging, the size of the state read is rounded up to 4KB boundaries and then charged this much per byte.

On the write side:
* `free_write_bytes_quota`: ignored
* `storage_io_per_state_byte_write`: much lowered since it's now not subject to the free quota.

Reletive weights between reads and writes, and between IO and computation are tuned. The final numbers will be shipped as part of [AIP-58](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-58.md)

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/11300

## Testing (Optional)

Gas calibration.

## Risks and Drawbacks

Pricing flactuation for existing entry points before and after enabling the new logic. The gas calibration will make sure the commonly seen "good" transactions' cost doesn't jump too much.
We are less worried because the gas price on the network is currently vary low, closed to ignorable.

## Future Potential

N/A

## Timeline

### Suggested implementation timeline

12/2023

### Suggested developer platform support timeline

The existing gas estimation mechanism should work and the ecosystem relying on that will automatically send txns with correct estimated gas after simulation. Not seeing a need for changes from the platform side.

### Suggested deployment timeline

v1.9, early 2024


## Security Considerations



## Open Questions (Optional)


