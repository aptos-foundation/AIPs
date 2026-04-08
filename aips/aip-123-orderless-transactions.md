---
aip: 123
title: Orderless transactions
author: Satya Vusirikala, Igor Kabiljo
Status: Draft
discussions-to: https://github.com/aptos-foundation/AIPs/issues/593
type: Standard (Core, Framework)
created: 04/25/2025
updated: 06/05/2025
requires: "AIP-129: Add extra information in transaction payload"
---

# AIP 123: Orderless Transactions

## Summary

This AIP introduces a new type of user transaction called Turbo Transaction. Until now, for a user to send transactions to the blockchain, the user need to create a `0x1::Account` resource with the some info on the blockchain. To reduce the account creation cost, stateless accounts (link) are introduced recently. These accounts do not have the `0x1::Account` resource. However, the Account resource stores an important information called sequence_number which is required for replay protection. So, if the account doesn’t have `0x1::Account` resource, we need to provide an alternate replay protection mechanism. This AIP introduces orderless transactions which will use nonces instead of sequence numbers for replay protection. 

## Motivation

Suppose Alice sends a transaction to the blockchain saying “Transfer 10 APT from Alice to Bob”. What if an attacker copies Alice’s transaction and sends it again to the blockchain? The blockchain should be smart enough to discard the replayed transaction.

Aptos supports replay protection as follows. Each account should have a `0x1::Account` resource stored on the blockchain. Amongst other info, `0x1::Account` resource has a `sequence_number: u64` and an account authenticator. Every time a transaction is committed, the sender account’s sequence number is incremented by 1. Each transaction also contains a `sequence_number` field. Only if transaction’s sequence number matches with the sender account’s onchain sequence number, the transaction is executed. This means, each transaction can be executed only once and can’t be replayed.

In order to create the `0x1::Account` resource, it costs 0.001 APT at the moment. So, that’s the base fee for a new user to use the blockchain. To reduce the cost, we wish to eliminate the need for user to create a `0x1::Account` resource to use the blockchain. This requires us to support an alternate replay protection mechanism that doesn’t use sequence numbers.

For this, we introduce orderless transactions. These transactions contain a `nonce` value (which could be picked randomly). The blockchain stores the list of (sender address, nonce) pairs of transactions committed in the last 60 seconds. When a transaction is submitted to the blockchain, the transaction is executed only if the (sender address, nonce) pair isn’t stored in the nonce table. We restrict the transaction expiration time to 60 seconds. So, the transaction can’t be replayed before its expiration time.

The transaction structure is updated to add the nonce to payload. The new transaction structure is described in AIP X (link). In this AIP, we describe the changes made in transaction validation to support orderless transactions.

## Specification

In Aptos, the transaction execution happens in 3 phases:

- Prologue
- Executing the payload
- Epilogue

Prologue contains the transaction validation checks:

- Checks that the sender’s onchain account sequence number matches with the sequence number inside the transaction. This check ensures replay protection — The blockchain won’t execute the same transaction twice.
- Checks that the authenticator used to sign the transaction matches with the authenticator stored inside the sender account’s `0x1::Account` resource.

If the transaction validation checks in prologue fail, the transaction is discarded and further phases are not executed.

Epilogue updates the account info such as charging gas, incrementing the sender account’s sequence number.

For orderless transactions, we make sure the prologue and epilogue can work without the sender having  `0x1::Account` resource.

- We add a new module called `nonce_validation.move` and a new resource called nonce history in aptos framework. The nonce history stores `(sender address, nonce, expiration time)` of transactions that are committed in the last 60 seconds. To validate a new orderless transaction, the prologue checks if there is an entry in the nonce history with the same `(sender address, nonce)`.
    - If there is duplicate entry (even with a different expiration time), the transaction is discarded with `NONCE_ALREADY_USED` status code.
    - If there is no duplicate entry in nonce history, the (sender address, nonce, expiration time) of the current transaction is added to nonce history.
