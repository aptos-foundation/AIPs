---
title: Multisig Account
author: movekevin
discussions-to: https://github.com/aptos-foundation/AIPs/issues/50
Status: Accepted
last-call-end-date:
type: Standard (Framework)
created: 2023/01/24
updated: 2023/01/26
---

## Summary

This AIP proposes a new multisig account standard that is primarily governed by transparent data structures and functions in a smart contract (multisig_account) with more ease of use and powerful features than the current multied25519-auth-key-based accounts. There’s also a strong direction for this to involve as part of a more general account abstraction in Aptos with more types of accounts and functionalities for users to manage their accounts.

This is not meant to be a full-fledged multisig wallet product but instead just the primitive construct and potentially SDK support to enable the community to build more powerful multisig products.

## Motivation

Multisig accounts are important in crypto and are used:

- As part of a DAO or developer group to upgrade, operate, and manage smart contracts.
- To manage on chain treasuries.
- For individual to secure their own assets so the loss of one key would not lead to loss of funds.

Currently, Aptos supports multied25519 auth keys, which allows for multisig transactions:

- This is different from multi-agent transactions where multiple signers sign the txs separately leading to multiple signers being created when the tx is executed.
- The multisig account can be created by calling create_account with the right address, which is a hash of the list of owners’ public keys, the threshold k (k-of-n multisig), and multied25519 scheme identifier (1), concatenated. The multisig enforcement will then be done through the multisig account’s auth key.
- To create a multisig tx, the tx payload needs to passed around, and k private keys that are part of the multisig account needs to sign with the right [[authenticator setup](https://aptos.dev/guides/creating-a-signed-transaction/#multisignature-transactions)](https://aptos.dev/guides/creating-a-signed-transaction/#multisignature-transactions).
- To add or remove an owner or change the threshold, owners need to send a tx with enough signatures to change the auth key to reflect the new list of owner public keys and the new threshold.

There are several problems with this current multisig setup that make it hard to use:

- It’s not easy to tell who are the current owners of the multisig account and what the required signature threshold is. This information needs to be manually parsed from the auth key.
- To create the multisig account’s auth key, users need to concatenate the owners’ public keys and add the signature threshold at the end. Most people don’t even know how to get their public keys or that they are different from addresses.
- Users would have to manually pass around the tx payload to gather enough signatures. Even if the SDK makes the signing part easy, storing and passing this tx requires a database somewhere and some coordination to execute when there are enough signatures.
- The nonce in the multisig tx has to be the multisig account’s nonce, not the owner accounts’ nonces. This usually would invalidate the a multisig tx if other txs were executed before it, increasing the nonce. Managing the nonce here for multipe in-flight txs can be tricky.
- Adding or removing owners is not easy as it involves changing the auth key. The payload for such transactions would not be easily understandable and needs some special logic for parsing/diffing.

## Proposal

We can create a more user-friendly multisig account standard that the ecosystem can build on top of. This consists of two main components:

1. A multisig account module that governs creating/managing multisig accounts and creating/approving/rejecting/executing multisig account transactions. Execution function will be private by default and only executed by:
2. A new transaction type that allows an executor (has to be one of the owners) to execute a transaction payload on the behalf of a multisig account. This will authenticate by calling the multisig account module’s private execution function. This transaction type can also be generalized to support other impersonation/delegation use cases such as paying for gas to execute another account’s transaction.

### Data structures and multisig_account module

- A multisig_account module that allows easier creating and operating a multisig account
    - The multisig account will be created as a standalone resource account with its own address
    - The multisig account will store the multisig configs (list of owners, threshold), and a list of transactions to execute. The transactions must be executed (or rejected) in order, which adds determinism.
    - This module also allows owners to create and approve/reject multisig transactions using the standard user transactions (these functions will be standard public entry functions). Only executing these multisig account transactions would need the new transaction type.

```rust
struct MultisigAccount has key {
  // The list of all owner addresses.
  owners: vector<address>,
  // The number of signatures required to pass a transaction (k in k-of-n).
  signatures_required: u64,
  // Map from transaction id (incrementing id) to transactions to execute for this multisig account.
  // Already executed transactions are deleted to save on storage but can always be accessed via events.
  transactions: Table<u64, MultisigTransaction>,
  // Last executed or rejected transaction id. Used to enforce in-order executions of proposals.
  last_transaction_id: u64,
  // The transaction id to assign to the next transaction.
  next_transaction_id: u64,
  // The signer capability controlling the multisig (resource) account. This can be exchanged for the signer.
  // Currently not used as the MultisigTransaction can validate and create a signer directly in the VM but
  // this can be useful to have for on-chain composability in the future.
  signer_cap: Option<SignerCapability>,
}

/// A transaction to be executed in a multisig account.
/// This must contain either the full transaction payload or its hash (stored as bytes).
struct MultisigTransaction has copy, drop, store {
  payload: Option<vector<u8>>,
  payload_hash: Option<vector<u8>>,
  // Owners who have approved. Uses a simple map to deduplicate.
  approvals: SimpleMap<address, bool>,
  // Owners who have rejected. Uses a simple map to deduplicate.
  rejections: SimpleMap<address, bool>,
  // The owner who created this transaction.
  creator: address,
  // Metadata about the transaction such as description, etc.
  // This can also be reused in the future to add new attributes to multisig transactions such as expiration time.
  metadata: SimpleMap<String, vector<u8>>,
}
```

### New transaction type to execute multisig account transactions

```rust
// Existing struct used for entry function payload
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct EntryFunction {
    pub module: ModuleId,
    pub function: Identifier,
    pub ty_args: Vec<TypeTag>,
    #[serde(with = "vec_bytes")]
    pub args: Vec<Vec<u8>>,
}

```rust
// Existing struct used for EntryFunction payload, e.g. to call "coin::transfer"
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct EntryFunction {
    pub module: ModuleId,
    pub function: Identifier,
    pub ty_args: Vec<TypeTag>,
    #[serde(with = "vec_bytes")]
    pub args: Vec<Vec<u8>>,
}

// We use an enum here for extensibility so we can add Script payload support
// in the future for example.
pub enum MultisigTransactionPayload {
    EntryFunction(EntryFunction),
}

/// A multisig transaction that allows an owner of a multisig account to execute a pre-approved
/// transaction as the multisig account.
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct Multitsig {
    pub multisig_address: AccountAddress,

    // Transaction payload is optional if already stored on chain.
    pub transaction_payload: Option<MultisigTransactionPayload>,
}
```

### End-to-end flow

1. Owners can create a new multisig account by calling multisig_account::create.
    1. This can be done as a normal user tx (entry function) or on chain via another module that builds on top.
2. Owners can be added/removed any time by calling multisig_account::add_owners or remove_owners. The transactions to do still need to follow the k-of-n scheme specified for the multisig account.
3. To create a new transaction, an owner can call multisig_account::create_transaction with the transaction payload: specified module (address + name), the name of the function to call, and argument values.
    1. The payload data structure is still under experimentation. We want to make it easy for off-chain systems to correctly construct this payload (or payload hash) and can debug if there are issues.
    2. This will store the full transaction payload on chain, which adds decentralization (censorship is not possible) and makes it easier to fetch all transactions waiting for execution.
    3. If gas optimization is desired, an owner can alternatively call multisig_account::create_transaction_with_hash where only the payload hash is stored (module + function + args). Later execution will be verified using the hash.
    4. Only owners can create transactions and a transaction id (incrementing id) will be assigned.
4. Transactions must be executed in order. But owners can create multiple transactions in advance and approve/reject them.
5. To approve or reject a transaction, other owners can call multisig_account::approve() or reject() with the transaction id.
6. If there are enough rejections (≥ signatures threshold), any owner can remove the transaction by calling multisig_account::remove().
7. If there are enough approvals (≥ signatures threshold), any owner can execute the next transaction (by creation) using the special MultisigTransaction type with an optional payload if only a hash is stored on chain. If the full payload was stored at creation, the multisig transaction doesn’t need to specify any params beside the multisig account address itself. Detailed flow in VM:
    1. Transaction prologue: The VM will first invoke a private function (multisig_account::validate_multisig_transaction) to verify that the next transaction in the queue for the provided multisig account exists and has enough approvals to be executed.
    2. Transaction execution:
        1. VM first obtains the payload of the underlying call in the multisig tx. This shouldn’t fail if transaction prologue (validation) has succeeded.
        2. VM then tries to execute this function and records the result.
        3. If successful, VM invokes multisig_account::successful_transaction_execution_cleanup to track and emit events for the successful execution
        4. If failed, VM throws away the results of executing the payload (by resetting the vm session) while keeping the gas spent so far. It then invokes multisig_account::failed_transaction_execution_cleanup to track the failure.
        5. At the end, gas is charged to the sender account and any pending Move module publishing is resolved (in case the multisig tx publishes a module).

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/5894](https://github.com/aptos-labs/aptos-core/pull/5894)

## Risks and Drawbacks

The primary risk is smart contract risk where there can be bugs or vulnerabilities in either the smart contract code (multisig_account module) or API and VM execution. This can be mitigated with thorough security audit and testing.

## Future Potential

An immediate extension to this proposal is to add script support for a multisig tx. This would allow defining more complex atomic multisig txs.

In the longer term:

The proposal as-is would not allow on-chain execution of multisig transactions - other modules can only create transactions and allow owners to approve/reject. Execution would require sending a dedicated transaction of the multisig transaction type. However, in the future, this can be made easier with dynamic dispatch support in Move. This would allow on chain execution and also off-chain execution via the standard user transaction type (instead of the special multisig transaction type). Dynamic dispatch could also allow adding more modular components to the multisig account model to enable custom transaction authentication, etc.

Another direction multisig account can enable is more generic account abstraction models where on-chain authentication can be customized to allow account A to execute a transaction as account B if allowed via modules/functionalities defined by account B. This would enable more powerful off-chain systems such as games to abstract away transaction and authentication flow without the users needing intimate understanding of how they work.

## Suggested implementation timeline

Targeted code complete (including security audit) and testnet release: February 2023.
