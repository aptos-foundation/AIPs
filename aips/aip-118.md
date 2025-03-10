---
aip: 118
title: Aptos Hybrid Asset (HA) Standard
author: gregnazario, cylim226, decidethatlater, HugeMongooose, SuperSecretRare, 0xYZMIN
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): 10/15/2024
type: Ecosystem
created: 10/3/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-118 - Aptos Hybrid Asset (HA) Standard

## Summary

This AIP proposes a standardized implementation for hybrid assets on the Aptos blockchain, inspired by Vectorized's [DN-404](https://github.com/Vectorized/dn404) token standards. 
Hybrid assets represent a novel fusion of fungible assets and digital assets (NFTs), leveraging Aptos-specific capabilities to create a more sophisticated and efficient implementation than what's possible on other blockchains.

### Out of scope

We are not covering the specifics of liquidity pools, that should already be handled automatically by any existing providers.

## High-level Overview

From a high level, when a user deposits a set number of fungible assets into an account (let's say one whole asset),
they will receive an NFT in their account. When a user drops below the set number of fungible assets, the NFT will be
removed from their account. Additionally, NFTs can be transferred directly to other users, and the fungible asset will
go with it.

### Asset Transfer Mechanisms

The standard supports two distinct transfer mechanisms:

1. **Digital Asset (NFT) Transfers**
   - Supports direct digital asset transfers and marketplace trading
   - Automatically manages corresponding fungible token transfers
   - Ensures maintenance of the required fungible token balance per NFT
   - Maintains atomic execution of both NFT and fungible token transfers

2. **Fungible Asset Transfers**
   - Executed through DEX trading or direct transfers
   - Automatically manages NFT minting and burning based on token threshold
   - When an account accumulates sufficient fungible tokens to constitute a "full NFT," an NFT is minted to that account
   - When an account's balance falls below the "full NFT" threshold, the corresponding NFT is burned
   - DEX implementations should include configurable NFT minting controls to optimize trading efficiency

### Reveal Mechanics

The standard provides flexible reveal mechanisms that collection creators can customize according to their requirements, allowing for diverse implementation strategies.

## Impact

NFT marketplaces and wallets will need to support the direct transfer of NFTs with fungible assets. This will allow them
to ensure the properties above.

## Alternative Solutions

The alternative solution would be to have a non-standard way of creating these collections, which would cause
fragmentation in nft marketplace, decentralized exchange, and wallet experiences.

## Specification and Implementation Details

### Technical Architecture
The standard utilizes a resource account deployment model to enable universal access while maintaining security. The collection controller maintains mint/burn capabilities and ensures proper asset ratio maintenance. Key components include:

- **Collection Controller**: Unique object managing collection operations
- **HybridConfig**: Configuration object storing collection parameters
- **HybridOwnershipData**: Tracks NFT ownership and enables ratio maintenance
- **RevealRef**: Controls NFT metadata revelation processes

The standard will be implemented through a factory contract deployed at:
`0xbbe8a08f3b9774fccb31e02def5a79f1b7270b2a1cb9ffdc05b2622813298f2a`

This factory contract will be deployed to a resource account, specifically to allow anyone to
mint collections from it. Additionally, users can create extensions to the collection by creating new contracts that
use the base contract.


### Collection Management

The collection management functions enable the creation and administration of hybrid asset collections. These functions form the foundation for establishing the relationship between fungible and non-fungible tokens.

1. **Collection Creation**
```move
public fun create(
    caller: &signer,
    // Collection parameters
    collection_name: String,
    collection_description: String,
    collection_uri: String,
    // NFT parameters
    hidden_nft_name: String,
    hidden_nft_uri: String,
    hidden_nft_description: String,
    num_supply_nfts: u64,
    num_tokens_per_nft: u64,
    royalty_numerator: u64,
    royalty_denominator: u64,
    royalty_address: address,
    with_properties: bool,
    // Fungible Asset parameters
    fa_name: String,
    symbol: String,
    decimals: u8,
    icon_uri: String,
    project_uri: String,
    withdraw_function: Option<FunctionInfo>,
    deposit_function: Option<FunctionInfo>
): ConstructorRef
```
The `create` function establishes a new hybrid collection with specified parameters for both NFT and fungible asset components. It creates an object that will control the collection for minting and burning operations. The function allows customization of collection metadata, NFT properties, and fungible asset characteristics.

2. **Treasury Management**
```move
public entry fun mint_to_treasury(
    caller: &signer,
    collection: Object<HybridCollection>,
    amount: u64
)
```
Treasury management functions handle the minting and distribution of assets. The `mint_to_treasury` function is particularly efficient as it bypasses NFT minting, making it suitable for initial supply creation. This is complemented by functions for treasury withdrawals and user distributions:

```move
public fun remove_from_treasury(
    caller: &signer,
    collection: Object<HybridCollection>,
    amount: u64
): FungibleAsset

public entry fun send_from_treasury_to_user(
    caller: &signer,
    collection: Object<HybridCollection>,
    receiver: address,
    amount: u64
)
```

### Asset Transfer Operations

Transfer operations handle the movement of both fungible and non-fungible assets while maintaining the required ratio between them. These functions implement the core hybrid asset mechanics.

1. **Standard Transfer**
```move
public entry fun transfer<T: key>(
    caller: &signer,
    token: Object<T>,
    receiver: address
)
```
The standard transfer function handles NFT transfers while automatically managing the associated fungible assets. This function ensures atomic execution of both NFT and fungible token transfers.

2. **Fungible Asset Operations**
```move
public fun withdraw<T: key>(
    store: Object<T>,
    amount: u64,
    transfer_ref: &fungible_asset::TransferRef
): FungibleAsset

public fun deposit<T: key>(
    store: Object<T>,
    fa: FungibleAsset,
    transfer_ref: &fungible_asset::TransferRef
)
```
These functions handle fungible asset transfers while managing the associated NFT minting and burning operations. When fungible assets are transferred:
- If the recipient accumulates enough tokens for a "full NFT," an NFT is minted to their account
- If the sender's balance falls below the threshold for a "full NFT," their NFT is burned

3. **Special Transfer Operations**
```move
public fun deposit_with_ref<T: key>(
    reveal_ref: &RevealRef,
    store: Object<T>,
    fa: FungibleAsset,
    transfer_ref: &fungible_asset::TransferRef
): vector<ConstructorRef>
```
Special transfer operations provide additional control over the minting and burning behavior, useful for specific scenarios such as DEX interactions or marketplace trades.

### NFT Management

NFT management functions control the revelation and modification of NFT metadata and properties.

1. **Reveal Operations**
```move
public fun reveal(
    reveal_ref: &RevealRef,
    token: Object<HybridToken>,
    new_name: Option<String>,
    new_desc: Option<String>,
    new_uri: Option<String>,
    only_reveal_once: bool,
)
```
The reveal mechanism allows for dynamic NFT metadata updates, enabling features like:
- Progressive revelation of NFT content
- One-time or multiple revelation patterns
- Customizable metadata updates

2. **Property Management**
```move
public fun add_properties(
    reveal_ref: &RevealRef,
    token: Object<HybridToken>,
    to_update: vector<String>,
    to_update_values: vector<String>,
)
```
Property management functions enable the modification of NFT attributes, supporting:
- Dynamic property addition
- Property value updates
- Metadata enrichment

### View Functions

View functions provide read-only access to collection state and token information.

```move
#[view]
public fun is_hybrid_asset<T: key>(collection: Object<T>): bool

#[view]
public fun is_hybrid_token<T: key>(token: Object<T>): bool
```
These functions enable verification of hybrid asset status and querying of token states, helping interfaces and external contracts interact with hybrid assets correctly.

```move
#[view]
public fun get_nfts_by_owner(
    owner_address: address, 
    collection: Object<HybridCollection>
): vector<address>

#[view]
public fun get_treasury_balance(collection: Object<HybridCollection>): u64
```
These functions provide essential information for:
- NFT ownership tracking
- Treasury management
- Balance verification
- Collection status monitoring

### Capability Management

Capability management functions control the minting and burning permissions of the collection.

```move
public entry fun destroy_mint_capability(
    caller: &signer,
    collection: Object<HybridCollection>
)

public entry fun destroy_burn_capability(
    caller: &signer,
    collection: Object<HybridCollection>
)
```
These functions provide critical security controls by allowing:
- Permanent removal of minting capability
- Restriction of burning operations
- One-way capability destruction for enhanced security

## Reference Implementation

GitHub Repository: https://github.com/gregnazario/aptos-hybrid-assets

## Risks and Drawbacks

- Potential drawback is adoption of marketplaces and wallets to use the new transfer function. With dynamic dispatch it
  could be replaced with a more flexible solution.
    - The mitigation plan is to provide help to wallets and marketplaces to adopt the new standard via a helper
      function.
- For future backward compatibility, depending on how the dynamic dispatch solution is provided, it may be necessary to
  change the contract, or create a new contract altogether.
    - The mitigation plan is to in the future provide a migration plan for future hybrid assets.

## Security Considerations

This AIP doesn't impact the security of the network, there are a few considerations for the project implemented this AIP,

The implementation must specifically address:
- Prevention of test and abort attacks on randomness mechanisms
- Secure handling of Digital Assets metadata revelation
- Atomic execution of paired asset transfers
- Protection against balance manipulation attacks

## Integration Considerations

### DEX Integration
- Must support dispatchable fungible assets
- Optimize for high-volume trading scenarios
- Consider gas efficiency in automated minting/burning operations
- Optional NFT minting/burning bypass for DEX addresses

### Digital Assets Marketplace Integration
- Implement support for atomic transfers
- Handle metadata revelation appropriately
- Address the absence of dynamic dispatch in object transfers

### Wallet Integration
- Implement dual-asset display capabilities
- Support reveal mechanics

## Operational Considerations

Future improvements should address:
- Custom hybrid asset staging mechanisms
- Flexible revelation patterns
- Extensible transfer behavior implementations
- Optimization of gas costs for high-volume trading

## Testing Requirements

Comprehensive testing suite should be covering:
- Ratio maintenance (1 NFT : x FA)
- Transfer atomicity
- Edge case handling
- DEX integration scenarios
- Marketplace integration scenarios

## Timeline

### Suggested implementation timeline

Implementation should only take one week of work, from the reference implementation.

### Suggested developer platform support timeline

Optionally, switching for determining which transfer function to use, may need to be added to the TS SDK, to ease
onboarding of wallets. This would need probably a week of work.

### Suggested templating timeline

It should takes a week to create a basic quick start example contract with a few reveal options. And example script to create hybrid assets.

### Suggested deployment timeline

This can be deployed entirely separately of the framework, and I'm not sure that it belongs directly in 0x4.


## Open Questions (Optional)

- How to handle custom reveals of NFTs?
A few templates on simple reveal while transfer, basic randomness reveal function will be provided.

## Future Potential

In the future, pure dynamic dispatch would work well to replace this. Keeping in mind that, if there is a future with
non-reversible transactions, we could have randomness in a single transaction.
