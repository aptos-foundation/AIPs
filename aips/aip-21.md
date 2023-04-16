---
aip: 21
title: Fungible Asset Standard
author: lightmark, movekevin, davidiw
Status: Draft
type: Standard (Framework)
created: 04/11/2022
---

# AIP-21 - Fungible Assets

## Summary

This AIP proposes a standard for Fungible Assets (FA) using Move Objects. In this model, any on-chain asset represented as an object can also be expressed as a fungible asset allowing for a single object to be represented by many distinct, yet interchangeable units of ownership.

## Motivation

Deriving fungible assets out of objects allows for both a seamless developer experience but also simplifies application development time. This standard supports potential applicatoins like

- The tokenization of securities and commodities provides fractional ownership.
- Ownership of real estate, enabling fractional ownership and providing liquidity to the traditionally illiquid market.
- In-game assets such as virtual currencies and characters can be tokenized, enabling players to own and trade their   assets, creating new revenue streams for game developers and players.

Besides aforementioned features, a fungible asset provides a super set of existing Aptos Coin standard concepts along with properties, common to objects, that ensure that healthy ecosystems can be formed around these assets.

## Rationale

The rationale is two-folds:

Since Mainnet launch, the existing coin module has been deemed insufficient for current and future needs due to the rigidity of Move structs and the inherently poor extensibility. For example, there's no mechanism that enforces transfers take a certain path or that only certain parties may own said assets. In short, the existing model of authorization management is not flexible enough to enable creative innovations of fungible asset policy.

The root of these issues is two fold:
* The existing `Coin` struct leverages the `store` ability allowing for assets on-chain to become untraceable. Creating challenges to off-chain observability and on-chain management, such as freezing or burning.
* Lack of access modifiers preventing managers of `Coin`s to dictate requirements for transfer.

Fungible assets addresses these issues.

## Specification

`fungible_asset::Metadata` serves as metadata or information associated with a kind of fungible asset. An object with this resource is now a fungible resource, where ownership of this resource can be represented by a `FungibleAsset` amount. An object can have other resources attached to provide additional context. For example, the metadata could define a gem of a given type, color, quality, and rarity, where ownership indicates the quantity or total weight owned of that type of gem.

```rust
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Define the metadata required of an metadata to be fungible.
struct Metadata has key {
/// The current supply of the fungible asset.
supply: u64,
/// The maximum supply limit where `option::none()` means no limit.
maximum: Option<u64>,
/// Name of the fungible metadata, i.e., "USDT".
name: String,
/// Symbol of the fungible metadata, usually a shorter version of the name.
/// For example, Singapore Dollar is SGD.
symbol: String,
/// Number of decimals used for display purposes.
/// For example, if `decimals` equals `2`, a balance of `505` coins should
/// be displayed to a user as `5.05` (`505 / 10 ** 2`).
decimals: u8,
}
```

`FungibleStore` only resides in an object as a container/holder of the balance of a specific fungible asset.

`FungibleAsset` is an instance of fungible asset as
a [hot potato](https://medium.com/@borispovod/move-hot-potato-pattern-bbc48a48d93c)

```rust
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// The store object that holds fungible assets of a specific type associated with an account.
struct FungibleStore has key {
/// The address of the base metadata object.
metadata: Object<Metadata>,
/// The balance of the fungible metadata.
balance: u64,
/// Fungible Assets transferring is a common operation, this allows for freezing/unfreezing accounts.
allow_ungated_balance_transfer: bool,
}

/// FungibleAsset can be passed into function for type safety and to guarantee a specific amount.
/// FungibleAsset is ephermeral that it cannot be stored directly and will have to be deposited back into a store.
struct FungibleAsset {
    metadata: Object<Metadata>,
    amount: u64,
}
```

### Primary and Secondary Stores

Each account can own multiple `FungibleStore`s but only one is primary and the rest are called secondary stores. The primary store address is deterministic, `hash(owner_address | metadata_address | 0xFC)`. The secondary stores are created as needed and derived typically from GUID-based objects.

The key features of a primary store are:

1. The primary store object address is deterministic so that transactions cam seamlessly access with knowledage of owner's account address.
2. Primary stores will be created upon transferring of assets if they do not exist.
3. A primary store cannot be deleted.

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/7183](https://github.com/aptos-labs/aptos-core/pull/7183)

[https://github.com/aptos-labs/aptos-core/pull/7379](https://github.com/aptos-labs/aptos-core/pull/7379)

[https://github.com/aptos-labs/aptos-core/pull/7608](https://github.com/aptos-labs/aptos-core/pull/7608)

### Fungible asset main APIs

```rust
public entry fun transfer<T: key>(
sender: & signer,
from: Object<T>,
to: Object<T>,
amount: u64,
)
public fun withdraw<T: key>(
owner: & signer,
store: Object<T>,
amount: u64,
): FungibleAsset
public fun deposit<T: key>(store: Object<T>, fa: FungibleAsset)
public fun mint( ref: & MintRef, amount: u64): FungibleAsset
public fun mint_to<T: key>( ref: & MintRef, store: Object<T>, amount: u64)
public fun set_ungated_transfer<T: key>( ref: & TransferRef, store: Object<T>, allow: bool)
public fun burn( ref: & BurnRef, fa: FungibleAsset)
public fun burn_from<T: key>(
ref: & BurnRef,
store: Object<T>,
amount: u64
)
public fun withdraw_with_ref<T: key>(
ref: & TransferRef,
store: Object<T>,
amount: u64
)
public fun deposit_with_ref<T: key>(
ref: & TransferRef,
store: Object<T>,
fa: FungibleAsset
)
public fun transfer_with_ref<T: key>(
transfer_ref: & TransferRef,
from: Object<T>,
to: Object<T>,
amount: u64,
)
```

### Fungible store main APIs

```rust
# [view]
public fun primary_store_address<T: key>(owner: address, metadata: Object<T>): address

# [view]
/// Get the balance of `account`'s primary store.
public fun balance<T: key>(account: address, metadata: Object<T>): u64

# [view]
/// Return whether the given account's primary store can do direct transfers.
public fun ungated_balance_transfer_allowed<T: key>(account: address, metadata: Object<T>): bool

/// Withdraw `amount` of fungible asset from `store` by the owner.
public fun withdraw<T: key>(owner: & signer, metadata: Object<T>, amount: u64): FungibleAsset

/// Deposit `amount` of fungible asset to the given account's primary store.
public fun deposit(owner: address, fa: FungibleAsset)

/// Transfer `amount` of fungible asset from sender's primary store to receiver's primary store.
public entry fun transfer<T: key>(
sender: & signer,
metadata: Object<T>,
recipient: address,
amount: u64,
)
```

## Risks and Drawbacks

- Making an asset fungible is not an irreversible operation and there is no way to clear the fungible asset data if not
  needed any more. Though one could burn all representations of that fungible asset.
- The use of primary stores has some implication on performance as the application must perform a sha-256 hashing algorithm to access each asset in a transaction. At the same time, object indexers are still in their infancy and secondary stores are not readily available.

## Future Potential

As this standard stabilizies, we anticipate SDK and indexing solutions to eliminate the need for the primary store allowing for clearer transaction transcripts as well as a path towards better parallelization of transactions on-chain.

## Suggested deployment timeline

on Devnet by early April, on Testnet by mid April and Mainnet by early May.