- The prologue also checks that the transaction’s sender has authenticated the transaction. The authentication proof derived from the transaction is `Hash(sender public key || authentication scheme)`. The prologue checks that this authentication proof matches with the authentication key inside the `0x1::Account` resource of the sender. However, we can still make this check work without the account having `0x1::Account` resource. For a freshly created account, its address is equals `Hash(sender public key || Ed25519)` and the authenticator key of `0x1::Account` resource is also initially initiated with this value. So, we can just check if the authentication proof inside the transaction is equal to the sender account address. Please note that this means when the sender is stateless (doesn’t have `0x1::Account` resource), it can only use Ed25519 scheme to authenticate transactions.

For orderless transactions, the epilogue will not increment the sequence number of the sender.

**Design requirements**: The nonce history is designed with the following criteria in mind:

- Can search for `(address, nonce)` pair and obtain its corresponding expiration time.
- Can insert `(address, nonce, expiration time)`.
- Unlimited storage so that an attacker can’t DDoS the nonce history. Technically, it’s still limited by the disk space, etc.
- Minimize the storage cost for the user.
- Removing old nonces (garbage collection) could be done efficiently.

This is our current design.

```jsx
module aptos_framework::nonce_validation {    
    const NUM_BUCKETS: u64 = 50000;
    const MAX_EXPIRATION_TIME: u64 = 60;
   
    struct NonceHistory has key {
        // Key = sip_hash(NonceKey) % NUM_BUCKETS
        // Value = Bucket
        nonce_table: Table<u64, Bucket>,
        // Used to facilitate prefill the nonce_table with empty buckets
        // one by one using `add_nonce_bucket` method.
        // This is the next_key to prefill with an empty bucket
        next_key: u64,
    }

    // The bucket stores (address, nonce, txn expiration time) tuples.
    // All the entries in the bucket contain the same hash(address, nonce) % NUM_BUCKETS.
    // The first big ordered map in the bucket stores (expiration time, address, nonce) -> true.
    // The second big ordered map in the bucket stores (address, nonce) -> expiration time.
    // Both the maps store the same data, just in a different format.
    // As the key in the first big ordered map starts with expiration time, it's easy to figure out which
    // entries have expired at the current time. The first big ordered map helps with easy garbage collection.
    // The second big ordered map helps with checking if the given (address, nonce) pair exists in the bucket.
    struct Bucket has store {
        // The first big ordered map in the bucket stores (expiration time, address, nonce) -> true.
        nonces_ordered_by_exp_time: BigOrderedMap<NonceKeyWithExpTime, bool>,
        // The second big ordered map in the bucket stores (address, nonce) -> expiration time.
        nonce_to_exp_time_map: BigOrderedMap<NonceKey, u64>,
    }

    struct NonceKey has copy, drop, store {
        sender_address: address,
        nonce: u64,
    }
    
    struct NonceKeyWithExpTime has copy, drop, store {
        txn_expiration_time: u64,
        sender_address: address,
        nonce: u64,
    }
    
    // Creates a new empty bucket for key = next_key, and increments next_key by 1.
    public entry fun add_nonce_bucket(aptos_framework: &signer) acquires NonceHistory {}
    
    // returns true if the (address, nonce) is valid and inserted into nonce table successfully
    // returns false if the (address, nonce) is duplicate
    public(friend) fun check_and_insert_nonce(
	    sender_address: address,
	    nonce: u64,
	    txn_expiration_time: u64
	  ): bool acquires NonceHistory {}
}

```

**Nonce history data structure**: Here, the nonce history is a table with 50k buckets. The nonce entry correspond to (address, nonce) is stored in the bucket corresponding to `sip_hash([address, nonce]) % NUM_BUCKETS`. Each bucket contains 2 big ordered maps, `nonces_ordered_by_exp_time` and `nonce_to_exp_time_map`. Both the maps store the same data, just in a different format. The `nonces_ordered_by_exp_time` map stores (expiration time, address, nonce) -> true. The `nonce_to_exp_time_map` stores (address, nonce) -> expiration time.

