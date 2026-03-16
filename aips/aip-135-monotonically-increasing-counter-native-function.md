---
aip: 135
title: Monotonically Increasing Counter Native Function
author: vusirikala, igor-aptos
discussions-to (*optional): 
Status: Draft
last-call-end-date (*optional): 
type: Standard (Core)
created: 10/23/2025
updated (*optional): 
requires (*optional): 
---

# AIP-135 - Monotonically Increasing Counter Native Function

## Summary

This AIP proposes adding a native function to the Aptos framework that provides a globally monotonically increasing counter. Each call to the native function should output a 128 bit integer that satisfy the following properties:
1. Each call returns a strictly greater value than any previous call in blockchain history.
2. Values returned by the function call are globally unique across all calls in blockchain history.
3. The above properties should be satified even if the function is called multipled times within the same transaction.
4. Function calls to this native function shouldn't introduce any conflicts that affect parallel execution of the transactions. That is, two transactions invoking this native function can be run in parallel if they don't have any other conflicts.

We note that we only need the output of the function calls to be monotonically increasing. The function need not output consecutive integers.

## Motivation
For Decibel order book, we need to associate each order with a unique order id. One potential solution is to use the existing AUID (Aptos Unique Identifier). AUID uses the transaction hash to generate a 32 byte unique value. In order to save storage space, we intend to use a smaller 128 bit order id. The monotonically increasing counter native function helps us achieve the goal of generating globally unique 128 bit integers, which can be used as order ids in Decibel.

## High-level Overview
Our goal is to design the implementation of this native function.
```move
module aptos_framework::transaction_context {
    /// @return A u128 value that is guaranteed to be greater than any previously returned value
    ///         across all transactions in the blockchain.
    native public fun get_monotonic_counter(): u128;
}
```

### Our Solution
The native function outputs the following value.
```
    reserved_byte || timestamp || transaction_index || session_index || local_counter
```
- The reserved_byte is 8 bits. It is set to 0. 
- The timestamp is 64 bits. It is the timestamp in microseconds. The timestamp is updated once in every block. The blocks in Aptos are assured to have increasing timestamps.
- The transaction_index is 32 bits. It represents the index of the transaction inside the block.
- The session_index is 8 bits. During the execution of the transactions, we use multiple sessions for prologue, epilogue, etc. We index the sessions inside the transaction.
- The local_counter is 16 bits. It is a local counter maintained inside the transaction context. It is initialized to 0 for each transaction session, and is incremented by 1 every time we call the native function.

The timestamp ensures that the calls to the native function outputs monotonically increasing values across blocks. The transaction_index ensures that the calls to the native function outputs monotonically increasing values across different transactions in a block. The sesion_index and local_counter ensures that the calls to the native function outputs monotonically increasing values across different invocations of the function within the same transaction.

### Alternative Solution 1
A naive implementation of this feature would store a `Counter` resource on-chain. Each call to this function would borrow the resource and increment the counter. Although simple, this is a sequential operation and there by not scalable.

### Alternative Solution 2
Instead of a storing an integer inside the `Counter` resource, we could alternatively store an aggregator. An aggregator is designed to support performing many add/sub operations in parallel. However, reading the aggregator is a sequential operation. As we need to read the monotonically increasing counter, even this approach is sequential, and there by not scalable.

### Alternative Solution 3
We use the transaction version as output. Each transaction on Aptos is associated with a version number. One can think of using this as the monotonically increasing counter. However, the tranaction is assigned a version after the transaction execution, and hence cannot be used within the transaction.

Our native implementation will offer significantly better performance and gas efficiency compared to these alternative implementations, while ensuring that counter values always increase across all transactions and are globally unique.

## Implementation details
We added transaction index and local counter inside the transaction context. The native function can utilize these values when computing the above output. During the normal block execution, the index of the transaction can be computed easily. In Aptos, transactions could be discarded if they fail basic validation checks in prologue phase. So, some transactions in the block may not make it to the final committed state. When a validator falls behind, the validator goes through state sync and performs chunk execution of all the non-discarded transaction. During the chunk execution, the validator is only aware the non-discarded list of transactions. Therefore, the index of the transactions in the original block is unknown to chunk executor. 

To solve this issue, we introduce the concept of `AuxiliaryInfo`. During the block preparation phase (right before executing the block), we attack auxiliary info for each transaction. At the moment, the auxiliary info consists of the index of transaction inside the block. We use this auxiliary info when creating the transaction context. After the transaction execution, we also store the auxiliary info for each transaction in the DB. During state sync, the fallen behind validator also obtains the auxiliary infos for the transactions. The chunk executor can use this auxiliary info when creating the transaction context.

## Impact
- We add a new DB table to store the auxiliary info for each transaction.
- We add the hash of the auxiliary info inside the `TransactionInfo`.
- We change the message format of state sync messages to include AuxiliaryInfo for each transaction.
- We introduce 3 feature flags:
    - We introudce a feature flag in state sync to enable the changes in the state sync message format.
    - We introduce on-chain execution config to add auxiliary info to each transaction.
    - We introudce an on-chain feature flag to enable the native function.
These flags need to be enabled in the above order.

## Reference Implementation

The reference implementation is available in the below PRs.
- Core code changes to add the native function: https://github.com/aptos-labs/aptos-core/pull/16927.
- Aptos debugger changes: https://github.com/aptos-labs/aptos-core/pull/17410.
- State sync changes:
    - https://github.com/aptos-labs/aptos-core/pull/17290
    - https://github.com/aptos-labs/aptos-core/pull/17263
    - https://github.com/aptos-labs/aptos-core/pull/17101
    - https://github.com/aptos-labs/aptos-core/pull/17056
    - https://github.com/aptos-labs/aptos-core/pull/16970
    - https://github.com/aptos-labs/aptos-core/pull/16943

The binary of the codebase is already deployed on mainnet.

## Risks and Drawbacks
- We need to make sure the feature flags are enabled in the right order appropriately to ensure backward compatibility.
