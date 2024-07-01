---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Introduce Lite Account (Account v2)
author: lightmark, davidiw
Status: Draft
type: Framework
created: <06/25/2024>
---

# AIP-X - Lite Account, aka Account V2
  
## Summary

The current Aptos Account has several issues including deprecated `EventHandle` which blocks parallel execution, inflexible permission control with `SignerCapability` and `RotationCapability` and deprecated `guid_creation_number`.

This AIP proposes a new account model to replace the current account model on Aptos in the future, called `LiteAccount` that leverages the composability of Aptos Object model, which solves all the issues and clean up all unnecessary resources.
Also, a migration plan is included in the AIP.


### Out of Scope

Account Abstraction itself will be a separate AIP since this topic alone is worthy of an article given its complexity.

## High-level Overview

Lite Account will have all account related resources into a single resource group, `0x1::lite_account::LiteAccountGroup`. The potential resources are:
- `Account`: It has one field, `sequence_number: u64`. If `squence_number == 0`, this resource does not exist.
- `NativeAuthenticator`: It only has one field, `auth_key: Option<vector<u8>>`. This is the `authentication_key` in the current account module and `option::none()` replaced `ZERO_AUTH_KEY` to indicate native authentication is disabled on this account. If `auth_key == option::some(bcs::to_bytes(account_address))`, which is the default case, this resource does not exist.
- `DispatchableAuthenticator`: Reversed for Account Abstraction. It has one field, `auth_func: FunctionInfo`. If this resource exists, `auth_func` will be called as authentication. The detailed solutionn will be introduced in another AIP.
There are several other resources only for lite accounts migrated from v1 accounts and those will be covered in  [the specification section](#specification-and-implementation-details).

There are several benifits:
- With resource group, it is flexible to add or remove different resources based on users' need and keep all the resources colocated in the storage slot. 
- This modularized design also makes the authentication scheme flexible. A lite account has the option to be authenticated through native authentication, dispatchable/customized authentication, or event both.
- The account model is simple and clean by removing all parallel-execution blockers.
- In an ideal world, if Aptos could support orderless txns not relying on sequence number, the default lite account could have 0 storage footprint!

## Impact

All the users will be impacted by this change, technically. They can call `0x1::account::migrate_to_lite_account(account: &signer)` to migrate to lite account.
But no matter whether their v1 accounts are migrated or not on chain, no onchain dapp will be broken. Lite Account is fully compatible with all existing dapps that call `0x1::account` module.

Without Lite Account, we cannot fully remove all the blockers of parallel execution in Aptos Framework. There are three milestones:
- Parallelizable Events - Module Events
- Parallelizable Asset Balance - Parallelizable Fungible Balance
- Parallelizable Account Resources - Lite Acccount w/o updating sequence number.

Aptos Framework already shipped the first and the second, and Lite Account kickoffs the third effort. If all three are done, Aptos Framework can fully utilize the parallelism engine to achieve higher tps in real-life workload. 

## Alternative solutions

- Modify the current account module to support Account Abstraction with a new resource.

The alternative solution is a patch but not a clean solution. it cannot get rid of the deprecated and unnecessary fields and takes more storage slots so it can never has 0 storage footprint in the future.
The current Account resource has 7 fields and 5 are absolutely deprecated, 1 is unnecessary for most user and the left 1 will be unnecessary for most people in the future if Aptos has orderless transaction support.

## Specification and Implementation Details

This AIP primarily introduces the following new structs:

In `lite_account.move`:
```
    #[resource_group(scope = address)]
    /// A shared resource group for storing new account resources together in storage.
    struct LiteAccountGroup {}

    #[resource_group_member(group = aptos_framework::lite_account::LiteAccountGroup)]
    /// Resource representing an account object.
    struct Account has key {
        sequence_number: u64,
    }

    #[resource_group_member(group = aptos_framework::lite_account::LiteAccountGroup)]
    /// The native authenticator where the key is used for authenticator verification in native code.
    struct NativeAuthenticator has key, copy, drop {
        auth_key: Option<vector<u8>>,
    }

    #[resource_group_member(group = aptos_framework::lite_account::LiteAccountGroup)]
    /// The dispatchable authenticator that defines how to authenticates this account in the specified module.
    /// An integral part of Account Abstraction.
    struct DispatchableAuthenticator has key, copy, drop {
        auth_function: FunctionInfo
    }

    #[resource_group_member(group = aptos_framework::lite_account::LiteAccountGroup)]
    /// Legacy field from deprecated Account module.
    struct LegacyGUIDCreactionNumber has key {
        creation_number: u64,
    }

    #[resource_group_member(group = aptos_framework::lite_account::LiteAccountGroup)]
    /// Legacy field from deprecated Account module.
    struct LegacyRotationCapabilityOffer has key, drop { for: address }

    #[resource_group_member(group = aptos_framework::lite_account::LiteAccountGroup)]
    /// Legacy field from deprecated Account module.
    struct LegacySignerCapabilityOffer has key, drop { for: address }
```

And other functions to support all the operations on those resources, please refer to the reference implementation for more details.


## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/10780

## Testing (Optional)

All functionality verified with unit tests across aptos-framework, e2e-move-tests and api.

## Risks and Drawbacks

Since this AIP proposes a compatible solution, if the ecosystem still rely on account.move heavily and do not adopt the features of the lite account, the benefits would be greatly deprecated. 

The migration plan would be two steps:
1. Stop creating v1 account and only create v2 account on chain.
2. Opt-in migration to v2 account.
3. Open to discussion whether global migration is necessary.

## Security Considerations

If not implemented correctly, an account may have both `account::Account` and `lite_account::Account`. Due to circular dependency, we may want to have a native function to verify there is no `account::Account` when creating new lite account.

## Future Potential

With Lite account, the future potential would be the support of orderless transactions.

## Timeline

### Suggested implementation timeline

It's done in June 2024.

### Suggested developer platform support timeline

No expected change to SDK, API, API and Indexer. The PR includes changes to API already.

### Suggested deployment timeline

 - On devnet: Mid July 2024.
 - On testnet: Early Aug 2024.
 - On mainnet: Early Sept 2024.
