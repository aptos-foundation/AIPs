---
aip: 14
title: Generic Prime-Order Group Operations
author: zhoujun-ma, alin
discussions-to: TBD
Status: Draft
last-call-end-date:
type: Standard (Framework)
created: 2023/01/31
updated: 2023/01/31
requires: None
---

# AIP-14 - Generic Prime-Order Group Operations
## Summary

This AIP proposes some functions and structs for performing cryptographic group operations on prime-order groups in Move. given $P$ $kP$, hard to compute $k$.

The initial list of supported group operations includes group element serialization/deserialization, basic group arithmetics (like addition, scalar multiplication), pairing. NOTE: Additive notations are used across this doc.

The list of supported groups starts with BLS12-381 groups.

Either the operation list or the group list can be extended by future AIPs.

## Motivation

Prime-order groups are fundamental building blocks for many cryptographic schemes, but also hard to implement efficiently in pure Move.
This change should allow Move developers to implement those a generic construction of those schemes, then get instantiations for free with supported groups.

For example, if BLS12-381 groups and BN254 groups are supported, one can implement a generic Groth16 proof verifier construction, then be able to use both BLS12-381-based Groth16 proof verifier and BN254-based Groth16 proof verifier.

BLS12-381-based Groth16 proof verifier has been implemented this way as part of the reference implementation.

## Rationale

An alternative non-generic approach is to expose instantiated schemes directly in stdlib.
For example, we can define a Groth16 proof verification function
`0x1::groth16_b::verify_proof(vk, proof, public_inputs): bool`
for every bilinear map `b`;
for ECDSA signatures which requires a hash function and a group, we can define
`0x1::ecdsa_h_g::verify_signature(pk, msg, sig):bool`
for each pair of proper hash function `h` and group `g`.

Compared with the proposed approach, the alternative approach saves the work of constructing the schemes for Move developers. However, the size of stdlib can grow too large in the future.

To keep the Aptos stdlib concise while still covering as many use cases as possible, the proposed generic approach should be chosen over the alternative approach.

## Specifications

### Structs and Functions

Module `0x1::groups` is designed to have the following definitions.

- A generic struct `Element<G>` that represents an element of group `G`.
- A generic struct `Scalar<S>` that represents an element of a scalar field `S`.
    - Scalars are needed by important group operations like scalar multiplications `k*P`.
- Generic functions that represent group/scalar operations.
    - Groups (and optionally scalar fields/hash algorithms) as the type parameters.
- Marker types for supported groups, scalar fields, hash algorithms.

Below is the full specification in pseudo-Move.

