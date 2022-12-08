---
aip: 1
title: Proposer selection improvements
author: igor-aptos
discussions-to: https://github.com/aptos-foundation/AIPs/issues/9
Status: Review
last-call-end-date (*optional):
type: Standard (Core)
created: 12/7/2022
---

## Summary

This change brings two simple improvements to proposer selection:

- it changes so that we look at more recent voting history, making system react faster
- it makes proposer selection much less predictable, reducing attack surface by malicious actors

## Background

In Aptos Blockchain, progress is organized into rounds. In each round, new block is proposed and voted on. There is a special role of proposer, deterministically decided for each round, that is responsible for collecting votes from the previous round and proposing a new block for current round. Goals of proposer selection (a decision on which node should be a proposer in a round) are:

- be fair to all nodes - both so that all nodes are asked to do their fair share of work, as well as so they can get their fair share of rewards (in combination with staking rewards logic). Fair share means it should be proportional to their stake.
- prefer nodes that are operating correctly, as round failures increase commit latency and reduce throughput

Current proposer selection is done via ProposerAndVoter LeaderReputation algorithm. It looks at the past history, in one window for proposer history, and a smaller window for voting history. Then reputation_weight is chosen for each node:

- if proposer round failure rate within the proposer window is strictly above threshold, use failed_weight (currently 1)
- otherwise, if node had no proposal rounds and no successful votes, use inactive_weight (currently 10).
- otherwise, use the default active_weight (currently 1000).

And then, reputation_weight is scaled by staked_amount, and next proposer is pseudo-randomly selected, given those weights.

Window sizes are chosen such that they are large enough to have enough signal to be reasonably stable, and not too large - to be able to adapt to changes quicker. For every block, we get proposer signal only for a single node, but voting single for two-thirds of the nodes. That means that proposer window needs to be larger, while we can keep voting window shorter.

## Motivation and Specification

This proposal is to upgrade ProposerAndVoter into ProposerAndVoterV2 selection algorithm. New proposer selection algorithm makes two changes to the logic:

- voter history window.
    - For looking at historical node performance, we look at proposals within `(round - 10*num_validators - 20, round - 20)` window. For voters we are looking at `(round - 10*num_validators - 20, round - 9*num_validators - 20)`. We ignore last 20 rounds, because history is looked at committed information, and consensus and commit is decoupled, and there can be a few rounds delay between each. Beyond that, voters window is unnecessarily stale. With the new change, we will be looking at `(round - num_validators - 20, round - 20)` range for voters.
    - ![Untitled Diagram drawio(1)](https://user-images.githubusercontent.com/110557261/205395422-1d8dd26c-0367-4299-ac88-4c3eac39f6c3.png)
    - Main effect of this change will be, that nodes that are joining validator set or were offline/lagging for a while and just caught up, will have a significantly shorter delay before being treated as active and being selected as proposer.
- seed for pseudo-random selection
    - Currently seed used for pseudo-random selection is tuple (epoch, round). This makes every round be an independent random choice, but makes it predictable. That means that it is relatively easy to figure out who are going to be selected proposers for the future rounds, and this gives malicious actors easier ways to attack/exploit the network. There are various known ways that predictable leader election simplifies the attacks - Denial-of-service can be more easily achieved by only attacking the leaders, potential front-running of transactions is easier if leader is known in advance, etc. With the new change, seed is going to be changed to (root_hash, epoch, round), making it much less predictable.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/4253
https://github.com/aptos-labs/aptos-core/pull/4973

## Risks and Drawbacks

## Future Potential

## Suggested implementation timeline

Above PRs have been committed, and are being tested, and prepared to be released to the mainnet. 
To enable the change above, additional governance proposal for consensus onchain config needs to be executed. E2E smoke test has been landed as well, to confirm governance proposal can be executed smoothly.

It is running on devnet for more than a week, though devnet has limit and only AptosLabs run validators, so change is not stress-tested.
We will test it out on testnet in a week or two. 
If no further changes are needed, proposal is planned to be created, and sent for voting, by the end of December.
