---
aip: 63
title: Coin to Fungible Asset Migration
author: lightmark, davidiw, movekevin
Status: Draft
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
    - Automatically create a paired fungible asset metadata for a coin type at the coin creator address if it does not exist yet, including `AptosCoin`. Or the coin creator has the option to manually pair a fungible asset with a coin type.
    - Coin/Fungible Asset creator has the option to manually pair coin and fungible asset if neither is paired yet and all the conditions are met.
    - Create helper functions to convert between paired coin and fungible asset, with different visibilities.
    - To make the change compatible with existing dApps using move API in the current coin standard, this AIP proposes to change a couple of functions in coin module to convert coin and its paired fungible asset when needed to keep the same function signature.
- Lay out a comprehensive plan migrating from coin to fungible asset, with the following requirements:
    - Do not break any existing on-chain dapps.
    - Minimize the migration cost for both dapp devs and users, which means the migration process should be as minimally intrusive, more transparent as possible to them. Technically, this means the solution should be able to seamlessly handle situations in which a user has FA and Coin of the same asset type in the migration procedure.


### Out of Scope
- Force people to migrate their `CoinStore` to `PrimaryFungibleStore`

## Motivation

Before the widespread adoption of DeFi applications on the Aptos network, it's crucial to initiate a migration process to simplify the implementation of new dapps. Without this, developers would probably have to implement the same business logic on two seperate standards and the liquidity are split, which can be extremely cumbersome and unhealty to the whole Aptos ecosystem. Additionally, CeFi applications are likely to encounter similar challenges. The current disorganized state, with multiple asset standards, poses significant difficulties for both developers and users, necessitating prompt resolution.

## Impact

- Coin Creators: Each coin could be paired with one and only one fungible asset type. The existing capabilities such as `MintCapability`, `FreezeCapability`, and `BurnCapability` will be leveraged to generate the corresponding `MintRef`, `TransferRef`, and `BurnRef` for the paired fungible asset.
- Users: The process is designed to be smooth and uninterrupted, yet it necessitates proactive participation. The migration will be initiated when the user activates the migration function. Following the migration, all coins within a user's storage will be seamlessly transformed into their corresponding fungible asset forms and all the subsequence deposit will be redirected to the primary fungible store of the asset type.
- DApps:
  - Smart contract: Existing dApps based on the coin standard won't be disrupted by this migration, as it's designed to be non-breaking. Users interacting with these protocols may get either coin or FA of the same asset type depending on whether they migrated or not. Same for withdraw. Once the migration is complete, all accounts will have their coin represented as fungible asset, enabling the ecosystem to develop using the fungible asset API and issue new fungible assets without a paired coin. 
    - Indexing: The impact on indexing services may vary. It could be a significant change depending on how these services track balance and supply. 
    - Events: Post-migration, only events related to fungible assets will be emitted.
    - WriteSet Modifications: `CoinStore` will be removed when migration code is triggered, replaced by a primary fungible store. In some scenarios, both may coexist temporarily.
- Wallets:
  - Wallets must be updated to correctly display balances, aggregating the totals of coins and their paired fungible assets, depending on indexing.
  - Following the migration's completion and the emergence of fungible assets without paired coins, it's imperative for wallets to transition to the fungible asset move API, such as for asset transfers.

## Alternative solutions

1. Instead of auto-pairing, one alternative requires all coin creators to manually generate a corresponding fungible asset for each coin asset if it doesn't already exist, and register this in the mapping. However, several questions arise:
    - How should we handle `MintRef`, `TransferRef`, and `BurnRef`? What if the fungible asset does not have those?
    - What happens if the creator fails to create the fungible asset? This inaction could halt progress in migrating that particular coin type.
    - Some coin was initialized under a resource account that nobody has control of. There is no way to get the `signer` of those accounts to pair with an FA.

Advantages of the propsal over 1:
- Eliminates the need for manual intervention, no matter the coin creator is a normal account or resource account.
- Maintains the original semantics of `MintCapability`, `FreezeCapability`, and `BurnCapability`, ensuring consistency with the corresponding fungible asset.
 
2. Another alternative is an opt-in migration approach, where users explicitly approve to use FA as coin via an account-specific flag indicating whether they want to treat the paired coin and FA as the same asset or separate. In this case, if the user choose not migrate, APT FA sent to their account cannot be used as APT coin but a separate FA asset.
 
Advantages over option 2:
- Less intrusive to user and dapps.
    - Average users only care about their assets but not the technical format of those assets which they may not understand the concepts. If they get 10 APT FA but fail to see that in balance, they will panic.
    - Users don't have to enroll since the migration process will finally be promoted in a more aggresive way so the enrollment will not be necessary eventually.
    - Dapps will have less trouble to show the balance of a user depending on a flag under user's account. So the way to show balance will be consistent across different users.
