---
aip: 77
title: Multisig V2 Enhancement
author: junkil-park (https://github.com/junkil-park), movekevin (https://github.com/movekevin)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/409
Status: Accepted
type: Standard (Framework)
created: 3/28/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-77 - Multisig V2 Enhancement

## Summary

This AIP proposes to enhance the Multisig V2 by (1) limiting the maximum number of pending transactions, (2) introducing batch operation functions, and (3) implicitly voting on the transaction execution.

# High-level Overview

This AIP proposes to enhance the Multisig V2 by adding the following features:
1. Limit the maximum number of pending transactions. This is done by introducing and enforcing the new constant `MAX_PENDING_TRANSACTIONS` in the Multisig V2 account module, which is set at 20. If the number of pending transactions exceeds this limit, the contract will not accept any new transaction proposals until the number of pending transactions falls below the limit. This is to prevent the pending transaction queue from being overloaded with too many pending transactions, thus effectively mitigating the risk of a DoS attack (as described in https://github.com/aptos-labs/aptos-core/issues/8411).

2. Introduce batch operation functions. This feature allows the owners of a multisig account to execute multiple operations in a single batch operation. This is done by introducing new public entry functions `vote_transactions` and `execute_rejected_transactions` in the Multisig V2 account module. This feature is useful for executing multiple transactions atomically, thus improving the usability, reducing the number of transactions, saving gas fees, and effectively countering a potential DoS attack (as described in https://github.com/aptos-labs/aptos-core/issues/8411).

3. Implicitly vote upon the transaction execution. This feature allows the owners of a multisig account to implicitly vote upon the transaction execution. The multisig transaction execution implicitly approves the transaction first, while `execute_rejected_transaction` implicitly rejects the transaction first. Implict voting is not a new concept because the transaction creation already implicitly votes to approve the transaction. This modification reduces the number of required transactions in the Multisig V2 user flow, thereby enhancing usability and saving on gas fees. This feature resolves the user experience issue described in here: https://github.com/aptos-labs/aptos-core/issues/11011.

## Impact

Multisig accounts cannot have more than 20 pending transactions, but this limit should be sufficient for most practical use cases. If there are some multisig accounts with more than 20 pending transactions already, they can still continue to vote and (reject-)execute the transactions as before. However, they cannot have new transaction proposals until the number of pending transactions falls below the limit.

The batch operation functions and the implicit voting feature are backward-compatible with the existing Multisig V2 implementation. The existing Multisig V2 users can continue to use the existing workflow. The new features are optional and can benefit the users, simplifying the user flow and saving on gas fees.

## Specification and Implementation Details

The specification for limiting the maximum number of pending transactions is as follows:

* The maximum number of pending transactions is limited to 20 by introducing the new constant `MAX_PENDING_TRANSACTIONS` in the multisig account module. If the number of pending transactions exceeds this limit, the contract will not accept any new transaction proposals until the number of pending transactions falls below the limit.
* If there are some accounts with more than 20 pending transactions already, they can still continue to vote and (reject-)execute the transactions as before. However, they cannot have new transaction proposals until the number of pending transactions falls below the limit.

The following batch operation functions are newly introduced in the multisig account module:
* `public entry fun vote_transactions(owner: &signer, multisig_account: address, starting_sequence_number: u64, final_sequence_number: u64, approved: bool)`
  * This entry function allows the `owner` of the `multisig_account` to approve (`approved = true`) or reject (`approved = false`) multiple transactions in the range of `starting_sequence_number` to `final_sequence_number`.
* `public entry fun execute_rejected_transactions(owner: &signer, multisig_account: address, final_sequence_number: u64)`
  * This entry function allows the `owner` of the `multisig_account` to execute the rejected transactions upto the `final_sequence_number`.

The specification for implicitly voting upon the transaction is as follows:
* When an owner execute a multisig transaction, an implict vote to approve the transaction is casted. If the owner already voted to reject the transaction, the vote is updated to approve the transaction. If the vote has not been already casted to approve, the implict voting changes the vote to approve, thus emmiting a corresponding `VoteEvent`.
* When an owner runs `execute_rejected_transactions`, an implict vote to reject the transaction is casted. If the owner already voted to approve the transaction, the vote is updated to reject the transaction. If the vote has not been already casted to reject, the implict voting changes the vote to reject, thus emmiting a corresponding `VoteEvent`.
* The view function `public fun can_execute(owner: address, multisig_account: address, sequence_number: u64): bool` is added to check if the owner can execute the next transaction of the `multisig_account`, taking into account the implict voting.
* The view function `public fun can_reject(owner: address, multisig_account: address, sequence_number: u64): bool` is added to check if the owner can execute the next transaction of the `multisig_account` as a rejected transaction, taking into account the implict voting.

## Reference Implementation

* https://github.com/aptos-labs/aptos-core/pull/12241
* https://github.com/aptos-labs/aptos-core/pull/11941

## Testing
The reference implementations include unit tests covering end-to-end scenarios. These scenarios will be tested on the devnet and testnet.

## Security Considerations

This AIP resolves the security concern desribed in https://github.com/aptos-labs/aptos-core/issues/8411.

## Timeline

### Suggested deployment timeline

This feature will be part of the v1.11 release.
