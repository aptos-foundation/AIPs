---
aip: 115
title: Stateless Account Update
author: lightmark, igor-aptos, davidiw
Status: Draft
type: Framework
created: <10/21/2024>
---

# AIP-115 - Stateless Account Update

## Summary
The Stateless Account update introduces an optimization to the existing Aptos account model, enabling gas savings by not requiring the explicit creation of an account resource unless necessary. In this update, accounts that do not have a pre-existing account resource are treated as valid with default behaviors, particularly defaulting the auth_key to the account’s address. The account resource will only be created when a specific action, such as rotating the authentication key, requires it.

This update allows for more efficient resource management and reduced gas costs while maintaining backward compatibility with existing accounts and the Move VM.

### Out of Scope
The orderless transaction feature, which may eliminate the sequence number requirement in the future, is not part of this AIP but will be the prerequisite and complements the Stateless Account update.

## High-level Overview
Currently, the Aptos blockchain requires an explicit account resource for any account interacting with the system, which incurs gas costs. The Stateless Account update introduces a feature that allows accounts without a resource to be treated as existing with default behaviors, specifically:
- The `auth_key` defaults to the account's address (auth_key = account_address).
- Other fields in the account resource (e.g., sequence number) are unused unless explicitly needed.

The account resource will only be created when the user performs an action that overrides these default behaviors (e.g., rotating the auth_key), thus reducing the need for upfront resource creation.

This update retains the current Account struct as is and optimizes the system to handle accounts without resources in a gas-efficient manner.

Benefits:
- Gas Savings: By avoiding the upfront creation of account resources, this update reduces gas costs for accounts that do not require immediate resource usage.
- Efficiency: Stateless Accounts optimize resource usage for simple operations, minimizing the on-chain footprint for accounts that do not need complex functionality.
- Backward Compatibility: The existing account model is fully preserved, and this update works seamlessly with existing accounts and applications.


Limitations:
- Advanced Features will require account creation: When Stateless Accounts perform advanced actions like key rotation or use capability offers, account resource will need to be created, and it's associated storage costs paid.
- Default Behavior: Stateless Accounts will use default values, such as auth_key = account_address, until the account resource is created.

## Impact 
- Developer Experience:
  - Developers should ensure that their dApps handle accounts that may not have an account resource but can still function with default values, particularly for transactions where the auth_key defaults to the account address.
  - No major code changes are necessary unless applications rely on fields from the account resource (e.g., sequence number, authentication key changes).
- Account Resource Creation:
  - When the user performs an action that requires non-default behavior (e.g., key rotation), the account resource will be created automatically, and gas costs will be incurred at that time.
- Existing Accounts:
  - Existing accounts with resources already created will continue to function as they do today. This update mainly impacts new accounts or accounts that have not yet performed actions requiring the account resource.
  

## Alternative Solutions
The primary alternative to Stateless Accounts is the existing account model, where account resources are always created upfront. Another alternative is the LiteAccount model, which reduces storage overhead by introducing a new account module which needs more engineering work and migration overhead.

Stateless Accounts provide the most gas-efficient solution by avoiding resource creation unless necessary.

## Specification and Implementation Details
Stateless Account Behavior
Under the Stateless Account model, accounts that do not have an account resource are treated as valid by default. Specifically:

- Default `auth_key` Behavior: If an account resource does not exist, the account’s auth_key defaults to the account address. This allows the account to sign transactions without needing a full account resource.
- Resource Creation: If an action requires the account resource (such as rotating the auth_key), the resource will be created at that time. Once created, the account will no longer rely on default values.
The Move VM will handle these default behaviors in the prologue:

```move
if !exists<account::Account>(account_address) {
    auth_key = account_address;
}
```

### Sequence Number Considerations
While the sequence number is currently required for transaction ordering, the sequence number is not created unless the account resource exists. The future introduction of orderless transaction will remove the sequence number requirement entirely, enabling fully stateless transactions. Since then, call to get_sequence_number will return 0 for stateless accounts that only used orderless_txns thus far.

### Prologue/Epilogue Changes
The prologue will check if the account resource exists at the time of transaction processing:

If the account resource does not exist, it will default to using the account address as the auth_key.
If an action requiring resource creation is detected (such as a key rotation), the account resource will be created automatically during the execution and the gas will be charged from the user.

### Migration Plan
No migration is necessary for existing accounts. The Stateless Account feature primarily impacts new accounts or accounts that have not yet required an account resource. Existing accounts with resources will continue to function without any changes.

## Risks and Drawbacks

Gas Savings vs Functionality
- While Stateless Accounts save gas by avoiding resource creation, users who require more advanced account features (such as key rotation) will still need to create an account resource, incurring gas costs at that time.

Ecosystem Impact
- Backward Compatibility: Stateless Accounts are fully backward compatible if implemented in a compatible way, but developers must ensure that applications can handle default values when the account resource does not exist.

To ensure compatibility, the system will return a default state in Move and through the API, even when an account resource does not exist. This approach guarantees that downstream smart contracts relying on the account resource will continue to function without disruption.

## Security Considerations
Stateless Accounts must be implemented securely to prevent unintended behaviors or security loopholes. The default `auth_key = account_address` should undergo appropriate validation to prevent unauthorized access or transactions.

## Future Potential
Whether Aptos need a new account module to fully remove the deprecated fields in the current account resource with more storage optimizations such as colocating account resource and primary fungible store resource.

## Timeline

### Suggested implementation timeline
After orderless txn. Should need about 2 weeks.

### Suggested developer platform support timeline
No expected changes to SDK, Indexer. But the default behavior for API needs to return default state if the account resource does not exist for compatibility.
