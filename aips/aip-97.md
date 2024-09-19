---
aip: 97
title: Storage Format Change 
author: grao1991
Status: Draft
type: <Informational>
created: <09/12/2024>
---

# AIP-97 - (Storage Format Change)
  
## Summary

Scalability and performance have been a hot topic for L1 blockchains recent years. As the Aptos ecosystem grows, it becomes more and more important. There are frequently questions asked around how Aptos is storing the blockchain data, and going forward, with the amount of data keeps increasing, how they can be served in a scalable and reliable way, without putting too much additional work for operators who provide the data. The Aptos team has implemented several changes in the storage format as the first step. The goal of this AIP is to provide details on what was implemented and how it can be rolled out to mainnet. In addition to that, this AIP also include some future directions the Aptos team is aiming to go in the near future.

The change of storage format is implementation details, it doesn’t change any core protocol or data structure. The existing APIs mostly stay the same, with the exception that some APIs that depend on secondary indices are now required opt-in, and those secondary indices are built in an async manner.

The performance improvement of this storage format change will be various, depending on the # of states stored on blockchain, the types of transactions the blockchain is running, the hardware spec, etc. To give a rough idea, Aptos team has tested this in one of the testing environment using peer-to-peer transfer transactions. The TPS improves to ~25K from ~14K.

### Out of Scope

The node is still assumed to be run at a single machine. Multi-machine storage engine is not in the scope.

## High-level Overview

### Storage Sharding

RocksDB has some limitation on the write throughput due to some of operations have to be single-threaded, which becomes the performance bottleneck at high load. Today we rely on committing a large amount of data as a single atomic transaction to RocksDB, to provide DB level atomicity. However it is not necessary for the blockchain node. The overall idea is to use multiple RocksDB instances instead, and managing the consistency semantic at the application level.

At the same time, a new configuration is implemented to allow different databases to be put in different folders. It will make it easier to use multiple disk to store blockchain data.

#### Ledger Db Split

Multiple RocksDB instances, each for a single type of data, will be used, rather than store them together in a single instance as we do today.

#### StateKv Db and StateMerkle Db Sharding

Even without considering the history of states, both DBs will need to keep at least the most recent state of the whole blockchain, which will be huge as the usage of blockchain increase, and eventually become the performance bottleneck. Instead of using a single RocksDB instance, 16 shards, each of the shard in a separate DB instance, will be introduced to improve the performance.

### Async Secondary Indices in Node

There were a few secondary indices that are only used to serve some read APIs, but not required by transaction simulation/submission/execution. As the system evolves, it's believed that those APIs are better severed by an alternative solution, e.g. indexer, rather than by node. It will take a while for the ecosystem to adopt to a different solution. During this period, the node will keep those indices in a separate index database. By moving them off critical path and generate them asynchronously, it improves the performance while maintaining the backward compatibility.

### Rekey the StateKv Db

Change the key of StateKV table to be the crypto hash of the key itself. This will save some storage space, become more cache friendly, and make fast sync even faster.

### Add Block Information

Previously `block` is not a first-class concept in the storage layer. Previously NewBlockEvent or the BlockMetadata/StateCheckpoint Transaction are used to find the block boundary, which is not efficient. Given `block` is a well-known concept in the blockchain industry, it is better to make it more explicit at storage layer.

## Impact

It’s OK to have both new format and old format in the same network at the same time. However on a single node, the storage must be in the either old format or new format, not both. The storage on the node needs to be wiped, and the data need to be re-synced (with a local config flag on) in order to adopt to the new format. Both format will co-exist in the network for a while, and the old format will be supported until end of 2024.

With second indices move to internal indexer, if public fullnodes want to still support the following APIs, they need to enable internal indexer on their node. These APIs will be gradually phased out in the future, and will only be supported for backward compatibility reason at best effort. We expect enabling them will only have minimal performance impact today as long as the CPU and disk meet the spec.

- `/accounts/{address}/events/{event_handle}/{field_name}`
- `/accounts/{address}/events/{creation_number}`
- `/accounts/{address}/transactions`
- `/accounts/{address}/modules`
- `/accounts/{address}/resources`

### How is ledger_version handled between the internal indexer and other APIs when there is a discrepancy?
- If the internal indexer is enabled, the node will return the latest version from the internal indexer as the most recent ledger information. This approach minimizes user disruption by eliminating the need for an upfront migration. Currently, the delay between the internal indexer and storage on devnet is under one second.

- We will not introduce a separate field to distinguish between the internal indexer and other APIs at this time. This will only be considered if a clear need arises in the future.

### What will the default configuration be for different node types?
1. Validator and VFN (Validator Full Node):
  - During the migration phase, the sharding configuration will default to OFF to ensure uninterrupted operation of existing nodes. After a gradual rollout, sharding will be enabled by default for any new nodes.
