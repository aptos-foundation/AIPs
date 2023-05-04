---
aip: 29
title: Peer monitoring service
author: joshlind
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/118
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Blockchain core
created: 5/3/2023
updated (*optional): 5/3/2023
---

# AIP-29 - Peer monitoring service

## Summary

This AIP proposes a new “Peer Monitoring” service that operates on Aptos nodes and allows nodes to track, share and monitor peer information and behaviors. The service aims to: (i) improve node latency and performance, by allowing components to make smarter decisions when disseminating and receiving data; (ii) improve operational quality and reliability, by allowing nodes to dynamically work around failures and unstable peers; (iii) improve peer discovery and selection, by providing a foundation for peer bootstrapping and gossip; (iv) improve security, by allowing nodes to better detect and react to malicious peers and bad behaviors; and (v) improve network observability, by gathering and exporting important network information.

## Motivation

The Aptos blockchain consists of a decentralized peer-to-peer network of nodes (e.g., validators and fullnodes). Peers in the network work together to disseminate information and replicate state, e.g., new transactions are distributed to other peers via mempool, and new blockchain states are shared via state sync. As a result, the performance and operational quality of a node is directly tied to the quality and stability of its peers. Aptos nodes that have slow, unstable or misbehaving peers, will struggle to offer a good quality of service.

To overcome this, it is necessary to track and monitor peer behaviors and metadata, to allow components to make intelligent decisions at runtime and react appropriately to protocol deviations. For example, when a node requires large amounts of data for state sync, it should prioritize peers that have the smallest network latency and highest throughput when sending data requests (to improve performance). Similarly, when a user submits a transaction to a node, the node should forward the transaction to the validator set via the shortest path (to reduce latency).

To achieve this, we propose a new peer monitoring service that runs on all nodes and continuously gathers important information about the peers and network context in which the node is operating. This information (termed, “peer metadata”) can be utilized by various components within a node to make smarter decisions, better tolerate failures, respond to malicious peer behaviors and improve network visibility.

## Peer Monitoring Metadata

At a high-level, the metadata gathered by the peer monitoring service can be divided into several different categories. We list the categories that will initially be targeted by this AIP, but note that additional categories may be supported in the future (if deemed useful):

1. **Peer and topology metadata**: This includes basic information about each peer and their role in the network topology, such as: (i) the raw network latencies between each peer; (ii) the peer’s depth from the validators; (iii) the peer’s node type and build information (e.g., git hash and version); and (iv) the peak and average throughput between each peer (as observed by existing traffic);
2. **Network and peer discovery metadata**: This includes information about discovered peers in the network and their properties, such as: (i) newly discovered peers that can be connected to by anyone; (ii) seed-style nodes that provide seeding services, e.g., bootstrapping services; (iii) archival nodes that contain large spans of blockchain data; and (iv) well provisioned nodes that offer high-availability and low-latency data access to others.
3. **System and component metadata**: This includes critical system and component information for each peer, such as: (i) resource and load information (e.g., how hard the node might be working and how much remaining capacity it has, such as CPU, RAM, bandwidth, network connections, etc.); (ii) storage-specific information, such as the latest synced version and epoch (to help components identify up-to-date peers); and (iii) network protocol and service information, such as the protocols and services supported by the peer and whether or not the peer can handle different service requests.

## Performance, Reliability and Security Improvements

By continuously tracking and monitoring peer metadata within each node, internal components can make more intelligent decisions at runtime, thus improving performance, reliability and security. For clarity, we list several immediate improvements that can be made using the metadata identified above. We note that this list is not complete.