As the key in `nonces_ordered_by_exp_time` starts with expiration time, it's easy to figure out which entries have expired at the current time. This map helps with easy garbage collection. To garbage collect, we check if the front entry in the map has expiration time lower than current time, and pop accordingly.

To check if a given `(address, nonce)` pair exists in the nonce history, we use `nonce_to_exp_time_map`. 

**Garbage collection:** We use the above 2 map approach to facilitate effective garbage collection. When a new transaction is supposed to be validated, we call `check_and_insert_nonce` method to make sure the transaction is not replay of a previous transaction. If the (address, nonce) pair is valid, then we first try to garbage collect from the bucket before inserting the given (address, nonce, exp time) tuple inside the nonce history. To make sure we have a bounded behavior, we restrict to garbage collecting at most 5 entries. To make sure we avoid any edge cases, we retain the (address, nonce) pair in the nonce history upto around 1 minute after the transaction expires. So the same (address, nonce) pair cannot be reused for slight more than 1 minute after the previous transaction with the same (address, nonce) pair expires.

**Prefilling nonce history:** Table in Aptos is designed in such a way that each table entry (Bucket in our case) is stored in a different storage slot. In Aptos, creating a new storage slot is way more expensive than updating the data in existing storage slot. To minimize the gas cost for the user, we prefill the nonce history with 50k buckets, so the user only needs to pay bucket update cost, but not the bucket creation cost. The module contains `add_nonce_bucket` method to facilitate this.

**Why big ordered map?**: We chose the big ordered map datastructure for the nonce table because this map doesn’t have a storage limit on the number of entries that can be stored. If the number entries in a big ordered map exceeds the storage space of a single storage slot, the big ordered map automatically expands to use multiple storage slots without failing.

**Who can send orderless transactions?**: Both stateless (accounts without `0x1::Account` resource) and stateful accounts (accounts with `0x1::Account` resource) can send orderless transactions.

**Who can send sequence number based transactions?**: Both stateless (accounts without `0x1::Account` resource) and stateful accounts (accounts with `0x1::Account` resource) can send sequence number based transactions.

- If a stateless account sends a sequence number based transaction with sequence number = 0, then the prologue will create an `0x1::Account` resource with sequence number 0, and the account will no longer be stateless.
- If a stateless account sends a sequence number based transaction with sequence number > 0, then the prologue will discard the transaction.

