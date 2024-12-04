---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Aptos Hybrid Assets Standard
author: @gregnazario
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): 10/15/2024
type: Ecosystem
created: 10/3/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Aptos Hybrid Assets

## Summary

On Ethereum, we've seen the rise of ERC-404 / [DN-404](https://github.com/Vectorized/dn404) tokens. These tokens are
standards combine a fungible token with a non-fungible token. This AIP proposes a standard for a Dn404 like experience
on Aptos.

This provides the ability to trade fungible assets for fractional ownership of an NFT directly in a liquidity pool. The
goal here is to add liquidity to NFTs directly.

### Out of scope

We are not covering the specifics of liquidity pools, that should already be handled automatically by any existing
providers.

## High-level Overview

From a high level, when a user deposits a set number of fungible assets into an account (let's say one whole asset),
they will receive an NFT in their account. When a user drops below the set number of fungible assets, the NFT will be
removed from their account. Additionally, NFTs can be transferred directly to other users, and the fungible asset will
go with it.

The following properties must hold:

* There is a fixed set of NFTs and fungible assets, which have a 1:X relationship, where X is the number of fungible
  assets per NFT.
* There may be fewer NFTs than the ratio, but not more NFTs than the 1:X ratio.
* Whenever an NFT is transferred, the fungible assets must be transferred with it.
* Whenever the FAs are transferred, the NFTs must be burned or removed, and then minted or added to the new owners
  accordingly.
* When NFTs are transferred due to FA being transferred, there should be some randomness associated.

## Impact

NFT marketplaces and wallets will need to support the direct transfer of NFTs with fungible assets. This will allow them
to ensure the properties above.

## Alternative Solutions

The alternative solution would be to have a non-standard way of creating these collections, which would cause
fragmentation in nft marketplace, decentralized exchange, and wallet experiences.

## Specification and Implementation Details

A new contract will be deployed to `0xbbe8a08f3b9774fccb31e02def5a79f1b7270b2a1cb9ffdc05b2622813298f2a`, which will be a
factory for future hybrid NFTs. The contract will be deployed to a resource account, specifically to allow anyone to
mint collections from it. Additionally, users can create extensions to the collection by creating new contracts that
use the base contract.

When creating a collection, the user will need to provide the following:

```move
module hybrid_address::hybrid {
    public fun create(
        caller: &signer,
        // Collection inputs
        collection_name: String,
        collection_description: String,
        collection_uri: String,
        // NFT inputs
        hidden_nft_name: String,
        hidden_nft_uri: String,
        hidden_nft_description: String,
        num_supply_nfts: u64,
        num_tokens_per_nft: u64,
        royalty_numerator: u64,
        royalty_denominator: u64,
        royalty_address: address,
        with_properties: bool,
        // FA Inputs
        fa_name: String,
        symbol: String,
        decimals: u8,
        icon_uri: String,
        project_uri: String,
        withdraw_function: Option<FunctionInfo>,
        deposit_function: Option<FunctionInfo>
    ): ConstructorRef {}
}
```

This will then create a new collection, which will be co-located with the Fungible Asset metadata. The collection will
then have a couple of new functions:

### Minting

The initial mint should exist to allow the creation of the collection. I've separated it from the initial collection
creation
to ensure that the entire collection can be minted, regardless of the number of NFTs.

```move
module hybrid_address::hybrid {
    /// Mints FAs for the NFT collection, this is limited by the supply given earlier when creating the FA.
    ///
    /// Minting is limited to the owner of the collection.  Keep in mind that this is currently not limited other than the
    /// maximum supply.
    entry fun mint(
        caller: &signer,
        collection: Object<HybridCollection>,
        receiver: address,
        amount: u64
    ) acquires HybridCollection, ObjectController, AssetRefs, HybridConfig, HybridOwnershipData {}
}
```

### FA Transfer

This will use dynamic dispatch to replace the NFTs directly in the collection. To save on gas, it will pull the NFTs
from a pool, and assign a random seed. This seed will be used to reveal art with the `reveal` function. Prior to that
the NFTs can be transferred directly as unknown, but with a name attached. Note that it cannot reveal art directly with
randomness at this stage, or someone could do a test-and-abort attack.

```move
module hybrid_address::hybrid {
    /// Transfer provides functionality used for dynamic dispatch
    ///
    /// This will not be called by any other functions.
    public fun withdraw<T: key>(
        store: Object<T>,
        amount: u64,
        transfer_ref: &fungible_asset::TransferRef
    ): FungibleAsset acquires HybridToken, HybridConfig, ObjectController, HybridOwnershipData {
        pre_withdraw_burn(store, amount);
        fungible_asset::withdraw_with_ref(transfer_ref, store, amount)
    }

    /// Transfer provides functionality used for dynamic dispatch
    ///
    /// This will not be called by any other functions.
    public fun deposit<T: key>(
        store: Object<T>,
        fa: FungibleAsset,
        transfer_ref: &fungible_asset::TransferRef
    ) acquires HybridCollection, ObjectController, HybridConfig, HybridOwnershipData {
        let amount = fungible_asset::amount(&fa);
        pre_deposit_mint(store, amount);
        fungible_asset::deposit_with_ref(transfer_ref, store, fa)
    }
}
```

### Controlled transfer

Transfers need to be overridden in order to ensure that NFTs are transferred with the fungible assets. This will need
to be called directly by wallets, and other functions. There is no risk of randomness here, as the NFT will not change.

```move
module hybrid_address::hybrid {
    /// This function replaces [`0x1::object::transfer`], as object transfer had to be disabled, since it doesn't support
    /// dynamic dispatch.  Instead, this function should be used to transfer the NFT.
    ///
    /// Note: Transfer NFT will fail to transfer if you do not have enough FA in your primary fungible store.  If that's
    /// the case, you will need to transfer FA first to the primary store.
    public entry fun transfer<T: key>(
        caller: &signer,
        token: Object<T>,
        receiver: address
    ) acquires ObjectController, AssetRefs, HybridConfig, HybridOwnershipData {}
}
```

### Reveal

Transfers need to be overridden in order to ensure that NFTs are transferred with the fungible assets. This will need
to be called directly by wallets, and other functions. There is no risk of randomness here, as the NFT will not change.
The wrapping contract will need to save the reveal ref in order to handle the reveal.

```move
module hybrid_address::hybrid {
    /// Reveals the collection, must have the reveal ref
    public fun reveal(
        reveal_ref: &RevealRef,
        token: Object<HybridToken>,
        new_name: Option<String>,
        new_desc: Option<String>,
        new_uri: Option<String>,
        only_reveal_once: bool,
    ) acquires HybridToken {}
}
```

## Reference Implementation

- https://github.com/gregnazario/aptos-hybrid-assets

## Testing

This will need unit testing across the standard, to ensure that there are no holes in the contract. Results will be in
a week once it's completed.

## Risks and Drawbacks

- Potential drawback is adoption of marketplaces and wallets to use the new transfer function. With dynamic dispatch it
  could be replaced with a more flexible solution.
    - The mitigation plan is to provide help to wallets and marketplaces to adopt the new standard via a helper
      function.
- For future backward compatibility, depending on how the dynamic dispatch solution is provided, it may be necessary to
  change the contract, or create a new contract altogether.
    - The mitigation plan is to in the future provide a migration plan for future hybrid nfts.

## Security Considerations

This AIP doesn't impact the security of the network, but it does need to keep in mind to prevent test and abort attacks
on randomness.

## Future Potential

In the future, pure dynamic dispatch would work well to replace this. Keeping in mind that, if there is a future with
non-reversible transactions, we could have randomness in a single transaction.

## Timeline

### Suggested implementation timeline

Implementation should only take one week of work, from the reference implementation.

### Suggested developer platform support timeline

Optionally, switching for determining which transfer function to use, may need to be added to the TS SDK, to ease
onboarding of wallets. This would need probably a week of work.

### Suggested deployment timeline

This can be deployed entirely separately of the framework, and I'm not sure that it belongs directly in 0x4.

It can be deployed in Devnet immediately, Testnet after a few weeks, and Mainnet after a few weeks after.

## Open Questions (Optional)

- How to handle custom staging of NFTs?
- How to handle custom reveals of NFTs?
- How to handle different behaviors of transfers on NFTs? Currently tied to one implementation.
