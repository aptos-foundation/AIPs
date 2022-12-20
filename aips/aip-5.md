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

### Specification

Modifications required to the current [Aptos-Token](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token/sources/token.move) implementation:

- Append “soulbound: bool” too *Tokens*
- Minting of soulbound tokens can only be handled through *“claims”*. After a soulbound NFT has been claimed it is locked to the receiver with the only valid operation being *“burn”,* if applicable to the token’s configuration*.*
- Validate before any transfer execution to ensure the token isn’t soulbound.

```rust
/// Executed when a specific token_id is set or updated to soulbound, according to the parameter "bounded".
public fun soulbound(token_id: TokenId, bounded: bool)

/// Returns true if soulbound, false if non-soulbound.
public fun get_soulbound(token_id: TokenId)
```

### Future Applications

A common use case for Soulbound NFTs is Proof of Attendance, where soulbound NFTs are distributed upon attendance of an event. Often event coordinators have all attendees’ addresses at the time of distribution, in which case iteratively calling “*offer”* to allow attendees to claim their token costs unnecessary gas and network usage. **A simple solution to this use case is implementing a function to “offer_batch” that may look as follows:

```rust
public fun offer_batch(offers: vector<{
	sender: signer,
	receiver: address,
  creator: address,
  collection: String,
  name: String,
  property_version: u64,
  amount: u64,
}>) acquires PendingClaims {

	while (i < vector::length(&offers)){
		offer_script(&sender, receiver, creator, collection, name, property_version, amount);
	}

}
```

**** This function allows multiple offers to be sent in a single transaction.

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
