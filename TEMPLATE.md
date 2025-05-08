---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: On-Chain Marketplace Contract
author: Yuun Lim (yuun.lim@aptoslabs.com)
discussions-to: 
Status: In Review
last-call-end-date: 
type: Standard (Application)
created: 05/08/2025
updated: 
requires: N/A
---

# AIP-X - On-Chain NFT Marketplace Contract

## Summary

This AIP proposes a lightweight, UI-less, on-chain marketplace for NFTs. The contract allows developers to programmatically list, delist, and purchase NFTs without requiring custom marketplace or wallet UIs. 

### Out of scope

- Complex trading mechanisms like auctions, bids, and offers
- Marketplace aggregation features
- Extensive UI components or marketplace frontends

## High-level Overview

A uniform smart contract for marketplace operations will enable various developers and creators to launch trading features for their NFTs with less development and operational effort.  

This enables products leveraging NFTs that cannot or prefer not to build their own marketplace infrastructure/backend on Aptos to still be able to launch NFT trading experiences with much less effort as well as without the restrictions and fees of third party marketplaces.

## Impact

This AIP addresses the needs of NFT-integrated creators and applications to enable trading without relying on existing marketplaces. As some products cannot operate their own marketplaces, we will be limiting their capabilities to fully integrate NFTs without the proposed or other similar change.

Products or creators will be able to:

- Enable trading of their assets without building or operating the infrastructure/backend of a marketplace, which may be desirable for operational or regulatory reasons
- Implement customized (or fee-less) fee models that do not force users to pay the fees of existing external marketplaces
- Focus on UI customization of how NFTs and assets are displayed with respect to theming and branding, which may include product-specific integrations such as non-NFT assets, CTAs, or incentives

## Alternative Solutions

**Status Quo (applications/partners build their own marketplace contract)**

Due to regulations, some partners cannot operate their own marketplace products. This was initially the primary driver for the requirements of this feature and proposal.

**Marketplace SDK**

An SDK would be more complex to maintain. Additionally, it would be less flexible and usable as each partner may prefer a different interface/language.

**Order Book Contract**

Although an order book is more powerful, it would be more complex to upgrade/operate as well as challenging for developers to integrate with. The development time would also increase significantly, which at this time does not seem to be worthwhile (for the impact order book features would bring). It is worth noting order book features are worth exploring as the NFT landscape evolves.

**Marketplace Aggregator Contract**

Currently, there is not enough clarity on the use case and value this would bring, so it will be considered out of scope pending further explorations.

## Specification and Implementation Details

This proposal introduces a minimal, immutable smart contract designed for a decentralized NFT marketplace on Aptos. Deployed via a resource account, the contract allows any application or developer to programmatically list, delist, or purchase NFTs on-chain. The Contract is UI-agnostic, supports headless workflows, and is designed for autonomous execution.

The on-chain NFT marketplace contract is implemented as a set of four cohesive modules: `open_marketplace_listing`, `marketplace`, `fee_schedule`, and `events`. 

### **Modules and Core Functions**

#### Marketplace Module (`marketplace.move`)

This is the primary interface module for developers and applications interacting with the marketplace contract:

- (User/Application Initiated) Entry functions:
    - `place_listing`: Lists an NFT by transferring it to a newly created object owned by the caller and initializing a `Listing` (acting as a per-listing escrow)
        ```rust
        public entry fun place_listing(
                seller: &signer, // Seller's signer to authorize the txn
                token_object: Object<ObjectCore>,
                price: u64
            ) acquires ListingCounter {}
        ```
            
    - `place_listing_for_tokenv1`: Specialized version for creating TokenV1-based listings.
        ```rust
        public entry fun place_listing_for_tokenv1<CoinType>(
            seller: &signer, // the seller's signer
            token_creator: address,
            token_collection: String,
            token_name: String,
            token_property_version: u64,
            price: u64,
        ) acquires ListingCounter {}
        ```
            
    - `cancel_listing`: Allows the seller to cancel their listing. This triggers the transfer of the NFT from the `Listing` object escrow back to the seller's account
        ```rust
        public entry fun cancel_listing(
                seller: &signer, // the seller's signer
                listing_object: Object<open_marketplace_listing::Listing>
            ) {}
        ```
            
    - `fill_listing`: Completes a purchase, handling royalty disbursement, payment logic, and triggers the transfer of the NFT from the `Listing` object escrow to the buyer's account
        ```rust
        public entry fun fill_listing<CoinType>(
            buyer: &signer, // the seller's signer
            listing_object: Object<open_marketplace_listing::Listing>
        ) {}
        ```
            
