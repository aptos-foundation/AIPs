---
aip: 89
title: Consensus Latency Reduction using Order Votes
author: Satya Vusirikala, Daniel Xiang, Zekun Li
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/451
Status: Draft
last-call-end-date (*optional): 06/25/2024
type: Core
created: 06/13/2024
---
# AIP-89 Consensus Latency Reduction using Order Votes

## Summary

We define the consensus latency to be the time taken for validators to order a block proposal under the common case. This AIP proposes a solution to reduce the consensus latency from 4 hops to 3 hops by introducing a novel protocol change that involves a new type of votes called “order votes”. We note that 3 hops is the theoretically optimal limit on a BFT based consensus protocol (see Section *Optimal Consensus Latency*).

## High Level Approach

We define the consensus latency to be the time taken for a proposed block to be ordered under the common case (where network is synchronous and the leader is non-faulty). In Jolteon consensus protocol, we consider a block is ordered when we obtain a 2-chain quorum certificate on the block. At the moment, Jolteon consensus protocol takes 4 hops of latency. In a nutshell, we are implementing the PBFT-style [1] ordering mechanism for the latency optimization. This is the timeline of the current consensus protocol for proposing and ordering a block `r`. 

- `Time t`:  The leader of block `r` creates and broadcasts the block `r`.

- `Time t+1`: All the other validators receive the block `r` and broadcasts a vote on `r`.

- `Time t+2`: All the validators create a quorum certificate on the block `r` by aggregating the received votes. The next leader creates and broadcasts the block `r+1` . The block `r+1` includes the quorum certificate on the block `r` .  

- `Time t+3`: All the validators receive the block `r+1` and broadcasts a vote on `r+1` . 

- `Time t+4`: All the validators create a quorum certificate on the block `r+1` by aggregating the received votes. The validators now obtained a 2-chain quorum certificate on the block `r`. The validators now consider the block `r` as “ordered” and passes the block to the execution pipeline.

This AIP aims to reduce the consensus latency from 4 hops to 3 hops. We start with the observation that the QC (Quorum Certificate) on the block `r+1` serves a dual purpose.

- The validators certify the block `r+1`.

- The validators create a 2-chain QC for the block `r` and order the block `r`.

All the validators have the QC on the block `r` at time `t+2`, but the validators effectively vote on this QC when they vote on the block `r+1` at time `t+3`. We aim to optimize the latency by letting the validators vote on the “QC of block `r`" at time `t+2` without waiting to receive block `r+1`. We call these new type of votes as the “order votes”. The new timeline for ordering a block `r` looks as follows.

- `Time t`:  The leader of block `r` creates and broadcasts the block `r`.

- `Time t+1`: All the other validators receive the block `r` and broadcasts a vote on `r`.

- `Time t+2`: All the validators create a quorum certificate on the block `r` by aggregating the received votes. All the validators broadcasts on “order vote” on the created quorum certificate on the block `r`. The next leader creates and broadcasts the block `r+1` . The block `r+1` includes the quorum certificate on the block `r`.

- `Time t+3`: All the validators receive the order votes and creates a quorum certificate on the order votes. The validators now obtained a 2-chain quorum certificate on the block `r`. The validators now consider the block `r` as “ordered” and passes the block to the execution pipeline. All the validators receive the block `r+1` and broadcasts a vote on `r+1`.

## Specification

The structure of the order vote to order the block `r` contains the following fields.

- The identity of the voter.
- The ledger info of block `r`. The ledger info consists of the block info of block `r`, along with a consensus data hash which is set to a dummy value (zero).
- The signature on the above ledger info.

```
pub struct OrderVote {
    /// The identity of the voter.
    author: Author,
    /// LedgerInfo of a block that is going to be ordered in case this vote gathers QC.
    ledger_info: LedgerInfo,
    /// Signature of the LedgerInfo
    signature: bls12381::Signature,
}
```

In most cases, a validator first receives the quorum certificate on the block `r` before receiving order votes on the block. But when a validator’s network connection is faulty, the validator could potentially fail to receive the quorum certificate on block `r` but receive the order votes on the block `r`. In this case, without having the quorum certificate on block `r`, even if the validator receives enough order votes on block `r`, the validator will still have to wait for block `r+1` to execute the block `r`. To simplify this, the validators additionally append the quorum certificate on block `r` when broadcasting the order vote.