1. **Latency and topology aware state syncing**: To improve the latency and throughput of state sync, the peer selection algorithm can be made more intelligent. For example, instead of using random selection, Aptos nodes can prioritize peers that are: (i) close (i.e., smallest ping time); (ii) located closest to the validator set (as they’ll be more likely to have the newest data); and (iii) have the least amount of load (to help reduce bottlenecks and improve load balancing).
2. **Storage and topology aware mempool**: To improve the latency and throughput of mempool, the transaction forwarding logic can also be made more intelligent. For example, transactions can be forwarded to peers: (i) via the shortest path to the validator set (to reduce transmission latency); (ii) with the most up-to-date storage (to help ensure the transaction won’t be incorrectly discarded by a lagging node); and (iii) with the least amount of on-going load (to help load balance).
3. **Intelligent peer discovery and selection**: To improve peer discovery and peer selection when connected to other nodes in the network, the networking stack can utilize the new metadata to make more intelligent decisions. For example, the networking stack: (i) no longer needs to rely on static peer information in the genesis blob (which may be out-of-date); and (ii) can connect to peers that are well-connected, closer to the validator set and running the latest version of the code, to help ensure good connectivity and performance.
4. **Faulty and malicious peer management**: With a dynamic peer discovery mechanism now in place, components within each node can automatically disconnect from faulty, malicious or unhelpful peers and notify the networking stack to search for better and more helpful peers. For example, state sync can notify the networking stack that: (i) some peers do not have the required data and thus should be replaced with new peers that have the appropriate data to satisfy the requests; and (ii) to disconnect from malicious or bad peers, and actively prevent reconnections for a period of time (to discourage bad behavior).

## Reference Implementation

A simple reference implementation exists in the `aptos-core` codebase today. Note: the implementation currently only tracks peer and topology information. It will be extended to handle other categories of information in the future:

- **Peer monitoring client**: [https://github.com/aptos-labs/aptos-core/tree/main/network/peer-monitoring-service/client](https://github.com/aptos-labs/aptos-core/tree/main/network/peer-monitoring-service/client)
- **Peer monitoring server**: [https://github.com/aptos-labs/aptos-core/tree/main/network/peer-monitoring-service/server](https://github.com/aptos-labs/aptos-core/tree/main/network/peer-monitoring-service/server)
- **Peer monitoring types**: [https://github.com/aptos-labs/aptos-core/tree/main/network/peer-monitoring-service/types](https://github.com/aptos-labs/aptos-core/tree/main/network/peer-monitoring-service/types)

## Future Potential

The peer monitoring service offers many future extensions and improvements. For example:

- **Additional metadata types**: The peer monitoring service could be extended to gather additional categories of node metadata, such as: (i) peer reputations and scoring, to help ensure that nodes actively seek out performant and healthy peers; and (ii) network tracing metadata, to help engineers and operators better observe and debug end-to-end behaviors.
- **Performance benchmarking**: The peer monitoring service could be extended to act as a benchmarking tool in our testing environments. For example, the service could be configured to send and receive messages across the network (with configurable message sizes and frequencies), to help benchmark and monitor the performance of the networking stack.
- **Implementation consolidation**: There are various implementation extensions to the monitoring service that could help clean up and consolidate the Aptos core code. For example: (i) the dedicated node health checker could be removed and replaced by the monitoring service; and (ii) the application interfaces between the networking stack and each component could be further standardized.

## Suggested implementation timeline

- (Complete) **Milestone 1**: Implement a basic monitoring client and server framework.
- (Complete) **Milestone 2**: Extend the framework to support peer and topology information.
- **Milestone 3**: Update the various applications (e.g., state sync and mempool) to make use of the peer and topology information and expose the information for debugging.
- **Milestone 4**: Extend the framework to support peer discovery and integrate this information directly into the network stack (e.g., during node connecting dialing and startup).
- **Milestone 5**: Extend the framework to support system and component information and integrate this metadata into the various applications.

## Suggested deployment timeline

- (In progress) **Deployment step 1**: Implement milestones 1, 2 and 3 and cut them into release v1.5.
- **Deployment step 2**: Implement and release milestone 4 (TBD).
- **Deployment step 3**: Implement and release milestone 5 (TBD).