- Internal logic: Handles payment flows using `Coin<T>`, supports automatic royalty disbursement to creators (if configured), and both Coin & FA

#### Listing Module

This module defines the structure and management of Individual NFT listings. Critically, instance of the `Listing` resource lives within its own dedicated `Object`, which functions as a per-listing escrow for the NFT being sold.

- Defines the `Listing` resource: designed to be stored within its own dedicated Object. Object is the temporary custodian of the listed NFT.
    - Supports both TokenV1 and TokenV2 assets.
    - Supports Optional listing fee.
- Token Custody:
    - For Digital Asset (TokenV2) NFTs (`Object<ObjectCore>`), the NFT object itself is directly stored within the `Listing` object's storage.
    - For legacy TokenV1 assets, they are wrapped inside a `TokenV1Container` object upon listing. This container, which is an Object, holds the TokenV1 data and crucially includes a `TransferRef`. This container object is then stored within the `Listing` object.
- All listing lifecycle actions (create listing, close, transfer) are initiated by applications or users through signer-based transactions. The marketplace contract does not own the private keys and relies on the signer provided by developers or backend systems for execution.

```rust
/// Resource that stores the listing information
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Listing has key {
    /// The object being sold (NFT)
    object: Object<ObjectCore>,
    /// Address of the seller
    seller: address,
    /// Price of the listing
    price: u64,
    /// Fee schedule for the listing
    fee_schedule: Object<FeeSchedule>,
    /// DeleteRef to delete the listing object
    delete_ref: DeleteRef,
    /// There is no support for generating a signer with a TransferRef to transfer the listing object so using ExtendRef
    extend_ref: ExtendRef,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Contains a tokenv1 as an object
struct TokenV1Container has key {
    /// The stored token.
    token: tokenv1::Token,
    /// Used to cleanup the object at the end
    delete_ref: DeleteRef,
    /// Used to transfer the tokenv1 at the conclusion of a purchase.
    transfer_ref: object::TransferRef,
}
```

#### Fee Schedule Module

This provides a user an ability to define and collect custom fees from marketplace operations

- Fee configuration resources: defines the resources that store fee parameters and rules. These are likely stored within a dedicated FeeSchedule Object, allowing for centralized management of fee settings.

```rust
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Defines marketplace fees
struct FeeSchedule has key {
    /// Address to send fees to
    fee_address: address,
    /// Ref for changing the configuration of the marketplace
    extend_ref: ExtendRef,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Fixed rate for listing
struct FixedRateListingFee has drop, key {
    /// Fixed rate for listing
    listing_fee: u64,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Fixed rate for commission
struct FixedRateCommission has drop, key {
    /// Fixed rate for commission
    commission: u64,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Percentage-based rate for commission
struct PercentageRateCommission has drop, key {
    /// Denominator for the commission rate
    denominator: u64,
    /// Numerator for the commission rate
    numerator: u64,
}

#[event]
/// Event representing a change to the marketplace configuration
struct FeeConfigUpdated has drop, store {
    marketplace: address,
    /// The type info of the struct that was updated.
    updated_resource: String,
}

public entry fun init_entry(
    creator: &signer,
    fee_address: address,
    listing_fee: u64,
    commission_denominator: u64,
    commission_numerator: u64,
)

/// Create a marketplace with no fees.
public entry fun init_no_fee(creator: &signer, fee_address: address) {
}

// Mutators
public entry fun set_fee_address
public entry fun set_fixed_rate_listing_fee
public entry fun set_fixed_rate_commission
public entry fun set_percentage_rate_commission
```

#### Events Module

This Module is responsible for emitting structured and indexable marketplace events:

- Events include `ListingPlaced`, `ListingCanceled`, and `ListingFilled`.
- Defines normalized `TokenMetadata` and `CollectionMetadata` structs for both TokenV1 and TokenV2 to provide consistent info about NFTs within events.

