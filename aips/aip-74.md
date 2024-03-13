---
aip: 74
title: Increase block gas limit to account for concurrency increase
author: Sital Kedia (skedia@aptoslabs.com), Igor Kabiljo (ikabiljo@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/375
Status: Accepted
type: <Standard>
created: <03/12/2024>
---

# AIP-74 - Increase block gas limit to account for concurrency increase

## Summary

 We upgraded the hardware spec for mainnet validator nodes in order to achieve higher throughput on mainnet 
 and as a result, we also increased the default concurrency used in BlockSTM 
 to 32 in https://github.com/aptos-labs/aptos-core/pull/12200. In order to fully utilize higher concurrency,
 we also need to increase the block size and block gas limit. This AIP proposes to increase the block gas limit
 and related configurations by 50% to account for the concurrency increase.

### Goals

 Increase the mainnet throughput post hardware upgrade.

## Motivation

We upgrade the hardware spec for mainnet validator nodes in order to achieve higher throughput on mainnet
and as a result, we also increased the default concurrency used in BlockSTM
to 32 in https://github.com/aptos-labs/aptos-core/pull/12200. In order to fully utilize higher concurrency,
we also need to increase the block size and block gas limit. This AIP proposes to increase the block gas limit
and related configurations by 50% to account for the concurrency increase. This change will essentially increase
the throughput of the mainnet by 50% and will allow the network to handle more transactions per second.


## Impact

 This along with block size increase will result in 50% increase in the throughput of the mainnet.

## Testing

 The increase the block gas limit has been tested in Forge as well as in devnet and testnet and they 
 resulted in higher throughput as expected.
 

## Timeline

### Suggested deployment timeline

 Plan is to have it enabled with governance proposal targetting 1.10