```
pub struct OrderVoteMsg {
	order_vote: OrderVote
    // The quorum certificate on the block that is going to be ordered
	quorum_cert: QuorumCert
}
```

When a validator obtains the QC on a block `r`, the validator uses the following algorithm to create the corresponding order vote.

```
Procedure process_vote {
	// same as before
	...
	if a QC is aggregated {
		order_vote <- make_order_vote(QC)
		order_vote_msg <- OrderVoteMsg {order_vote, QC}
		broadcast order_vote_msg
	}
}

Procedure make_order_vote(qc) {
	// Safety need to update the highest qc here
	observe_qc(qc)
	if safe_to_order_vote(qc) {
		ledger_info <- LedgerInfo { qc.vote_data.proposed, HashValue::dummy() }
		signature <- sign(ledger_info)
		order_vote <- OrderVote { self.author, ledger_info, signature }
		return order_vote
	}
	return none
}

Procedure make_timeout(round, high_qc, last_tc) {
	...
	if valid_signature && safe_to_timeout {
		increase_highest_vote_round(round)
		increase_highest_timeout_round(round)
		return TimeoutInfo
	}
	...
}

Procedure safe_to_order_vote(qc) {
	// no order vote for this round if already timeout
	return qc.vote_data.round > highest_timeout_round
}

Procedure increase_highest_timeout_round(round) {
	highest_timeout_round <- max(highest_timeout_round, round)
}
```

When a validator receives an order vote, it uses the following algorithm to verify and process the order vote.

```
Procedure process_order_vote_msg(order_vote_msg) {
	// the signature of order_vote should already be verified upon receiving
	commit_id <- order_vote_msg.order_vote.ledger_info.id
	pending_order_votes[commit_id].add(order_vote.signature)
	if |pending_order_votes[commit_id]| >= 2f+1 {
	    // Add order_vote_msg.qc to the block store, if not already present
		// Send the block with commit_id to execution
		// Update highest_ordered_cert
		finalize(order_vote.ledger_info)
	}
}
```

### Changes to certificate structure

The order certificate and commit certificate were both of the type `QuorumCert` which contains VoteData of the block being certified, and the LedgerInfo of the block being ordered/committed. This means, the order certificate to order the block `r` would contain VoteData of block `r+1` and LedgerInfo of block `r`. With our new protocol, when a validator creates an order certificate by aggregating enough order votes on the block `r`, the validator may not have access to the block `r+1`. As the commit certificate is derived from the order certificate, we face the same issue in creating the commit certificate to commit the block `r`. 

We observe that the VoteData in the order and commit certificates for the correctness, safety and liveness of the protocol. So, we let the validators use dummy vote data when creating order certificate. But when a validator receives a `QuorumCert` with dummy vote data, the message will fail verification. To ensure backward compatibility, we let order and commit certs be of new struct type called `WrappedLedgerInfo`. This struct has the same fields as the `QuorumCert`. However, the verify function of `WrappedLedgerInfo` doesn’t verify the VoteData field.

## Impact

This feature will reduce the end-to-end latency of Aptos by 100ms (1 hop).

As each validator need to broadcast the order vote to all the validators, the communication complexity of the protocol increases.

Each validator need to verify the order votes from all the other validators, increasing the computational complexity.

For each consensus block, 130 mainnet validators sign and validate an order vote message. Assuming 5 blocks per second, each validator will sign 5 order votes per second, will receive and verify 650 order votes per second. Earlier, each validator broadcasts a proposal vote for each block. With the introduction of order votes, the number of consensus messages roughly doubles. The verification of an order vote message takes about 2.3 ms. As the regular proposal votes and order votes are verified in parallel, it increases the number of cores used for processing consensus messages. With 130 nodes, each order vote message is 1408 bytes long in-memory, and 699 bytes on the network. The order votes feature will thereby increase the network bandwidth by 445 KB/second.

In a load test with 100 nodes at 5k TPS workload, the average total number of inbound network messages increased from 2165 to 2625 messages per second with order votes. The average total inbound traffic increased 1.31 MB/s to 1.54 MB/s. The average total number of outbound network messages increased from  to 2590 to 3080 messages per second. The average CPU usage increased from 1450% to 1640%. There is no visible change in the memory usage. The average I/O rate increased from 345 IO ops/sec to 375 IO ops/sec. The average end-to-end latency reduced from 1.5 seconds to 1.4 seconds.