- Provides a migration process that is transparent and requires no active participation from users.
- Avoid the flag resource and the cleanup afterwards.
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
public fun fungible_asset_to_coin<CoinType>(fungible_asset: FungibleAsset):
```

The paired fungible asset metadata address would be `0xA` for APT and arbitrary for other coins.

Note: This AIP does not prompt the reverse conversion so the visibility of `fungible_asset_to_coin` is not public. Whenever `coin_to_fungible_asset<CoinType>` is called and the paired fungible asset does not exist, the coin module will automatically create a fungible asset metadata and add it to the mapping as to pair with `CoinType`. This paired fungible asset will have exactly the same name, symbol and decimals with the coin type.

Function `maybe_convert_to_fungible_store` can remove the `CoinStore<CoinType>` and convert the coin left into the paired fungible asset and store it in the primary fungible store.
```rust

fun maybe_convert_to_fungible_store<CoinType>(account: address) acquires CoinStore, CoinConversionMap, CoinInfo {
    if (exists<CoinStore<CoinType>>(account)) {
        let CoinStore<CoinType> {
            coin,
            frozen,
            deposit_events,
            withdraw_events
        } = move_from<CoinStore<CoinType>>(account);
        event::emit(CoinEventHandleDeletion {
        event_handle_creation_address: guid::creator_address(event::guid(&deposit_events)),
        deleted_deposit_event_handle_creation_number: guid::creation_num(event::guid(&deposit_events)),
        deleted_withdraw_event_handle_creation_number: guid::creation_num(event::guid(&withdraw_events))});
        event::destory_handle(deposit_events);
        event::destory_handle(withdraw_events);
        let fungible_asset = coin_to_fungible_asset(coin);
        let metadata = fungible_asset::asset_metadata(&fungible_asset);
        let store = primary_fungible_store::ensure_primary_store_exists(account, metadata);
        fungible_asset::deposit(store, fungible_asset);
        // Note:
        // It is possible the primary fungible store may already exist before this function call.
        // In this case, if the account owns a frozen CoinStore and an unfrozen primary fungible store, this
        // function would convert and deposit the rest coin into the primary store and freeze it to make the
        // `frozen` semantic as consistent as possible.
        fungible_asset::set_frozen_flag_internal(store, frozen);
    };
}
```

`Supply` and `balance` are modified correspondingly to reflect the sum of coin and the paired fungible asset.

Also, to keep the capability semantics consistent, this AIP proposed 3 helper functions to generate the `MintRef`, `TransferRef` and `BurnRef` of the paired fungible asset from the `MintCapability`, `FreezeCapability` and `BurnCapability` of the coin so the move API from `fungible_asset.move` can be used too in new code.
```rust
    /// Get the `MintRef` of paired fungible asset of a coin type from `MintCapability`.
    public fun paired_mint_ref<CoinType>(_: &MintCapability<CoinType>): MintRef;

    /// Get the TransferRef of paired fungible asset of a coin type from `FreezeCapability`.
    public fun paired_transfer_ref<CoinType>(_: &FreezeCapability<CoinType>): TransferRef;

    /// Get the `BurnRef` of paired fungible asset of a coin type from `BurnCapability`.
    public fun paired_burn_ref<CoinType>(_: &BurnCapability<CoinType>): BurnRef;
```

### Case Study
Let's use APT coin as an example. Assume APT coin and FA are created and paired. 

1. Before a user deletes the `CoinStore<AptosCoin>` and convert APT to FA:
- Withdraw: APT coin will be drawn from `CoinStore<AptosCoin>` first. If its balance is not enough, then go withdraw more APT FA from `PrimaryFungibleStore` and convert it back to coin.
- Deposit: APT coin will be deposited to `CoinStore<AptosCoin>`. 
Note: Even user has not migrated the `CoinStore` they could get APT FA from other people via fungible asset module API but not coin module API.
    
2. After a user deletes the `CoinStore<AptosCoin>` and convert APT to FA:
- Withdraw: APT FA will all be withdrawn from APT `PrimaryFungibleStore` and converted back to coin.
- Deposit: APT coin will be converted to FA and deposited to APT `PrimaryFungibleStore`.

`coin::register` is not deprecated yet so it is possible that after a user deletes the `CoinStore`, it gets recreated again. So case 2 can go back to case 1 in rare cases. However, the goal of this AIP is not to get rid of this case but to allow the ecosystem dapps could still work perfectly with both coin and FA of the same asset type coexist under users' accounts.
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
When most users have their assets all in FA, We need new AIP to disble the coin creation and facilite the whole ecosystem to build on top of fungible asset module API and deprecated coin module.

## Timeline

### Suggested implementation/deployment timeline
Expected to be finished by v1.10 and deployed together with v1.10/v1.11 release, Q1 2024.

### Suggested developer platform support timeline
Q1 2024

## Security Considerations
The code needs a security review.
