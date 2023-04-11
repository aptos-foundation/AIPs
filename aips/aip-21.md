---
aip: 21
title: Fungible Asset Standard using objects
author: lightmark
Status: Draft
type: Standard (Framework)
created: 04/11/2022
---

# AIP-21 - Fungible Asset using objects

## Summary

This AIP proposes a standard of Fungible Asset (FA) using Move Objects. In this model, any object, which is called **
Metadata** in the standard, can be used as metadata to issue fungible asset units. This standard provides the building
blocks for applications to explore the possibilities of fungibility.

## Motivation

We are eager to build fungible asset on Aptos as it plays an critical role in the Web3 ecosystem beyond cryptocurrency.
it enables the tokenization of various assets, including commodities, real estate, and financial instruments, and
facilitate the creation of decentralized financial applications.

- Tokenization of securities and commodities provides fractional ownership, making these markets more accessible to a
  broader range of investors.
- Fungible tokens can also represent ownership of real estate, enabling fractional ownership and providing liquidity to
  the traditionally illiquid market.
- In-game assets such as virtual currencies and characters can be tokenized, enabling players to own and trade their
  assets, creating new revenue streams for game developers and players.

Besides aforementioned features, fungible asset is a superset of cryptocurrency as coin is just one type of fungible
asset. Coin module in Move could be replaced by fungible asset framework.

## Rationale

The rationale is two-folds:

We witnessed an drastically increasing needs of fungible asset framework from Aptos community and partners. The earlier
coin module is obsolete and insufficient for today's needs partially due to the rigidity of Move structs and the
inherently poor extensibility that it’s built upon. Also, the basic model of authorization management is not flexible
enough to enable creative innovations of fungible asset policy.

The old coin module has a noticeable deficiency that the `store` ability makes ownership tracing a nightmare. Therefore,
it is not amenable to centralized management such as account freezing because it is not programmably feasible to find
all the coins belonging to an account.

fungible asset framework is born to solve both issues.

## Specification

`fungible_asset::Metadata` serves as metadata or information associated with a kind of fungible asset. Any object with
fungibility has to be extended with this resource and then become the metadata object. It is noted that this object can
have other resources attached to provide richer context. For example, if the fungible asset represents a gem, it can
hold another `Gem` resource with fields like color, size, quality, rarity, etc.

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

Each account can own multiple `FungibleStore`s but only one is primary and the rest are called secondary stores. The
primary store address is deterministic, `hash(owner_address | metadata_address | 0xFC)`. Whereas the secondary store
could be created when needed.

The difference between primary and secondary stores are summarized as:

1. Primary store address is deterministic to the owner account so there is no need to index.
2. Primary store supports unilateral sending so that it will be created on demand if not exist. Whereas secondary ones
   do not.
3. Primary store cannot be deleted.

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

- Make an asset fungible is not an irreversible operation and there is no way to clear the fungible asset data if not
  needed any more.
- The solution to use primary store is not perfect in that the same `DeriveRef` could also be used by other module to
  squat the primary store object. This requires the creator of metadata to bear that in mind. So we limit the function
  can be only called by `primary_store` module for now. The reason behind this is the name deriving scheme does not have
  native domain separator for different modules.

## Future Potential

There is still some room for improvements of management capabilities and the way to locate fungible asset objects. Once
we have a powerful indexer with a different programming model then it may be unnecessary to have primary store anymore.

## Suggested implementation timeline

By end of March.

## Suggested deployment timeline

on Devnet by early April, on Testnet by mid April and Mainnet by early May.
