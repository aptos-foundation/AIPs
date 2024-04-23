---
aip: 82
title: Transaction context extension
author: junkil-park (https://github.com/junkil-park), lightmark (https://github.com/lightmark), movekevin (https://github.com/movekevin)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 4/2/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-82 - Transaction context extension

## Summary

This AIP proposes an extension to the transaction context module within the Aptos Framework. The enhancement will enable users to retrieve user transaction information directly in smart contracts. This feature is crucial for supporting the mechanism that enables custom user prologues and epilogues, which will be addressed in a separate AIP later.

### Out of Scope

This AIP does not include the API for retrieving signatures of the user transaction, even though they are part of a signed transaction. This is because there is currently no identified need for this functionality. However, it can be introduced in the future if required.

This extension applies exclusively to user transactions, not to other types of system transactions.

## High-level Overview

This feature extends the transaction context module within the Aptos Framework to provide smart contracts with access to the information of the current user transaction. The information includes the sender, secondary signers, the gas payer, the maximum gas amount, the gas price, chain ID, entry function payload, and multisig payload.

This AIP introduces an API within the transaction context module, consisting of a set of public functions, to retrieve transaction context information. For example, during the execution of a smart contract, it can retrieve the address of the transaction sender or the gas payer by calling the corresponding functions. For a more comprehensive explanation of the proposed API, please see the [Specification and Implementation Details](#specification-and-implementation-details) section.

This enhancement is critical for facilitating the mechanism that allows for custom user prologues and epilogues, which are under development. Custom prologues and epilogues will be able to utilize the proposed API to retrive the transaction information and execute specific logic based on the user transaction context. Details regarding the design and implementation of custom user prologues and epilogues will be discussed in a future AIP.

## Impact
Smart contract developers can leverage this feature to enable their smart contracts to directly access context information from the current user transaction.

## Specification and Implementation Details

This AIP extends the Aptos Framework's transaction context module (i.e., `aptos_framework::transaction_context`) by introducing the transaction context API. This API comprises a series of public functions that allow smart contracts to access information from the current user transaction. The API specification is as follows:
* `public fun sender(): address`
  * Returns the sender's address for the current transaction.
* `public fun secondary_signers(): vector<address>`
  * Returns the list of the secondary signers for the current transaction.
* `public fun gas_payer(): address`
  * Returns the gas payer address for the current transaction.
* `public fun max_gas_amount(): u64`
  * Returns the max gas amount in units which is specified for the current transaction.
* `public fun gas_unit_price(): u64`
  * Returns the gas unit price in Octas which is specified for the current transaction.
* `public fun chain_id(): u8`
  * Returns the chain ID specified for the current transaction.
* `public fun entry_function_payload(): Option<EntryFunctionPayload>`
  * Returns the entry function payload if the current transaction has such a payload. Otherwise, return `None`.
* `public fun multisig_payload(): Option<MultisigPayload>`
  * Returns the multisig payload if the current transaction has such a payload. Otherwise, return `None`.

The entry function payload is defined as follows:
```
struct EntryFunctionPayload has copy, drop {
    account_address: address,
    module_name: String,
    function_name: String,
    ty_args_names: vector<String>,
    args: vector<vector<u8>>,
}
```
Here are the functions to access the fields of the entry function payload:
* `public fun account_address(payload: &EntryFunctionPayload): address`
* `public fun module_name(payload: &EntryFunctionPayload): String`
* `public fun function_name(payload: &EntryFunctionPayload): String`
* `public fun type_arg_names(payload: &EntryFunctionPayload): vector<String>`
* `public fun args(payload: &EntryFunctionPayload): vector<vector<u8>>`

The multisig payload is defined as follows:
```
struct MultisigPayload has copy, drop {
    multisig_address: address,
    entry_function_payload: Option<EntryFunctionPayload>,
}
```
Here are the functions to access the fields of the multisig payload:
* `public fun multisig_address(payload: &MultisigPayload): address`
* `public fun inner_entry_function_payload(payload: &MultisigPayload): Option<EntryFunctionPayload>`

## Reference Implementation
https://github.com/aptos-labs/aptos-core/pull/11843

## Testing

The reference implementation includes multiple unit tests and end-to-end tests covering various positive/negative scenarios. These scenarios will be tested on the devnet and testnet.

## Security Considerations

This AIP allows smart contracts to access the information about the transaction currently in execution. Since the user transaction data is already stored on-chain and is publicly available, this AIP does not introduce any additional security risks related to the disclosure of secrete information.

## Future Potential

This feature is essential for enabling custom user prologues and epilogues, which will be detailed in a separate AIP.

## Timeline

### Suggested implementation timeline

The implementation has landed on the `main` branch before the branch cut for v1.12.

### Suggested developer platform support timeline

N.A.

### Suggested deployment timeline

* On the devnet: with release v1.12
* On the testnet and mainnet: depends on the AIP approval process
