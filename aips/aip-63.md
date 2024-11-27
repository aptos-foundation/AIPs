---
aip: 63
title: Coin to Fungible Asset Migration
author: lightmark, davidiw, movekevin
Status: Accepted
type: Standard
created: <12/05/2023>
---

# AIP-63 - Coin to Fungible Asset Migration

## Summary
[AIP-21](https://github.com/lightmark/AIPs/blob/main/aips/aip-21.md) introduced fungible asset (FA) standard aiming to replace the old coin standard to represent any fungible asset on chain, including but not limited to coin.
The evolving of Aptos ecosystem gradually necessitates the migration from coin framework to fungible asset framework for its superiority. This AIP aims to migrate migrating from coin to fungible asset in a seamless way that the impact to existing ecosystem projects and users is as small as possible. 

This AIP proposes a global mapping between coin and fungible asset and allow `coin` module to treat paired coin and fungible asset interchangeably and facilitates the migration by converting `CoinStore<CoinType>` to the primary fungible store of the paired fungible asset whenever possible.

### Goals

The goal is to This AIP intends to achieve the following:
- Start exposing FAs of existing coins to the ecosystem, so that they can prepare dapps and apps for FAs (FA only in the future). DeFi, wallets, and other applications can seamlessly understand FA and equivalent coin and use them equivalently and transparently via coin module.
    - Automatically create a paired fungible asset metadata for a coin type at the coin creator address if it does not exist yet, including `AptosCoin`.
    - Create helper functions to convert between paired coin and fungible asset, with different visibilities.
    - To make the change compatible with existing dApps using move API in the current coin standard, this AIP proposes to change a couple of functions in coin module to convert coin and its paired fungible asset when necessary but keep the same function signature.
- Give users option to migrate their `CoinStore<CoinType>` to `PrimaryFungibleStore` of the corresponding FA at any time to experience dapps built upon FA standard only.
- Lay out a comprehensive plan migrating from coin to fungible asset, with the following requirements:
    - Do not break any existing on-chain dapps.
    - Minimize the migration cost for both dapp devs and users, which means the migration process should be as minimally intrusive, more transparent as possible to them. Technically, this means the solution should be able to seamlessly handle situations in which a user has FA and Coin of the same asset type in the migration procedure.


### Out of Scope
- Coerce user to migrate their `CoinStore` to `PrimaryFungibleStore`
- Make `PrimaryFungibleStore` of APT FA default to replace `CoinStore<AptosCoin>` for new account.

## Motivation

Before the widespread adoption of DeFi applications on the Aptos network, it's crucial to initiate a migration process to simplify the implementation of new dapps. Without this, developers would probably have to implement the same business logic on two seperate standards and the liquidity are split, which can be extremely cumbersome and unhealty to the whole Aptos ecosystem. Additionally, CeFi applications are likely to encounter similar challenges. The current disorganized state, with multiple asset standards, poses significant difficulties for both developers and users, necessitating prompt resolution.

## Impact

- Coin Creators: Each coin could be paired automatically with only one fungible asset type, created by the framework automatically. The existing capabilities such as `MintCapability`, `FreezeCapability`, and `BurnCapability` will be leveraged to get the corresponding `MintRef`, `TransferRef`, and `BurnRef` for the paired fungible asset.
- Users: The process is designed to be smooth and uninterrupted, yet it necessitates proactive participation. The migration will be initiated when the user activates the migration function. Following the migration, all coins within a user's storage will be seamlessly transformed into their corresponding fungible asset forms and all the subsequence deposit will be redirected to the primary fungible store of the asset type.
- DApps:
  - Smart contract: Existing dApps based on the coin standard won't be disrupted by this migration, as it's designed to be non-breaking. Users interacting with these protocols may get either coin or FA of the same asset type depending on whether they migrated or not. Same for withdraw. Once the migration is complete, all accounts will have their coin represented as fungible asset, enabling the ecosystem to develop using the fungible asset API and issue new fungible assets without a paired coin. 
    - Indexing: The impact on indexing services may vary. It could be a significant change depending on how these services track balance and supply. 
    - Events: Post-migration, only events related to fungible assets will be emitted.
    - WriteSet Modifications: `CoinStore` will be removed when migration code is triggered, replaced by a primary fungible store. Once the user has primary fungible store created, she can never resurrect `CoinStore` so the migration is not reversible. If a user does not migrate but get FA via `primary_fungible_store` module, she can have both `CoinStore` and primary fungible store. But once she migrates, she will only have primary fungible store for this asset.
- Wallets:
  - Wallets must be updated to correctly display balances, aggregating the totals of coins and their paired fungible assets, depending on indexing.
  - Following the migration's completion and the emergence of fungible assets without paired coins, it's imperative for wallets to transition to the fungible asset move API, such as for asset transfers.

## Alternative solutions

1. Instead of auto-pairing, one alternative requires all coin creators to manually generate a corresponding fungible asset for each coin asset if it doesn't already exist, and register this in the mapping. However, several questions arise:
    - How should we handle `MintRef`, `TransferRef`, and `BurnRef`? What if the fungible asset does not have those?
    - What happens if the creator fails to create the fungible asset? This inaction could halt progress in migrating that particular coin type.
    - Some coin was initialized under a resource account that nobody has control of. There is no way to get the `signer` of those accounts to pair with an FA.

Advantages of the proposal over 1:
- Eliminates the need for manual intervention, no matter the coin creator is a normal account or resource account.
- Maintains the original semantics of `MintCapability`, `FreezeCapability`, and `BurnCapability`, ensuring consistency with the corresponding fungible asset.
 
2. Another alternative is an opt-in migration approach, where users explicitly approve to use FA as coin. In this case, if the user choose not migrate, APT FA sent to their account cannot be treated as APT coin but a separate FA asset.
 
Advantages over option 2:
- Less intrusive to user and dapps.
    - Average users only care about their assets but not the technical format of those assets which they may not understand the concepts. If they get 10 APT FA but fail to see that in balance, they will panic.
    - Dapps will have less trouble to show the balance of a user depending on a flag under user's account. So the way to show balance will be consistent across different users.
- Provides a migration process that is transparent and requires less hassle from users.
- Addresses the issue of fragmented asset types transparently to users, which hinders the adoption and development of fungible asset standards. For instance, dApps may not function properly for users with a balance composed of both coin and fungible assets but not exclusively fungible assets. For example, a transaction would fail if a user attempts to transfer 20 APT using `fungible_asset::transfer` but only has 10 APT coins and 10 APT FA.
- Option 2 doesn't reduce but increase engineering efforts, either internally or externally. In the long run, teams will still need to meet all requirements outlined in this proposal.

## Specification
A `CoinConversionMap` will be stored under `@aptos_framework`:
```rust
    /// The mapping between coin and fungible asset.
    struct CoinConversionMap has key {
        coin_to_fungible_asset_map: Table<TypeInfo, address>,
    }
```
The reverse mapping is realized by insert a `PairedCoinType` resource into the fungible asset metadata object:
```rust
/// The paired coin type info stored in fungible asset metadata object.
    struct PairedCoinType has key {
        type: TypeInfo,
    }
```

Those two helper functions perform the conversion:
```rust
// Conversion from coin to fungible asset
public fun coin_to_fungible_asset<CoinType>(coin: Coin<CoinType> ): FungibleAsset;

// Conversion from fungible asset to coin. Not public to push the migration to FA.
public(friend) fun fungible_asset_to_coin<CoinType>(fungible_asset: FungibleAsset):
```

The paired fungible asset metadata address would be `0xA` for APT and arbitrary for other coins.

Note: This AIP does not prompt the reverse conversion so the visibility of `fungible_asset_to_coin` is not public. Whenever `coin_to_fungible_asset<CoinType>` is called and the paired fungible asset does not exist, the coin module will automatically create a fungible asset metadata and add it to the mapping as to pair with `CoinType`. This paired fungible asset will have exactly the same name, symbol and decimals with the coin type.

Function `maybe_convert_to_fungible_store` can remove the `CoinStore<CoinType>` if exists and convert the coin left into the paired fungible asset and store it in the primary fungible store.

```rust
    fun maybe_convert_to_fungible_store<CoinType>(account: address) acquires CoinStore, CoinConversionMap, CoinInfo {
        if (!features::coin_to_fungible_asset_migration_feature_enabled()) {
            abort error::unavailable(ECOIN_TO_FUNGIBLE_ASSET_FEATURE_NOT_ENABLED)
        };
        let metadata = ensure_paired_metadata<CoinType>();
        let store = primary_fungible_store::ensure_primary_store_exists(account, metadata);
        let store_address = object::object_address(&store);
        if (exists<CoinStore<CoinType>>(account)) {
            let CoinStore<CoinType> { coin, frozen, deposit_events, withdraw_events } = move_from<CoinStore<CoinType>>(
                account
            );
            event::emit(
                CoinEventHandleDeletion {
                    event_handle_creation_address: guid::creator_address(
                        event::guid(&deposit_events)
                    ),
                    deleted_deposit_event_handle_creation_number: guid::creation_num(event::guid(&deposit_events)),
                    deleted_withdraw_event_handle_creation_number: guid::creation_num(event::guid(&withdraw_events))
                }
            );
            event::destory_handle(deposit_events);
            event::destory_handle(withdraw_events);
            fungible_asset::deposit(store, coin_to_fungible_asset(coin));
            // Note:
            // It is possible the primary fungible store may already exist before this function call.
            // In this case, if the account owns a frozen CoinStore and an unfrozen primary fungible store, this
            // function would convert and deposit the rest coin into the primary store and freeze it to make the
            // `frozen` semantic as consistent as possible.
            fungible_asset::set_frozen_flag_internal(store, frozen);
        };
        if (!exists<MigrationFlag>(store_address)) {
            move_to(&create_signer::create_signer(store_address), MigrationFlag {});
        }
    }
```

When a CoinStore<CoinType> is decommissioned, with its remaining coins being transferred into the corresponding fungible asset, a `CoinEventHandleDeletion` event is triggered. This serves as a notification to observers, signaling the impending deletion of event handle identifiers for record.
At the same time, if `maybe_convert_to_fungible_store` is called, the framework will create a `MigrationFlag` resource in the primary fungible store object indicates the user has migrated. Based on this flag, the API's behavior within the `coin` module will vary, as detailed in the case study provided.

`Supply` and `balance` are modified correspondingly to reflect the sum of coin and the paired fungible asset.

Also, to keep the capability semantics consistent, this AIP proposed 3 sets of helper functions to temporarily get the `MintRef`, `TransferRef` and `BurnRef` of the paired fungible asset from the `MintCapability`, `FreezeCapability` and `BurnCapability` of the coin so the move API from `fungible_asset.move` can be used too in new code.
For example, the set of helper for `MintRef` is:

```rust
#[view]
/// Check whether `MintRef` is not taken out.
public fun paired_mint_ref_exists<CoinType>(): bool;

/// Get the `MintRef` of paired fungible asset of a coin type from `MintCapability` with a hot potato receipt.
public fun get_paired_mint_ref<CoinType>(_: &MintCapability<CoinType>): (MintRef, MintRefReceipt);

/// Return the `MintRef` after usage with the hot potato receipt.
public fun return_paired_mint_ref(mint_ref: MintRef, receipt: MintRefReceipt);
```

It is noted that "Hot Potato" pattern is adopted here to make sure the only one copy of `MintRef` can be "borrowed" with `&MintCapability` but must be returned in the same transaction at the end.
The definitino of `MintRefReceipt` is:
```rust
// The hot potato receipt for flash borrowing MintRef.
struct MintRefReceipt {
    metadata: Object<Metadata>,
}
```
Same pattern is also adopted for `TransferRef` and `BurnRef`.


### Case Study

Let's use APT coin as an example. Assume APT coin and FA are created and paired. 

#### Case 1
For user A who opts into this migration:
- If the migration is triggered, user A's coins for that `CoinType` are all converted from `CoinStore` into `PrimaryFungibleStore` w/ `MigrationFlag`. `CoinStore` is deleted.
- If more coins of that type are sent to user A, those coins will be automatically converted into FA via `coin::deposit`.
- For user A, `coin::balance` takes into account the user's FA balance.
- If `coin::withdraw` is called on A's account, it'll convert the specified amount of FA back into coins.
- if `CoinType` is APT, to pay for gas, coin::burn_from will burn from A's `PrimaryFungibleStore` of APT.

#### Case 2
For another user B who didn't opt into this migration:
- Someone sends them the corresponding FA through `primary_fungible_store::deposit`.
- Now user B has both `CoinStore` and `PrimaryFungibleStore` w/o `MigrationFlag` for this asset type.
- If more coins are sent to user B, these coins are deposited into `CoinStore`.
- `coin::balance` takes the balance from both `CoinStore` and `PrimaryFungibleStore`.
- `coin::withdraw` will withdraw from `CoinStore` first and then `PrimaryFungibleStore` if there's any deficit.

#### Case 3
For a new user C and specifically APT:
- APT is transferred to C's address, this calls `account::create_account` if their account doesn't exist on chain. `CoinStore<AptosCoin>` is still created
and now user C can follow the path of user A or B

#### Case 4
For user D who has not created an account on chain:
- User D sends a sponsored transaction (someone else paying for this transaction).
- The gas fee payer flow recognizes user D's account doesn't exist yet (no sequence number). It automatically creates the account by calling [account::create_account_if_does_not_exist](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/aptos-vm/src/aptos_vm.rs#L538)
User's D account is now created on chain but doesn't have a CoinStore associated.
- Someone sends user D APT as FA. Now User D has a `PrimaryFungibleStore` of APT w/o `MigrationFlag`.
- User D can pay for gas from their FungibleStore and can send transactions on their own.
- User D opts into FA migration for APT (still sponsored). There's no `CoinStore` to delete. `PrimaryFungibleStore` of APT is already created
- User D is good from now similar to user A.

#### Case 5
For user E:
User E opts into the FA migration and now has a `PrimaryFungibleStore` of APT with `MigrationFlag` and no `CoinStore<AptosCoin>`:
- Someone calls `coin::register<AptosCoin>` for user E. This errors out and not allowed for users who have opted in with `MigrationFlag`. This wouldn't apply to user D before step 6 in their flow.

`coin::is_account_registered` and `coin::register` are not deprecated yet but modified so `CoinStore<T>` cannot be created if the user has their primary fungible store of the paired FA of coin `T` created. So users of case 2 can never go back to case 1.
For the long term plan, please refer to the [future plan](#future-potential)

## Reference Implementation
https://github.com/aptos-labs/aptos-core/pull/11224

## Testing (Optional)

Verified thoroughly with unit tests. Will deploy to devnet and test manually.

## Risks and Drawbacks

- Any new Dapp calling fungible asset move API will not work with accounts who have not migrated yet.
- Coin not stored in `CoinStore` cannot be migrated by this AIP. People have to manually migrate them but as a framework can never know whether this process finishes or not.

## Future Potential

### Phase 1
This AIP is just the first phase of the migration plan. So if a user does not migrate their `CoinStore` proactively and they don't get FA via fungible asset API, there is no behavior change from the user's point of view.

### Phase 2
All the dapps/exchanges/wallets have to update the view of balance, from tracking only the `CoinStore` balance to the sum of `CoinStore` and `PrimaryFungibleStore` balances.

### Phase 3
Disable the creation of any new `CoinStore`. Then
- Migrate the `CoinStore<AptosCoin>` of all the existing account to APT `PrimaryFungibleStore`.
- Trigger the migration inside `Withdraw<CoinType>` and `Deposit<CoinType>` function of any `CoinType` to help the migration of other coin types implicitly when users interacts with those assets.

### Phase 4
When most users have their assets all in FA, we need a new AIP proposing disabling new coin creation and facilitate the whole ecosystem to build on top of fungible asset module API and deprecated coin module.

## Timeline

### Suggested implementation/deployment timeline
Expected to be finished by v1.10 and deployed together with v1.10/v1.11 release, Q1 2024.

### Suggested developer platform support timeline
Q1 2024

## Security Considerations
The code needs a security review.
