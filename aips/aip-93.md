---
aip: 93
title: Consensus Observer
author: Josh Lind (https://github.com/JoshLind) & Zekun Li (https://github.com/zekun000)
discussions-to (*optional):
Status: Draft
last-call-end-date (*optional):
type: Core
created: 07/19/2024
---
# AIP-93 Consensus Observer

## Summary

Aptos nodes currently use [state synchronization](https://medium.com/aptoslabs/the-evolution-of-state-sync-the-path-to-100k-transactions-per-second-with-sub-second-latency-at-52e25a2c6f10)
(state sync) to stay-up-to-date with the blockchain. When validators execute a new block of transactions, state sync
will synchronize the block data to validator fullnodes (VFNs) and public fullnodes (PFNs), ensuring all nodes have the
latest blockchain state. However, state sync is not optimal for high-load, low-latency environments. This is because it
waits for block data to be processed locally (e.g., executed and committed) before disseminating that data to other
nodes in the network. This increases the synchronization time across nodes and negatively impacts the user experience.

To address this, we propose a new synchronization mechanism called Consensus Observer (CO). CO allows Aptos nodes to
disseminate block data without having to wait for local processing. For example, when validators first propose and
order a block, CO will immediately share that block with the fullnodes (i.e., VFNs and PFNs). This allows the
fullnodes to begin processing the block in parallel with the validators, without having to wait for validator
execution or commit. This avoids the unnecessary wait times imposed by state sync, and significantly reduces
end-to-end transaction latencies at high-load.

## High Level Approach

CO works by allowing Aptos fullnodes to observe and track the block processing pipeline on the validator nodes (i.e.,
block ordering, block execution and block commit). By tracking this pipeline, fullnodes can access and process block
data almost immediately after it is produced by the validators. This is much more optimal than state sync, which
requires blocks to pass through the entire validator processing pipeline before sharing the block data with the
fullnodes.

At a high-level, CO works as follows:
1. First, when a block is proposed and ordered by the consensus mechanism in the validators, it is immediately shared
   with the fullnodes, i.e., the ordered block is sent by the validators to the VFNs, and then by the VFNs to the PFNs.
2. Next, the validators and the fullnodes both process the block locally, in parallel. For example, they verify the
   block, execute the transactions in the block, and update their local state accordingly.
3. Finally, when the block is committed by the validators, the commit confirmation is shared with the fullnodes (in
   the same way the ordered block was shared in step 1). The fullnodes then verify the commit confirmation and commit
   the same data locally. This ensures that all nodes are synchronized, with the same blockchain state.
4. The process then repeats for the next block, as in step 1.

### Latency Improvements

Considering the high-level approach of CO (outlined above), we can make two observations about the latency benefits
over state sync:
1. First, CO allows VFNs to process blocks without waiting for the validators to execute and commit the blocks. Given
   that block execution and commit can take up to `~1 second` (under extreme load), this can significantly
   reduce the time it takes for VFNs to process blocks.
2. Second, by allowing PFNs to process blocks without waiting for VFNs to execute and commit the block, CO can
   similarly reduce PFN synchronization time. Moreover, the latency benefits for VFNs extend to the PFNs, i.e.,
   PFNs must wait for both validators and VFNs to process blocks under state sync, so any VFN latency improvements
   also benefits the PFNs.

### State Sync Fallback

It is worth noting that CO is not sufficient to replace state sync entirely. This is because CO assumes nodes are
up-to-date and processing the latest blocks in real-time. However, if a validator or fullnode goes offline, or falls
behind, it will need to catch up before it can continue processing new blocks. As a result, state sync will still be
used as a fallback mechanism in Aptos.

## Specification and Implementation

To implement CO, we propose reusing the existing block processing pipeline in Aptos, and adding two new components
to Aptos nodes, the `Consensus Publisher` and the `Consensus Observer`:
1. **Consensus Publisher**: The consensus publisher will be responsible for publishing new block data and events to
   the observers via network messages. For example, a publisher will run on each validator node and send
   messages to VFN observers whenever a block event occurs (e.g., a block is ordered, or a block is committed). Network
   messages will include enough information for the observers to verify and process each new block, including the
   raw block data, ordered block proofs, and commit proofs.
2. **Consensus Observer**: The consensus observer will be responsible for receiving and processing the block data
   and events published by the consensus publisher. For example, the observer running on each VFN will process the
   block messages it receives from the publishers running on the validators. This includes verifying the
   block data and proofs, processing the blocks in the block execution pipeline, and updating the local state
   accordingly.

It is worth noting that all Aptos validators will deploy consensus publishers, and all fullnodes (i.e., VFNs and PFNs)
will deploy both publishers and observers. This ensures that all fullnodes across the network will be able to
synchronize via CO.

### Network Messages

CO will require a new set of network messages to facilitate efficient communication between consensus publishers
and observers. At a high-level, these messages will comprise:
1. **Ordered Block**: These messages will contain the ordered block data (e.g., epoch, round number,
   block hash, etc.) and proofs (e.g., quorum signatures) over the ordered block. This will allow observers to verify
   the block has been proposed and ordered by the validators and that it should be processed locally.
2. **Block Payload**: These messages will contain the raw block data (e.g., transactions) for each new 
   ordered block. Given that validators operate quorum store, this is necessary as ordered block messages will only
   contain quorum store batch identifiers and not the raw transactions themselves.
3. **Committed Block**: These messages will contain the committed block data and proofs (e.g., quorum
   signatures) over the committed block and results. This will allow observers to verify the block has been
   committed by the validators and that it should be committed locally.

Note: this list is not exhaustive and additional messages may be required.

### Subscription Model

To ensure that observers receive all block data and events, we propose adopting a subscription model for CO. When a new
observer is started, it will subscribe to a specific set of consensus publishers on the network. These publishers will
then be responsible for sending block data and events to the observer, until such a time as the subscription is
terminated (e.g., the observer goes offline, or explicitly unsubscribes).

Adopting a subscription model will help to avoid unnecessary network traffic between nodes, as publishers will only
send block data and events to observers that are actively subscribed. Moreover, it will allow observers to make
intelligent decisions about which publishers to subscribe to, based on factors such as network topology, geographic
location, latency, trustworthiness, and reliability. Finally, to further improve the reliability of CO, observers may
subscribe to multiple publishers. This will ensure that observers can continue to receive block data and events, even if
some publishers go offline or network messages are lost in transit.

## Reference Implementation

A reference implementation of CO can be found in the
[aptos-core repository](https://github.com/aptos-labs/aptos-core/tree/main/consensus/src/consensus_observer).

## Testing

Given the broad nature of this change, it is necessary to conduct extensive testing across all layers of the software
stack. This includes: (i) individual unit tests for new components; (ii) integration tests for the consensus publisher
and observer; (iii) end-to-end tests for network synchronization (e.g., via the existing smoke test infrastructure);
(iv) performance tests to measure and verify the latency improvements of CO (e.g., via the existing performance test
infrastructure in `forge`); and finally (v) pre-production tests in our `devnet` and `testnet` environments, before
`mainnet` deployment.

It is also particularly important to ensure that sufficient testing takes place for failure scenarios and edge cases.
For example, node restarts, node failures, data wipes, invalid or malicious network messages, failures during 
block execution and proof processing, etc. This will help to ensure CO is reliable enough to withstand real-world
conditions.

### Preliminary Performance Results

Preliminary testing has already been conducted in several test environments, including `forge`. In these experiments,
the performance of CO was measured and compared against state sync. The results of the experiments showed significant
improvements in end-to-end transaction latencies for VFNs and PFNs. For example:
1. In a semi-realistic, high-load scenario, CO reduced end-to-end transaction latencies for VFNs by `~30%`
   (from `~2.1s` to `~1.5s`) at `~10k TPS`.
2. In a medium-load scenario with extreme network chaos, CO reduced end-to-end transaction latencies for PFNs by
   `~50%` (from `~3.1s` to `~1.6s`) at `~5k TPS`.

## Risks and Drawbacks

There are several risks and drawbacks associated with CO, including:
1. **Transaction Re-execution**: One of the benefits of state sync is that it provides an
   [intelligent syncing](https://aptos.dev/en/network/nodes/configure/state-sync#intelligent-syncing)
   mode, where fullnodes can skip transaction re-execution and reuse the execution results from validators.
   This helps to reduce CPU usage and improve synchronization time. However, CO does not
   provide this as it requires fullnodes to re-execute blocks in real-time. As a result, it requires all fullnodes
   to have equivalent (or better) hardware resources than validators, to ensure they can process blocks at the
   same rates while dealing with other overheads (e.g., REST API requests).
      - **Mitigation**: While this is a drawback, it does not pose a significant risk, as fullnodes are already
      required to deploy equivalent hardware resources as validators. Moreover, the benefits of CO in terms of
      reduced latencies are more than sufficient to outweigh the additional costs of transaction re-execution.
      Finally, it is worth noting that operators can choose to opt-out of CO and continue using state sync, if they
      prefer.
2. **CO Complexity**: CO will introduce additional complexity to the Aptos node software, as new components
   and network messages will be required. For fullnodes in particular, synchronization complexity will increase as
   two components will now be responsible for keeping the node up-to-date (CO and state sync), instead of just one
   (state sync).
      - **Mitigation**: While this is a drawback, it is not a significant risk. A thoughtful and well-designed
      implementation of CO will help to mitigate this complexity. Moreover, several existing components in the
      state sync and block processing stacks can be reused for CO, reducing the amount of new code that needs
      to be introduced.


## Security Considerations

There are several security considerations to take into account for CO, including:
1. **Network Security**: CO will introduce new network messages and communication flows between nodes. This
   increases the attack surface of the nodes, as adversaries may send invalid or malicious messages in an attempt
   to cause nodes to stop processing blocks, crash, run out of memory, synchronize invalid data, etc. As such, it
   is important to ensure that all network facing components are hardened and secure.
      - **Mitigation**: To mitigate this risk, CO will adopt the same approach taken by existing Aptos applications
      and services, including: (i) limiting the size and rate of incoming messages; (ii) treating all incoming
      messages as untrusted and validating them before processing; (iii) reusing the existing Aptos network stack,
      which encrypts and authenticates all network traffic between nodes; and (iv) monitoring all network traffic
      for anomalies and potential attacks.
2. **Block Data Integrity**: CO will require fullnodes to process blocks in real-time, without waiting for
   validators to execute and commit the blocks. This increases the risk of block data integrity issues, as fullnodes
   will not have access to the execution results of the validators before processing. As a result, fullnodes must
   verify the authenticity and integrity of the block data before processing it locally. Failure to do this will
   result in fullnodes processing invalid blocks, and potentially serving invalid data to clients.
     - **Mitigation**: To mitigate this risk, CO will require fullnodes to perform extensive verification of all
     block data and events received from the consensus publishers. This includes: (i) verifying
     blocks are well-formed; (ii) verifying blocks are chained correctly; (iii) verifying transactions in the blocks
     are valid; and (iv) verifying the quorum signatures over the block data. Particular attention will be given to
     verifying quorum signatures and proofs, and CO will be hardened to ensure that any divergence in block data
     between validators and fullnodes is detected and flagged.

## Timeline

CO is planned to be rolled out gradually to all nodes in the Aptos `mainnet`. The tentative timeline for this rollout
is as follows:
1. **Validators and VFNs**: Enabling CO for validators and VFNs in `mainnet` is currently targeting the `v1.18` Aptos
   node binary release. However, this may be subject to change based on the results of ongoing testing.
2. **PFNs**: Enabling CO for PFNs in `mainnet` will be done in a subsequent release, currently targeting `v1.19`. This
   will allow CO in validators and VFNs to stabilize before PFNs are upgraded.