## Release Plan

As we introduce a new type of consensus message, this change is not backward compatible due to 2 reasons.

- If an upgraded validator broadcasts an “order vote” message, a non-upgraded validator will not know how to process this message and will fail. To avoid this, we will follow a 2-step release plan.
- If an upgraded validator broadcasts an order certificate or commit certificate with dummy VoteData, a non-upgraded validator will not be able to ver

In v1.14, we released the necessary code for the validators to send and receive the order votes. But this code is behind a new `order_vote_enabled` flag added to the onchain consensus config. After all the validators are upgraded with this binary, when this AIP is accepted, we enable the `order_vote_enabled` flag.

## Reference Implementation

- [PR](https://github.com/aptos-labs/aptos-core/pull/13023) for reference implementation of order votes.

## Optimal Consensus Latency

We formally define the problem of consensus and review the existing lower bound on the latency for achieving consensus. Our findings demonstrate that the proposed modifications result in a protocol that attains optimal consensus latency.

### Definitions

**System Model.** 

We consider a set of $n$ parties labeled $1,2,...,n$, where each party executes as a state machine. The parties communicate with each other by message passing, via pairwise connected communication channels that are authenticated and reliable. The network is assumed to be partially synchronous, where the network has unbounded message delay until a unknown global stabilization time, it becomes synchronous and has bounded message delay. We consider a static adversary that can corrupt up to $t$ parties before each run of the system. A corrupted party can behave arbitrarily, and a non-corrupted party behaves according to its state machine. We say a corrupted party is malicious, and a non-corrupted party is honest.

**Definition 1 (Consensus).** 

Given a system as defined above, the consensus exposes two interfaces to the parties, namely$Input(val)$ to input a value$val$$Output() \rightarrow val’$ to output a value.

Consensus is required to satisfy the following properties:

- Agreement. If any two honest parties output, they output the same value.
- Termination. Every honest party eventually outputs.

To exclude a trivial solution that always has the parties output a predetermined value, consensus typically specifies which output values are valid given the input values of all parties. In the context of the blockchain, the consensus needs to satisfy the following two validity requirements. 

- Weak Validity. If all parties are honest and input the same value $val$, then any honest party only outputs $val$.
- External Validity. If an honest party outputs $val'$, then $f(val')=1$ where $f(\cdot)$ is a globally verifiable predicate that output $1$ or $0$.

In blockchain consensus, the honest party always inputs $val$ such that $f(val)=1$.

We define consensus latency as follows. A more rigorous definition can be found in [2].

An initial configuration includes the set of corrupted parties and the input values of the honest ones.

**Definition 2 (Consensus Latency).**

A consensus protocol has a consensus latency of X message delays if, for every initial configuration and adversary strategies, there exists an execution where every honest party outputs no later than X message delays.

In the context of blockchain consensus, consensus latency refers to the time required for validators to agree on a block under the common case. For example, after this AIP, the Aptos consensus protocol achieves a consensus latency of three message delays. This involves one round of block proposal by the leader followed by two rounds of all-to-all voting among the validators to order the block, assuming the leader is honest and the network is synchronous.

### Lower Bound Results

Kuznetsov et al. (Theorem 4.5, [2]) proves any protocol that solves consensus defined above that satisfies Weak Validity must have a consensus latency of 3 message delays, under $n\leq 5f-2$. 

This implies under the optimal fault tolerance $n=3f+1$ for partial synchrony, any protocol that solves blockchain consensus must have a consensus latency of at least 3 message delays. 

Therefore, after the modification proposed in this AIP, the Aptos consensus protocol is optimal in terms of consensus latency. 

## Reference

[1] Miguel Castro, and Barbara Liskov. "Practical byzantine fault tolerance." In OSDI, vol. 99, no. 1999, pp. 173-186. 1999.

[2] Petr Kuznetsov, Andrei Tonkikh, and Yan X. Zhang. "Revisiting optimal resilience of fast byzantine consensus." In Proceedings of the 2021 ACM Symposium on Principles of Distributed Computing, pp. 343-353. 2021.
