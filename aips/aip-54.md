---
aip: 54
title: Object code deployment
author: movekevin, xbtmatt
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/259
Status: Draft
type: Standard (Framework)
created: 10/09/2023
---

# AIP-54 - Object code deployment

## Summary

This AIP proposes a simplified code deployment process that improves the current developer experience with deploying and upgrading Move modules on Aptos. Specifically:
1. Developers can deploy a package of Move modules, which get automatically get uploaded to a newly created object.
2. Developers receive a PublisherRef object if the package is upgradable.
3. PublisherRef can be used to update the package in the future and transferred freely to another account.

This new simplified and improved code deployment process will eliminate most of the current pains and confusion around code deployment.
Furthermore, this will reduce the storage footprint of each code deployment while maintaining the ease of adding programmatic control over publishing/upgrading as it'd not need to create a new resource account.

## Goals

1. Simplify the code deployment process on Aptos and improve overall developer experience.
2. Provide a powerful object-based framework for managing code deployment and upgrading.
3. Reduce storage footprint of code deployment

## Existing solutions
Current existing solutions:
1. Deploy code directly to an account the developer owns. This has two main drawbacks:
* During development, if the developer needs to make incompatible changes, they would need to throw away the account and deploy to a different one to avoid naming conflicts. Alternatively, they would need to change their package and module names.
* Deploying directly to an account means that account has full control over upgrading the code and cannot give this permission away, e.g. to a governance entity. This limits programmatic control, flexibility and decentralization of protocols deployed on Aptos.
2. Deploy code to a newly created resource account. This is similar to object deployment but suffers from:
* Similar issue with incompatible upgrades during development. Developer would need to play around with seeds to generate a different resource account, which is confusing.
* Storage inefficiency - creating a resource account to host the code means at least 2 resources created (especially when the Account resource is not needed).
* Hard to use upgrade process. Upgrade permission is controlled via the resource account's SignerCapability which is confusing to claim and use to upgrade code.

## Specification
The new object deployment flow will contain 3 specific components:
1. A new object_code module that offers the different APIs for deploying, upgrading, etc. using objects
2. A new resource PackageRegistryObject that wraps the existing PackageRegistry resource into the object resource group for storage efficiency.
3. Improvements to the Aptos CLI to simplify code deployment and upgrade flows.

In addition, the following improvements can be considered:
1. Extra metadata in PackageRegistry to support adding custom metadata such as git commit of the latest code version.
2. Allow specifying the current code object address in Move.toml to make upgrading easier to manage.
3. Allowing PackageMetadata as a struct input to the entry function. This would avoid having to rely on the CLI to generate the bytes for the PackageMetadata which is confusing and easy to make mistakes.
4. Ability to incrementally upload part of the code and publish the final package. This allows deploying packages larger than the 64KB size limit per transaction.
5. VM changes: The ability to deploy code without specifying the address of the code in advance. This can be used in conjunction with dynamically creating a new object to host the newly deployed code.

### New object_code module
```rust
module aptos_framework::object_code {
  #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
  struct PublishRef has key {
    inner: Object<PackageRegistryObject>,
    // Extend ref of the code object.
    extend_ref: ExtendRef,
  }

  /// Create a new object to host the code and a PublishRef object if the code is upgradable and send it to publisher.
  public entry fun publish(publisher: &signer, metadata_serialized: vector<u8>, code: vector<vector<u8>>) {}

  /// Upgrade the code in an existing code_object
  /// Requires the publisher to have a PublisherRef object.
  public entry fun upgrade(publisher: &signer, code_object: Object<PackageRegistryCode>, metadata_serialized: vector<u8>, code: vector<vector<u8>>) {}

  /// Make an existing upgradable package immutable.
  /// Requires the publisher to have a PublisherRef object.
  public entry fun freeze(publisher: &signer, code_object: Object<PackageRegistryCode>) {}
}
```

### New PackageRegistryObject
```rust
module aptos_framework::code {
  #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
  struct PackageRegistryObject has key, store, drop {
    inner: PackageRegistry,
  }
}
```

### Improvements to CLI
```
> aptos move publish --profile testnet
--------------------------------------
Deployed code at 0x1234
PublisherRef sent to 0xpublisher for future upgrades

> aptos move upgrade --profile testnet --existing-code 0x1234
--------------------------------------
Upgraded code at 0x1234 to latest version
```

## Reference Implementation

WIP

## Future Potential

Objects are infinitely extensible so in the future object code deployment can allow publishers to add custom resources/data/functionalities.

## Timeline

The intended timeline for this AIP is release 1.9
