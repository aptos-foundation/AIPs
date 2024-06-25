---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Introduce Lite Account
author: lightmark, davidiw
Status: Draft
type: Framework
created: <06/25/2024>
---

# AIP-X - Introduce Lite Account
  
## Summary
As Aptos evolves, deficiencies in our early account model become more apparent. These limitations prevent efficient usage of resources on Aptos and hamper evolution of new features. For example, Aptos is the only blockchain that
requires an account to be populated prior to use and assets can only be allocated to an existing account. This AIP reviews many distinct initiatives that fall into the umbrella of redesiging accounts that seek to rewrite
the entirety of the user experience.

This AIP proposes a new account model to replace the current account model on Aptos in the future, called `LiteAccount` that leverages the composability of Aptos Object model, which solves all the issues and cleans up all unnecessary resources.
Also, a migration plan is included in the AIP.

### Out of Scope

The concrete plan to remove the only required resource, sequence number.

## High-level Overview

Lite Account will have all account related resources into the same `PrimaryFungibleStore`(PFS) object group at the PFS object address.
The new struct will be in `account.move`, previously fields in account v1. The optionality of a resource is determined by its existence. To be compatible with account v1, some fields will be converted to the counterpart in lite account if the lite account is migrated from v1.
The potential resources are:
- `LiteAccount`: It has one field, `sequence_number: u64`. If `squence_number == 0`, this resource does not exist.
- `NativeAuthenticator`: It only has one field, `auth_key: Option<vector<u8>>`. This is the `authentication_key` in the current account module and `option::none()` replaced `ZERO_AUTH_KEY` to indicate native authentication is disabled on this account. If `auth_key == option::some(bcs::to_bytes(account_address))`, which is the default case, this resource does not exist.
There are several other resources only for lite accounts migrated from v1 accounts and those will be covered in  [the specification section](#specification-and-implementation-details).

There are several benefits:
- Allow upgradable accounts
    - Modularizing Account with Resource Groups to allow “dynamic” fields in account.
    - Pave the way for accounts with zero storage footprint in the future.
    - If we want to do that in V1, we will need an extra slot.
- Reduce a common account storage cost from 2 slots to 1 slot in the state merkle (account + APT store)
- Revamping account model from a clean slate
    - Clean up deprecated fields in Account v1, including GUID creation number and event handles.

## Impact

All the users will be impacted by this change, technically. They can call `0x1::account::migrate_to_lite_account(account: &signer)` to migrate to lite account.
But no matter whether their v1 accounts are migrated or not on chain, no onchain dapp will be broken. Lite Account is fully compatible with all existing dapps that call `0x1::account` module.

- Developer Experience
  - Developers should not assume account will always have `Account` resource at the account address. Similar to fungible asset migration, they would not assume `CoinStore` exists for accounts having APT.
  - The logic to read any fields inside `Account` resource has to be updated. For example, sequence numbers in account v1 or lite account are in different resources.
- SDK/CLI has to switch to use lite account by default.

## Alternative solutions

Start a new module for lite account. 
The issue here is there is no easy way to check whether account v1 exists when try to create a lite account because of circular dependency.


## Specification and Implementation Details

### Move Resources

A lite account can have up to 5 resources, they are:

1. Account: it only has `sequence_number` , if it does not exist, the default is 0. When this account needs to bump the sequence number but it does not exist, prologue will create this resource with seq_num = 0.
2. NativeAuthenticator: it only has an option of `authentication_key` that’s the same as that in v1. If the lite account does not have this field, it means the authenticator key is the address itself. Native authentication is only disabled when this resource has `None` as its field.
3. The rest 3 optional resources are for lite account’s that’s migrated from v1 or created when used with v1 functions.
   
#### Code

In `account.move`:
```
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Resource representing an account object.
struct LiteAccount has key {
    sequence_number: u64,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// The native authenticator where the key is used for authenticator verification in native code.
struct NativeAuthenticator has key, copy, drop {
    auth_key: Option<vector<u8>>,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// The dispatchable authenticator that defines how to authenticates this account in the specified module.
/// An integral part of Account Abstraction.
struct DispatchableAuthenticator has key, copy, drop {
    auth_function: FunctionInfo
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Legacy field from deprecated Account module.
struct LegacyGUIDCreactionNumber has key {
    creation_number: u64,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Legacy field from deprecated Account module.
struct LegacyRotationCapabilityOffer has key, drop { for: address }

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Legacy field from deprecated Account module.
struct LegacySignerCapabilityOffer has key, drop { for: address }
```

### Prologue/Epilogue Changes

The prologue is updated that if there is v1 account at the address, it will treat it as v1 account (reading sequence number, etc). Otherwise, if lite account feature is enabled, it will treat it as lite account. Even if there is no lite account resource created, it will be regarded as a lite account with all default values (seq_num == 0 && authentication_key == account_address). If the account is the sender, prologue will create the `Account { seq_num }` resource. Thanks to Alden, now prologue changes are persisted.
Epilogue is similar.

And other functions to support all the operations on those resources, please refer to the reference implementation for more details.


## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/10780

## Testing (Optional)

All functionality verified with unit tests across aptos-framework, e2e-move-tests and api.

## Risks and Drawbacks

### Performance
Lite accounts now reside in the same resource group as the Primary Fungible Store (PFS). This configuration results in suboptimal performance when reading account resources, as it is less efficient than reading account v1 directly.
- The co-location of lite account resources with PFS is intended to improve performance, but it can also lead to potential delays in reading account data.

### Contract
Move frameworks need to be refactored to accommodate two account models, similar to the handling of coin and Fungible Asset (FA).
- The introduction of lite accounts requires changes in the Move frameworks to support dual account models, adding complexity to the system.

### Ecosystem
Ecosystem projects that access account resource fields via node API will face disruptions if they do not upgrade their offchain code. This situation is similar to the FA migration balance view update.
- The most frequently queried field, sequence_number, will be affected. However, the overall risk is lower compared to the FA migration.
- Changes to the account resource structure will necessitate updates to the offchain code to maintain compatibility.

### Why are they risks?
The migration work alters previous assumptions, leading to potential breaks in offchain code that relies on onchain data. This could result in significant disruptions if not managed properly.
Is there a way to mitigate the risks?

### Mitigation Strategy
Similar to the FA migration, proactive measures include notifying and assisting dApp developers to update their code before launching the lite account and initiating the migration. This preparation helps ensure a smoother transition and minimizes disruptions.

## Security Considerations

If not implemented correctly, an account may have both account v1 and lite account.

## Future Potential

### Parallelizable and Invisible Account

With lite account, module events and gas payment from concurrent fungible asset balance are both parallelizable. The only blocker of parallel execution is the sequence number. Also, it is the only data to be stored for a lite account with all the default config.
The current sequence number is used as a nonce to prevent double-spending attack. But it bumps by 1 each time so multiple txns from the same sender cannot be parallel executed due to contention on this field.
One future potential is to have nonceless transaction which does not need sequence number anymore.

### Onchain Fee Payer (PayMaster)

With `RawTransaction` revamp, it is possible to attach more data to a transaction when onchain fee payer could be realized. 
The idea is similar: the transaction sender can specify a dispatchable function at an address, of whom the owner is the onchain fee payer,  in the transaction. `AptosVM` will call this function if it exists and if it didn’t error out, it means the owner agrees to pay for the gas fee of this transaction.

## Timeline

### Suggested implementation timeline

July 2024.

### Suggested developer platform support timeline

No expected change to SDK, API, API and Indexer. The PR includes changes to API already.

### Suggested deployment timeline

 - On devnet: Aug 2024.
 - On testnet: Aug 2024.
 - On mainnet: Sept 2024.