The internal indexer will also default to OFF for validator nodes, as API calls are not typically directed towards validators or VFNs.
  - Each validator operator can adjust these settings according to their specific needs.
2. PFN (Public Full Node):
  - Similarly, during migration, the sharding configuration will default to OFF to prevent disruptions. Each PFN operator will need to manually update the configuration to migrate their database. If the ecosystem widely adopts sharding mode, future nodes may have sharding enabled by default. Any such change will be announced in advance.
- The internal indexer will also be OFF by default for PFNs. If an operator migrates to sharding mode, they should evaluate whether the additional account APIs are necessary for their specific use case.
- Each full node provider can adjust the configuration as required. For instance, Aptos Labs will enable the internal indexer on its PFNs to avoid immediate impact on the ecosystem.

## Specification and Implementation Details

### Implementation

#### Ledger Db Split

The LedgerDb was responsible of storing Transaction, WriteSet, Events, TransactionInfo, TransactionAccumulator, StateKv data and related indices in the old format. When storage receives a chunk/block of data to commit, it generates a giant RocksDB transaction consist of all changes, and commits it as an atomic operation. In this approach, it's hard to reach a high throughput. Even with some multi-thread processing and committing logic added at the application layer, it's still far away from utilizing CPU resources and disk bandwidth because some of operations inside a single RocksDB instance cannot be run in parallel, which becomes the bottleneck during high load.

Therefore, in the new format, multiple RocksDB instances are introduced to store each of the 6 types of data above. Each data type comes with their own commit progress tracker and pruner progress tracker, so the API can rely on them to maintain the same consistency guarantee, by making all the data appear to be committed atomically, even the underlying implementation choose to commit them separately.

There was some study on whether each data type should be further split into multiple databases. However, based on some benchmark result, by having one database storing one data type, it's already way faster than what the execution layer can do. It's unlikely to become the bottleneck in the foreseeable future.

#### StateKv Db and StateMerkle Db Sharding

After split ledger databases, the state databases become the bottleneck. Luckily, the `CryptoHash(StateKey)` is already widely used in the codebase. It's a 256-bit hash which can be sharded perfectly by it's prefix, and it is perfectly aligned with existing SMT (Sparse Merkle Tree) and JMT (Jellyfish Merkle Tree, the on disk format of the SMT).

16 was chosen to be the number of shards, as it turns out to be the sweet spot for complexity and performance. Similar to what has been done in ledger db, progress tracker are introduced for the same reason. For each key S, the first 4 bits of CryptoHash(S) is used to decide which shard it goes. For example, if it starts with 0x2, it will go to shard 2, if it starts with 0xA, it will go to shard 10. With this approach, all the calculation for producing SMT and JMT nodes within one shard is independent from other shards, so they can easily be done in parallel. An extra step is added to calculate the top 4 levels of nodes for SMT, and the root node for JMT, as they don't belong to any single shard.

#### Async Secondary Indices in Node

The following secondary indices are moved to a separate database. Flags are introduced for each index to control whether the node wants to enable writing the index and serve the corresponding API(s).

- `EventByKey`, `EventByVersion`: This two indices are used to handle `/accounts/{address}/events/{event_handle}/{field_name}` and `/accounts/{address}/events/{creation_number}` APIs. Given Aptos is moving to adopt [Module Event](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-44.md), which is a completely different model, these APIs would not make sense anymore, and are considered as deprecated. The only reason they are kept for now is to query events under old event framework.
- `TransactionByAccount`: This index is used to handle `/accounts/{address}/transactions` API. It used sequence number under the hood to index all transactions sent by a user. The usage of this API is low as it only represents a small set of use cases, and may break in the future if a transaction without sequence number is allowed in the system. Given this API is not part of the core functionalities of a node, and people generally prefer to get this (and similar) information from an indexer, it is considered as deprecated, and only kept for backward compatibility purpose at best effort.
- `StateKeysIndex`: This index does NOT exist in non-sharding world. It is added to support `/accounts/{address}/modules` and `/accounts/{address}/resources`. Due to `account` is not a first-class concept in the node storage, these APIs are not a good fit on node, and considered as deprecated. Under the hood, in non-sharding world, it was implemented in a very hacky way to rely on the way StateKey is encoded (which uses the account address as the prefix). With sharding, those states may be stored across multiple shards. Having an index would help avoid read fanout and potential complex logic of handling pagination. This is a temporary solution to maintain backward compatibility.

#### Rekey the StateKv Db

Previously, it not feasible to key the states by the hash of StateKey, because of the hacky API implementation mentioned above depends on the DB encoding format. With the added index, the key of the StateKv table can be changed to CryptoHash(StateKey) now. This change will help improve the performance (details omitted here), and reduce the storage space usage.

#### Add Block Information

Each time when a block is passed to storage layer for commit, some basic information is extracted and stored by block_height, at the same time, a maping from block_start_version to block_height is generated and stored. Several APIs that were using events to find block information are going to switch to use the new data once they are available under new format.

