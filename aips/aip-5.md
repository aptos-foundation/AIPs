# [AIP-5] Multi-Composable Token Standard

### This standard allows the coexistence of soulbound and non-soulbound NFTs.

### Summary

This standard is an extension of [Aptos-Token](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token/sources/token.move). It proposes an interface allowing each token to define its soulbound property directly.

### Motivation

Soulbound tokens have enormous potential in a wide variety of applications. However, with no standard, soulbound tokens are incompatible with the Aptos-Token standard. Consensus on a common standard is required to allow for broader ecosystem adoption, as well as to make it easier for application developers to build expressive applications on top of the standard.

This AIP (Aptos Improvement Proposal) envisions soulbound tokens as non-transferable NFTs that will unlock primitives such as robust proof of attendance, credentials, distributed governance rights, and much more. However, soulbound tokens must be distinguishable from [Aptos-Tokens](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token/sources/token.move) to provide this utility.

### Rationale

Extending this utility to the existing Aptos-Token standard provides significant benefits:

- Consensus on a soulbound token standard
- Monitoring a single event store for soulbound and non-soulbound tokens
- Compatibility with the Aptos-Token standard.

An alternative solution to the non-transferability problem is creating a "Locking Standard", where tokens can be deposited, claimed, and burned. Creating a locker that acts as a wrapper around tokens essentially makes them soulbound. This solution has a significant drawback: monitoring can no longer be handled for both soulbound and non-soulbound tokens in a single event store, thus creating the need for separate monitoring of an entirely different event store. This is undesirable from usability, composability, and scalability standpoints.

### Requirements

- Tokens minted to an account cannot be transferred.
- Work with all existing dApps (decentralized applications).
- Ability to tell if a token is soul bound or not.

### Approach

_Extend property map to have framework reserved keys_

Reserve all keys with “##” for framework usage.

When adding keys to property_map, we need to check if the key starts with “##” and disallow adding or creating property_map with these keys.

We add a token package friend function for adding framework-reserved control flags

```rust
// This function should only be called by framework modules
public(friend) fun add_framework_reserved_control_flag(map: &mut PropertyMap, key: String, value: PropertyValue)
```

Note: after this change, the `property_map` will become a dedicated data structure for the token package.

- TODO: Verify _property_map_ has not been widely used by the community and a similar data structure is provided in the framework package.
- TODO: Validation of the framework key costs of the extra gas used for all the property map creation and inserting. Verify the gas cost.

**Annotate the token as soul bound**

- Introduce a framework reserved token property “##freezing_type” of u8 type. When the freezing_type is 0, this value is reserved for the soulbound token.
- Have new methods to create soulbound tokens by updating the property’s value to 1.
- Don’t allow withdrawal if the token’s frozen.

```rust
// Mint soulbond tokens specifically
public entry create_mint_soulbound_token(creator: &signer, owner: address, collection_name: String, token_name: String){
    // Create token_data
    let token_data_id = create_token_data(...);
    // Mint a token from token_data_id
    let token = mint_token(token_data_id);

    // Offer token to owner
    token_transfers::offer(creator, owner, token_id, ..);
    // Annotate the token property #freezing_type to 0
    add_framework_reserved_control_flag(token.token_properties, "“##freezing_type", 1);
}

public fun is_soulbound_token(token_id: TokenId): bool {
    // Check the token properties
}

public fun withdraw_token(account: &signer, id: TokenId, amount: u64){
    let token_data_id = id.token_data_id;
    // Check the token's properties and validate if the ##freezing_type value is set
    ...
}
```

### Extension

We can extend the approach to support general frozen tokens to token stores. For example, the token owner or creator wants to freeze the token to their token store after an expiration time. We can use `##freezing_type = 2` for the time-based freezing. we can introduce another system-reserved control flag to specify the timestamp `##freezing_expiration_time`.

```rust
public fun freeze_token(owner: &signer, token_id: TokenId, expiration_time: u64){
    // annotate the token with two properties above
}

public withdraw(...){
    //check if the token is frozen and the expiration time.
}
```

### Other Alternatives

- Store tokens inside locker modules, the biggest downside being the onboarding of dApps (decentralized applications) to monitor the new locker standard.

### Suggested I**mplementation Timeline**

To be determined.

### **References**

- [https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/framework/aptos-token](https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/framework/aptos-token)
- [https://github.com/aptos-foundation/AIPs](https://github.com/aptos-foundation/AIPs)

- [https://eips.ethereum.org/EIPS/eip-5633](https://eips.ethereum.org/EIPS/eip-5633)
- [https://eips.ethereum.org/EIPS/eip-5192](https://eips.ethereum.org/EIPS/eip-5192)
- [https://eips.ethereum.org/EIPS/eip-1155](https://eips.ethereum.org/EIPS/eip-1155)
- [https://eips.ethereum.org/EIPS/eip-721](https://eips.ethereum.org/EIPS/eip-721)
- [https://eips.ethereum.org/EIPS/eip-165](https://eips.ethereum.org/EIPS/eip-165)

--

Special thanks to [Bo Wu](https://github.com/areshand).