```rust
// Listing events
struct ListingPlaced has drop, store {
    marketplace: address,
    type: String,
    listing: address,
    seller: address,
    price: u64,
    token_metadata: TokenMetadata
}

struct ListingCanceled has drop, store {
    marketplace: address,
    type: String,
    listing: address,
    seller: address,
    price: u64,
    token_metadata: TokenMetadata
}

struct ListingFilled has drop, store {
    marketplace: address,
    type: String,
    listing: address,
    seller: address,
    purchaser: address,
    price: u64,
    commission: u64,
    royalties: u64,
    token_metadata: TokenMetadata
}

struct TokenMetadata has drop, store {
    creator_address: address,
    collection_name: String,
    collection: Option<Object<collectionv2::Collection>>,
    token_name: String,
    token: Option<Object<tokenv2::Token>>,
    property_version: Option<u64>,
}

struct CollectionMetadata has drop, store {
    creator_address: address,
    collection_name: String,
    collection: Option<Object<collectionv2::Collection>>,
}
```

### Object and Resource Flow

This is built around the following flow:

1. The Marketplace Smart Contract is deployed immutably using a Resource Account. The Resource Account's operational **`SignerCapability` is retained** and securely managed by the marketplace contract (or a trusted component within the marketplace's control) for authorizing specific autonomous operations.
2. Listing Creation (`place_listing`):
    1. Seller calls `place_listing` (signed by Seller)
    2. A new Listing object is created
    3. The NFT is held within its dedicated `Listing` object, owned by the seller but managed by the marketplace contract. The `ExtendRef` (this essentially works as TransferRef) within this object grants the authority to transfer the contained NFT, but this authority is utilized by the marketplace contract's functions.
3. Purchase (`fill_listing`):
    1. Buyer calls `fill_listing` (signed by Buyer)
    2. Royalty and payment are computed, paid out, and the token is transferred to the buyer.
4. Cancellation (`cancel_listing`):
    1. Seller calls `cancel_listing` 
    2. Contract logic uses the `ExtendRef` stored within the `listing` provided to transfer the NFT from the `Listing` object (seller-owned escrow) back to the Seller's Account. The seller's signed transaction provides the authority to execute the trusted contract code that utilizes the `ExtendRef`.
    3. Listing is cleaned up after using its `DeleteRef`
5. Event emissions:
    1. Each listing lifecycle step emits events with attached **TokenMetadata** for indexers.

## Reference Implementation

https://github.com/aptos-labs/on-chain-nft-marketplace

## Testing

- Unit tests will cover all entry points and core logic flows
- E2E tests will validate complete marketplace transactions from listing to purchase
- Integration tests with wallet and sample applications
- Security audits to ensure safe handling of NFTs and payment flows

## Risks and Drawbacks

- With the approach of a simplified model, more complicated functionalities that are available on existing marketplaces will not be supported such as auctions, bids, offers which may be desired by more sophisticated NFT traders.
- Even though we are not launching an end user marketplace product, an open on-chain marketplace could still be seen as competing with other external marketplaces (given volume/fees could potentially be impacted).

## Security Considerations

Security Risks:

- If the retained RA `SignerCapability` is compromised, the attacker can gain the ability to initiate and sign transactions, potentially drain marketplace-owned resources (like collected fees)
- Given that contract controls the escrow of valuable NFTs and handles payment flows, vulnerabilities in logic could lead to:
    - Loss of NFTs from the escrow
    - Incorrect distribution of funds (price, royalties, fees)
    - Listings getting stuck or becoming unmanageable

Mitigations:
- Comprehensive security audit before deployment
- Extensive test coverage for all critical paths
- Secure management of the resource account's signer capability

## Future Potential

By providing a simpler way to integrate marketplace contracts on Aptos, we expect that partners and projects will be able to launch NFT trading experiences quickly. This should enable products in the short term to demonstrate:

- Increased trade volume and listing activity for NFTs
- Tailored marketplace experiences on products that leverage NFTs
- Customizable revenue models to improve financial performance of partners

As the initial contract provides only listing and purchase functionality, more sophisticated trading experiences will not be implemented. If NFT demand and feature requirements expands, it is worth exploring features such as marketplace aggregation, order books, and other more complex trading features.

## Timeline

### Suggested implementation timeline 

- Smart contract proposal
- Implement smart contract
- Internal testing, deploy to devnet
- Production readiness
- Deploy to testnet
- Support partner integrations
- Deploy to mainnet

### Suggested developer platform support timeline

- Example integration with entry functions with simple demo
- Server side signing documentation to streamline partner integrations with the smart contract - possibly in Build to manage keys

## Open Questions (Optional)

None so far.

...