### Migration Runbook

All the changes are designed in a way to NOT require every node in the network to switch the format at the same time. Instead, they are controlled by local node config, so each operator can perform the migration at different time.

It's not supported to have both new format and old format on a single node. Therefore, in order to migrate to the new format, node operators are required to perform a complete db wipeout, and then resync the data to construct the database in new format.

It's recommended to use fast-sync to bootstrap the node going forward, as it will try to sync the minimal data that is required for the node to operate. There are small set of operators who choose to store the whole historical data of the blockchain in their full node (a.k.a. Archival FullNode). It's recommended for them to seek for a different solution, because as the usage of blockchain increase, it would be infeasible to store the whole history on a single node due to the hardware limit. A distributed solution would be a better approach to serve this purpose.

To reduce the sync time, it's recommended to sync the data from a nearby node with good network connection. For operators that are running multiple nodes at the same place, it's preferable to sync one node from other nodes.

To reduce the node downtime, it's recommend to sync the data for a different node, the swap the node. For example, if an operator is running a validator node (VN) and a validator full node (VFN), to avoid the downtime of VN, they can choose to wipe the VFN and resync it first from VN, then swap the role of VN/VFN, then wipe and resync the new VFN (old VN) from the new VN (old VFN).

There has been a long time ask (especially from operators who run their node on some cloud platform which charges a very high fee for disk IOPS) around whether the database can be put on multiple disks. The Aptos team has implemented this with the new format change. See below on how to configure it.

Here is a list of flags (and examples) that might require attention during the migration.

- Flag to start the format migration
```
storage:
  rocksdb_configs:
    enable_storage_sharding: true
```
- Sync mode
    - Fast-sync (default)
    ```
    state_sync:
      state_sync_driver:
        bootstrapping_mode: DownloadLatestStates
        continuous_syncing_mode: ExecuteTransactionsOrApplyOutputs
    ```
    - Non fast-sync (for archival FN, not recommended)
    ```
    state_sync:
      state_sync_driver:
        bootstrapping_mode: ExecuteOrApplyFromGenesis
        continuous_syncing_mode: ExecuteTransactionsOrApplyOutputs
    ```
- Specify peer(s)
```
# Note: Replace the address with the upstream you want to use.
seeds:
  D717AF1761645FFACFE5A455FB021052AC0FEFBC1B97FC3681BA61423C043D23:
    addresses:
    - /dns4/pfn0.backup.cloud-a.mainnet.aptoslabs.com/tcp/6182/noise-ik/D717AF1761645FFACFE5A455FB021052AC0FEFBC1B97FC3681BA61423C043D23/handshake/0
    role: Upstream
```
- Put data on multiple folders/disks
```
storage:
  db_path_overrides:
    ledger_db_path: "/disk0/db"
    state_kv_db_path:
      metadata_path: "/disk0/db"
      shard_paths:
        - shards: "1-3,7"
          path: "/disk1/db"
        - shards: "11-12,15"
          path: "/disk2/db"
    state_merkle_db_path:
      metadata_path: "/disk0/db"
      shard_paths:
        - shards: "0-7"
          path: "/disk3/db"
        - shards: "8-15"
          path: "/disk4/db"
```

## Testing

Most of the changes were tested during Previewnet2. Node operators who participated in Previewnet2 had gone through the whole migration process. The expected performance improvement was achieved after majority of operators finished the migration process. More details can be found in this [post](https://aptoslabs.medium.com/previewnet-ensuring-scalability-and-reliability-of-the-aptos-network-48f0d210e8fe).

During the test in Previewnet2, there were several expected and unexpected backward incompatible issues identified. Those issues are carefully reviewed, discussed, and fixed later.

We’ve also run replay job on mainnet to replay the existing mainnet transactions with the new storage format, and got equivalent result as the old format.

## Risks and Drawbacks / Security Considerations

This proposal requires node operators to wipe out the database and reconstruct the databases in the new format. There is a risk that the network might temporarily run with reduced participants during the migration process. Thus, node operators need to be carefully coordinated in order to maintain the health of the network.

See the migration runbook above about the details of how to minimize the impact.

## Future Potential

The APIs that are supported by internal indexer can be supported by an external indexer service instead.

The whole storage layer can be treat as a distributed service and running on multiple machines if needed.

## Timeline

### Suggested implementation timeline

Most of the implementation was done before Previewnet2. The rest of them will be included in release 1.18.

### Suggested developer platform support timeline

There is no additional work needed for SDK, API or CLI.

Indexer will start support functionalities provided by APIs that are powered by the async indices. There is no clear timeline on that.

### Suggested deployment timeline

The changes will be tested as part of the release process of 1.18 by Aptos team. After testing in devnet & testnet, the node operators will be coordinated to perform the migration process on mainnet.