**How to choose the nonce?:** For the sake of simplicity, we recommend the user to pick a random nonce in `u64` range. However, we also note that once an (address, nonce) pair is garbage collected from nonce history, the same (address, nonce) pair can be reused in another transaction safely. Suppose, if the user commits a transaction with (address = a, nonce = n, expiration time = t). We use an invariant that the user cannot send another transaction with (address = a, nonce = n, expiration time = t') if `t' <= t + 130 seconds`.

**Orderless transactions need not execute in the order of submission:** For sequence-number based transactions, there is an inherent order (the sequence number) in which these transactions will be executed by the blockchain. For orderless transactions, there is no inherent order in which these transactions should be executed by the blockchain. If the client submits transaction txn2 after transaction txn1, it's possible for the blockchain to execute txn2 before txn1. If the client application requires the transactions to be executed in order, we recommend using the sequence-number based transactions instead.

This AIP introduces a new onchain feature flag called `ORDERLESS_TRANSACTIONS`. If this flag is disabled, all the transactions crafted in the new format will be discarded by the VM.

## Impact

**Impact on dev tools**: Earlier, the clients had to keep track of the onchain sequence number for each of its accounts. This is because the transactions drafted the client need to match this onchain sequence number. This is also the case with our load testing tools, SDKs, wallets, etc. With orderless transactions, the clients no longer have to keep track of sequence numbers.

We need to update a lot of downstream tools such as our SDKs, wallets, indexer, explorer to support orderless transactions. We will soon update our Petra wallet to use orderless transactions by default.

**Impact on mempool**: Earlier, when mempool receives transactions from the same sender out of order, then the mempool stores these transactions in a parking lot until txns with all the missing sequence numbers are also received. To avoid storage blowup, mempool sets a limit of storing at max 100 uncommitted per sender account. This means the client applications that use a lot of throughput had to maintain many accounts just to overcome this limitation.

With orderless transactions, there is no order. Mempool never stores orderless transactions in a parking lot. The limit on the number of uncommitted transactions per account can be much higher. The indexes in mempool are changed significantly to be able to store both orderless transactions and sequence number based transactions.

**A new API endpoint**: If a client wants to track whether its submitted transaction is committed, the client can periodically call `/transactions/by_hash/:txn_hash` endpoint to fetch the onchain transaction by hash. But if the client is doing load testing (like our transaction emitter) and is submitting 1000s of transactions, it’s inefficient to call this API regularly so many times. A more efficient way is to fetch the Account resources instead by calling `accounts/:address` . Based on the onchain sequence number of the accounts, it’s easy to figure out which transactions are committed. But this doesn’t work to track orderless transactions. To facilitate this, we add a new API endpoint: `/accounts/:address/transaction_summaries`. This API outputs the summaries of transactions that are committed between given start_version and end_version. A transaction summary looks as follows

```jsx
enum IndexedTransactionSummary {
    V1 {
        sender: AccountAddress,
        version: Version,
        transaction_hash: HashValue,
        replay_protector: ReplayProtector,
    }
}
enum ReplayProtector {
    Nonce(u64),
    SequenceNumber(u64),
}
```

Here, we use the term `ReplayProtector` that could be either a nonce or sequence number. A `(address, sequence number)` can uniquely identify a committed transaction. However, it’s important to note that `(address, nonce)` doesn’t uniquely identify a committed transaction, as the same nonce could be reused after a few minutes (when the previous transaction with same nonce expires and is garbage collected from nonce history).

**Max expiration time**: orderless transactions can have a max expiration time of at most 60 seconds into the future. orderless transactions with longer expiration time are discarded by prologue. There are no such limits on expiration time for sequence number based transactions.

**Key Rotation**: A primary benefit of orderless transaction is that orderless transaction can be sent by user without creating the `0x1::Account` resource and paying the appropriate storage slot creation fee. Without creating the `0x1::Account` resource, the user is allowed to use only the default Ed25519 authentication mechanism in their transactions. The user is still allowed to use other authentication mechanisms by rotating keys. However, we note that when a user rotates keys, the `0x1::Account` resource for the user is created and the user pays the appropriate storage slot creation fee.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/16299

https://github.com/aptos-labs/aptos-core/pull/16307

https://github.com/aptos-labs/aptos-core/pull/16252

## Risks and Drawbacks

**Impact on gas cost**: The sender of a transaction usually need to pay for the computation and storage cost of executing the transaction.

We preallocate the storage slots in nonce history. So, the sender of an orderless transaction doesn’t have to pay the storage slot create fee for storing the nonce.

As of this writing, the prologue is not charged. So, the sender of an orderless transaction doesn’t have to pay the computational cost of managing the nonce history. This may change in the future, when the user is charged a gas fee for prologue.

A sequence number based transaction updates the Account resource of the sender. The user pays a gas fee to include this update operation in the write set. An orderless transaction doesn’t update the Account resource of the sender. It instead updates two big ordered maps in the nonce history. This requires a slightly higher gas fee than updating Account resource. But this increase in gas fee is very minimal.

**Impact on performance**: As the prologue of each orderless transaction need to check for replay protection by looking up in a big ordered map, the computation complexity for orderless transaction is higher than that of a sequence number based transaction. So, the expected throughput for orderless transactions is lower than sequence number based transactions. 

## Timeline

The binary and framework code will be deployed on mainnet in May 2025.

The feature will be enabled in June 2025.

The dev tooling such as SDKs and indexer will be provided in May - June 2025.