```rust
module 0x1::groups {
    //
    // Marker types.
    //
    /// An awesome group of order 1000000007.
    struct GroupA;

    /// The group B1 of order `r` from the famous pairing (B1,B2,B3).
    struct GroupB1;

    /// The group B2 of order `r` from the famous pairing (B1,B2,B3).
    struct GroupB2;

    /// The group B3 of order `r` from the famous pairing (B1,B2,B3).
    struct GroupB3;

		// More groups coming.

    /// Scalar field for both `GroupA`.
    struct ScalarForA;

    /// Scalar field for `GroupB1`, `GroupB2` and `GroupB3`.
    struct ScalarForBx;

    /// An element of the group `G`.
    struct Element<G> has copy, drop;

    /// An element of the scalar field `S`.
    /// Basically an integer in [0..r-1],
    /// where `r` is the prime order of the associated groups.
    struct Scalar<S> has copy, drop;

    //
    // Group operations.
    //

    /// Group element deserialization with an uncompressed format.
    public fun element_deserialize_uncompressed<G>(bytes: vector<u8>): Option<Element<G>>;

    /// Group element serialization with an uncompressed format.
    public fun element_serialize_uncompressed<G>(element: &Element<G>): vector<u8>;

    /// Check if `P == Q` for group elements `P` and `Q`.
    public fun element_eq<G>(element_p: &Element<G>, element_q: &Element<G>): bool;

    /// Compute `-P` for group element `P`.
    public fun element_neg<G>(element_p: &Element<G>): Element<G>;

    /// Compute `P + Q` for group element `P` and `Q`.
    public fun element_add<G>(element_p: &Element<G>, element_q: &Element<G>): Element<G>;

    /// Compute `k*P` for scalar `k` and group element `P`.
    public fun element_scalar_mul<G, S>(element_p: &Element<G>, scalar_k: &Scalar<S>): Element<G>;

    /// Get the identity of group `G`.
    public fun group_identity<G>(): Element<G>;

    /// Get a fixed generator of group `G`.
    public fun group_generator<G>(): Element<G>;

    /// Get the order of group `G`, little-endian encoded as a byte array.
    public fun group_order<G>(): vector<u8>;

    /// Compute `2P` for group element `P`. Faster and cheaper than `P + P`.
    /// NOTE: only some elliptic curve groups support this.
    public fun element_double<G>(element_p: &Element<G>): Element<G>;

    /// Group element deserialization with a compressed format.
    /// NOTE: only some elliptic curve groups support this.
    public fun element_deserialize_compressed<G>(bytes: vector<u8>): Option<Element<G>>;

    /// Group element serialization with a compressed format.
    /// NOTE: only some elliptic curve groups support this.
    public fun element_serialize_compressed<G>(element: &Element<G>): vector<u8>;

    /// Compute `k[0]*P[0]+...+k[n-1]*P[n-1]` for `n` scalars `k[]` and `n` group elements `P[]`.
    /// Faster and cheaper than `element_scalar_mul` and adding up the results using `scalar_add`.
    /// NOTE: only some elliptic curve groups support this.
    public fun element_multi_scalar_mul<G, S>(elements: &vector<Element<G>>, scalars: &vector<Scalar<S>>): Element<G>;

    /// Compute the product of multiple pairings.
    /// NOTE: only some elliptic curve groups support this.
    public fun pairing_product<G1, G2, Gt>(g1_elements: &vector<Element<G1>>, g2_elements: &vector<Element<G2>>): Element<Gt>;

    //
    // Scalar-specific operations.
    //

    /// Convert a u64 to a scalar.
    public fun scalar_from_u64<S>(value: u64): Scalar<S>;

    /// Compute `-x` for scalar `x`.
    public fun scalar_neg<S>(x: &Scalar<S>): Scalar<S>;

    /// Compute `x + y` for scalars `x` and `y`.
    public fun scalar_add<S>(x: &Scalar<S>, y: &Scalar<S>): Scalar<S>;

    /// Compute `x * y` for scalars `x` and `y`.
    public fun scalar_mul<S>(x: &Scalar<S>, y: &Scalar<S>): Scalar<S>;

    /// Compute `x^(-1)` for scalar `x`, if defined.
    public fun scalar_inv<S>(x: &Scalar<S>): Option<Scalar<S>>;

    /// Check if `x == y` for scalars `x` and `y`.
    public fun scalar_eq<S>(x: &Scalar<S>, y: &Scalar<S>): bool;

    /// Scalar deserialization.
    public fun scalar_deserialize<S>(bytes: &vector<u8>): Option<Scalar<S>>;

    /// Scalar serialization.
    public fun scalar_serialize<S>(scalar: &Scalar<S>): vector<u8>;
}
```

### Shared Scalar Fields

Some groups share the same group order.
They should share the same scalar field for easier programming.

E.g. the following should be supported.

```rust
// groups.move
pub fun element_scalar_mul<G,S>(element: &Element<G>, scalar: &Scalar<S>)...

// user_contract.move
**let k: Scalar<ScalarForBx> = somehow_get_k();**
let p1 = group_generator<GroupB1>();
let p2 = group_generator<GroupB2>();
let q1 = element_scalar_mul<GroupB1, ScalarForBx>(&p1, &k);
let q2 = element_scalar_mul<GroupB2, ScalarForBx>(&p2, &k);
```

So developers doesn’t have to do:

```rust
//groups.move
pub fun element_scalar_mul<G>(element: &Element<G>, scalar: &Scalar<G>)...

// user_contract.move
**let k_for_p1: Scalar<GroupB1> = somehow_get_k();
let k_for_p1_encoded: vector<u8> = scalar_serialize(&k_for_p1);
let k_for_p2 = scalar_deserialize<GroupB2>(&k_for_p1_encoded);**
let p1 = group_generator<GroupB1>();
let p2 = group_generator<GroupB2>();
let q1 = element_scalar_mul<GroupB1>(&p1, &k_for_p1);
let q2 = element_scalar_mul<GroupB2>(&p2, &k_for_p2);
```

### Handling Incorrect Type Parameter(s)

The implementation should also help mitigate the type safety problem.

If a group operations that takes 2+ type parameters is invoked with incompatible type parameters, it should abort.

E.g. `element_scalar_mul<GroupA, ScalarForBx>()` should abort.

Invoking operation functions with user-defined types should also abort.

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/5884/files](https://github.com/aptos-labs/aptos-core/pull/5884/files)

## Risks and Drawbacks

For move application developers, constructing cryptographic schemes manually with these building blocks can be error-prone, or even result in vulnerable applications.

## Future Potential

As cryptography research advances and Aptos ecosystem grows, more cryptographic schemes will be needed in stdlib. It is expected to see new groups/group operations supported and new cryptographic systems on chain implemented, which can be done with minimum work using the generic framework introduced by this change.

Once Move interface is available, use it to rewrite the move side specifications.

## Suggested implementation timeline

The change should be available on devnet in February 2023.
