---
aip: 37
title: Filter duplicate transactions within a block
author: bchocho
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard Core
created: 06/06/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-37 - Filter duplicate transactions within a block

## Motivation

With Quorum Store (see AIP-26), a block proposal may include duplicate transactions due to Quorum Store batches being opaque. (Duplicate transactions are also possible with byzantine proposers within quorum store.) Duplicate transactions cannot affect correctness of execution, i.e., the first version will always succeed and duplicates will be discarded. However, there is concern that duplicate transactions could affect the performance of parallel execution of blocks because they could induce conflicts. We propose filtering the duplicates before blocks are executed in the VM.

## Specification

We introduce a `TransactionDeduper` trait that exposes a `dedup` method and an implementation of this trait , `TxnHashAndAuthenticatorDeduper` as specified below:

Duplicate filtering is done using the pair (raw_txn.hash(), authenticator). Both the hash and signature are required because dedup happens before signatures are verified and transaction prologue is checked. (So, e.g., a bad transaction could contain a txn and signature that are unrelated.) If the checks are done beforehand only one of the txn hash or signature would be required.

The implementation is written to avoid and/or parallelize the most expensive operations. Below are the steps:

1. Mark possible duplicates (sequential): Using a helper HashMap, mark transactions with 2+ (sender, seq_no) pairs as possible duplicates. If no possible duplicates, return the original transactions.
2. Calculate txn hashes (parallel): For all possible duplicates, calculate the txn hash. This is an expensive operation.
3. Filter duplicates (sequential): Using a helper HashSet with the txn hashes calculated above and signatures, filter actual duplicate transactions.

## Reference Implementation

The implementation has landed in main: [PR](https://github.com/aptos-labs/aptos-core/pull/8367). It is behind an onchain config flag which should be turned on to deploy the change.

## Risks and Drawbacks

- Performance: Our testing shows ~2ms of overhead per second without duplicates, and ~10ms of overhead per second with significant (100s) of duplicates. While today this is acceptable, we may need to revisit it as our blockchain execution improves. (See below for possible optimizations.)
- Possible changes in behavior: Dedup is not expected to change behavior of block execution. However, as a precaution the behavior is behind an onchain config, so all (non-byzantine) validators will apply the same algorithm.

## Future potential

We can make upgrades to the current filtering specification by creating a new implementation of the trait. Some possible future optimizations:

1. Note the possible duplicates in Step 1 are independent of each other, so they could be grouped independently and run in parallel in Step 3.
2. Txn hashes are calculated at many places within a validator. A per-txn hash cache could speed up dedup or later operations.
3. If signature verification is moved to before dedup, then only the signature has to be matched for duplicates and not the hash.

## Suggested deployment timeline
Milestone 1 (planned): Cut into release v1.6
Milestone 2 (planned): Onchain config change in devnet
Milestone 3 (planned): Onchain config change in testnet
Milestone 4 (planned): Onchain config change in mainnet via governance proposal
