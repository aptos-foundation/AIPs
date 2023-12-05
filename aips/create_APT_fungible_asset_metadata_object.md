---
aip: 
title: Create Aptos native fungible asset metadata object at 0x1
author: lightmark, davidiw, movekevin
Status: Draft
type: Standard
created: <12/05/2023>
---

# AIP-X - Create Aptos native fungible asset metadata object at 0x1.
  
## Summary

in [AIP-21](https://github.com/lightmark/AIPs/blob/main/aips/aip-21.md), fungible asset standard has been introduces aiming to replace the old coin standard to represent any fungible asset on chain, including but not limited to coin.
The evolving of Aptos ecosystem gradually necessitates the migration from coin framework to fungible asset framework for its superiority. To kickoff the migration process, Aptos should first introduce its own native fungible asset that's equivalent to the current `AptosCoin`.

### Goals
- Create an APT fungible asset metadata object at 0x1 with same metadata as AptosCoin.

### Out of Scope
- How to migrate from coin to fungible asset.
- How to use coins and their corresponding fungible asset interchangeably.
Those questions will be answered by a follow-up AIP.

## Motivation
- Start to adopt the new fungible asset standard for the native asset on Aptos network.

## Impact
- N/A

## Specification

add `initialize_aptos_fungible_asset` to `aptos_coin.move` that can be called by `@aptos_framework` to create APT fungible asset at 0x1 and another caller function with the same name in `genesis.move` to generate corresponding fungible asset refs in required modules.

## Reference Implementation

Add the following function to `aptos_coin.move`:
```rust
    // Initialize the APT fungible asset once via governance proposal.
    public(friend) fun initialize_aptos_fungible_asset(aptos_framework: &signer): ConstructorRef {
        assert_aptos_framework(aptos_framework);
        let cref = object::create_object_at_address(@aptos_framework, false);
        primary_fungible_store::create_primary_store_enabled_fungible_asset(&cref,
            option::none(),
            string::utf8(b"Aptos Coin"),
            string::utf8(b"APT"),
            8,
            string::utf8(b"https://aptosfoundation.org/brandbook/logomark/PNG/Aptos_mark_WHT.png"),
            string::utf8(b"https://aptosfoundation.org/"),
        );
        coin::add_to_coin_conversion_map<AptosCoin>(
            aptos_framework,
            object::object_from_constructor_ref<Metadata>(&cref)
        );
        cref
    }
```
Add the following function to `genesis.move`:
```rust
    public fun initialize_aptos_fungible_asset(aptos_framework: &signer) {
        let cref = &aptos_coin::initialize_aptos_fungible_asset(aptos_framework);
        stake::store_aptos_fungible_asset_mint_ref(aptos_framework, fungible_asset::generate_mint_ref(cref));
        transaction_fee::initialize_aptos_fungible_asset_refs(
            aptos_framework,
            cref
        );
    }
```
And add the following function to `stake.move`:
```rust
    /// Aptos fungible asset refs, set during initialization and stored in @CoreResource account.
    /// This allows the Stake module to mint rewards to stakers.
    struct AptosFungibleAssetRefs has key {
        mint_ref: MintRef,
    }

    /// This is only called during initialization by governance proposal in genesis module, which is where MintRef can
    /// be created. Beyond initialization, no one can create Aptos fungible asset mint/burn refs.
    public(friend) fun store_aptos_fungible_asset_mint_ref(aptos_framework: &signer, mint_ref:     MintRef) {
        system_addresses::assert_aptos_framework(aptos_framework);
        move_to(aptos_framework, AptosFungibleAssetRefs { mint_ref })
    }
```

## Testing

The solution can be well tested with unit tests. Significant coverage is expected. Can be manually tested later.

## Risks and Drawbacks
This AIP itself does not have any risks.

## Future Potential
This AIP starts the migration process from APT coin to APT fungible asset. In the long run, we expect all the APT on chain would be in the form of fungible asset except for some corner cases.

## Timeline

### Suggested timeline
Expected to be finished by v1.9 and deployed together with v1.9 release, Dec 2023.
But the governance proposal to call the `initialize_aptos_fungible_asset` function will be postponed to Q1 2024 or even later.

## Security Considerations
The AIP itself does not have security considerations.
