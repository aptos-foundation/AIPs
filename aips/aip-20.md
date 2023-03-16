---
aip: 20
title: Generic Operations of Algebraic Structures
author: zhoujun-ma, alin
Status: Draft
type: Standard (Framework)
created: 2023/03/15
---

# AIP-14 - Generic Operations of Algebraic Structures
## Summary

This AIP proposes some generic functions and structs for performing operations on cryptographic algebraic structures in Move.

The initial list of supported generic operations includes group/field element serialization/deserialization, basic arithmetic, pairing, hash-to-structure, casting.

The list of supported groups starts with groups/fields used in BLS12-381, a popular pairing-friendly curve.

Either the operation list or the structure list can be extended by future AIPs.

## Motivation

Algebraic structures are fundamental building blocks for many cryptographic schemes, but also hard to implement efficiently in pure Move.
This change should allow Move developers to implement generic constructions of those schemes, then get different instantiations by only switching the type parameter(s).

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

Compared with the proposed approach, the alternative approach saves the work of constructing the schemes for Move developers. However, the size of stdlib can multiply too fast in the future.

To keep the Aptos stdlib concise while still covering as many use cases as possible, the proposed generic approach should be chosen over the alternative approach.

## Specifications

### Generic Operations

#### Structs and Functions

Module `aptos_std::algebra` is designed to have the following definitions.

- A generic struct `Element<S>` that represents an element of algebraic structure `S`.
- Generic functions that represent group/field operations.

Below is the full specification in pseudo-Move.

```rust
module aptos_std::algebra {
    /// An element of the group `G`.
    struct Element<S> has copy, drop;

		/// Check if `x == y` for elements `x` and `y` of an algebraic structure `S`.
    public fun eq<S>(x: &Element<S>, y: &Element<S>): bool;

    /// Convert a u64 to an element of an algebraic structure `S`.
    public fun from_u64<S>(value: u64): Element<S>;

    /// Return the additive identity of a field `S`.
    public fun field_zero<S>(): Element<S>;

    /// Return the multiplicative identity of a field `S`.
    public fun field_one<S>(): Element<S>;

    /// Compute `-x` for an element `x` of a field `S`.
    public fun field_neg<S>(x: &Element<S>): Element<S>;

    /// Compute `x + y` for elements `x` and `y` of a field `S`.
    public fun field_add<S>(x: &Element<S>, y: &Element<S>): Element<S>;

    /// Compute `x - y` for elements `x` and `y` of a field `S`.
    public fun field_sub<S>(x: &Element<S>, y: &Element<S>): Element<S>;

    /// Compute `x * y` for elements `x` and `y` of a field `S`.
    public fun field_mul<S>(x: &Element<S>, y: &Element<S>): Element<S>;

    /// Try computing `x / y` for elements `x` and `y` of a field `S`.
    /// Return none if y is the additive identity of field `S`.
    public fun field_div<S>(x: &Element<S>, y: &Element<S>): Option<Element<S>>;

    /// Compute `x^2` for an element `x` of a field `S`.
    ///
    public fun field_sqr<S>(x: &Element<S>): Element<S>;

    /// Try computing `x^(-1)` for an element `x` of a field `S`.
    /// Return none if `x` is the additive identity of field `S`.
    public fun field_inv<S>(x: &Element<S>): Option<Element<S>>;

    /// Compute `P + Q` for elements `P` and `Q` of a group `G`.
    public fun group_add<G>(element_p: &Element<G>, element_q: &Element<G>): Element<G>;

    /// Compute `2*P` for an element `P` of a group `G`. Faster and cheaper than `P + P`.
    public fun group_double<G>(element_p: &Element<G>): Element<G>;

    /// Get the fixed generator of a cyclic group `G`.
    public fun group_generator<G>(): Element<G>;

    /// Compute `k[0]*P[0]+...+k[n-1]*P[n-1]`, where
    /// `P[]` are `n` elements of group `G` represented by parameter `elements`, and
    /// `k[]` are `n` elements of the scalarfield `S` of group `G` represented by parameter `scalars`.
    ///
    /// Abort with code 0x010000 if the sizes of `elements` and `scalars` do not match.
    public fun group_multi_scalar_mul<G, S>(elements: &vector<Element<G>>, scalars: &vector<Element<S>>): Element<G>;

    /// Compute `-P` for an element `P` of a group `G`.
    public fun group_neg<G>(element_p: &Element<G>): Element<G>;

    /// Compute `k*P`, where `P` is an element of a group `G` and `k` is an element of the scalar field `S` of group `G`.
    public fun group_scalar_mul<G, S>(element_p: &Element<G>, scalar_k: &Element<S>): Element<G>;

    /// Compute `P - Q` for elements `P` and `Q` of a group `G`.
    public fun group_sub<G>(element_p: &Element<G>, element_q: &Element<G>): Element<G>;

    /// Efficiently compute `e(P[0],Q[0])+...+e(P[n-1],Q[n-1])`,
    /// where `e: (G1,G2) -> (Gt)` is a pre-compiled pairing function from groups `(G1,G2)` to group `Gt`,
    /// `P[]` are `n` elements of group `G1` represented by parameter `g1_elements`, and
    /// `Q[]` are `n` elements of group `G2` represented by parameter `g2_elements`.
    ///
    /// Abort with code 0x010000 if the sizes of `g1_elements` and `g2_elements` do not match.
    public fun multi_pairing<G1,G2,Gt>(g1_elements: &vector<Element<G1>>, g2_elements: &vector<Element<G2>>): Element<Gt>;

    /// Compute a pre-compiled pairing function (a.k.a., bilinear map) on `element_1` and `element_2`.
    /// Return an element in the target group `Gt`.
    public fun pairing<G1,G2,Gt>(element_1: &Element<G1>, element_2: &Element<G2>): Element<Gt>;

    /// Try deserializing a byte array to an element of an algebraic structure `S` using a given serialization format `F`.
    /// Return none if the deserialization failed.
    public fun deserialize<S, F>(bytes: &vector<u8>): Option<Element<S>>;

    /// Serialize an element of an algebraic structure `S` to a byte array using a given serialization format `F`.
    public fun serialize<S, F>(element: &Element<S>): vector<u8>;

    /// Get the order of group `G`, a big integer little-endian encoded as a byte array.
    public fun group_order<G>(): vector<u8>;

    /// Check if an element `x` is the identity of its group `G`.
    public fun group_is_identity<G>(element_x: &Element<G>): bool;

    /// Cast an element of a structure `S` to a super-structure `L`.
    public fun upcast<S,L>(element: &Element<S>): Element<L>;

    /// Try casting an element `x` of a structure `L` to a sub-structure `S`.
    /// Return none if `x` is not a member of `S`.
    ///
    /// NOTE: Membership check is performed inside, which can be expensive, depending on the structures `L` and `S`.
    public fun downcast<L,S>(element_x: &Element<L>): Option<Element<S>>;

    /// Hash an arbitrary-length byte array `msg` into structure `S` using the given `suite`.
    /// A unique domain separation tag `dst` of size 255 bytes or shorter is required
    /// for each independent collision-resistent mapping involved in the protocol built atop.
    /// Abort if `dst` is too long.
    public fun hash_to<St, Su>(dst: &vector<u8>, msg: &vector<u8>): Element<St>;
```

#### Shared Scalar Fields

Some groups share the same group order.
They should share the same scalar field for easier programming.

E.g. the following should be supported.

```rust
// algebra.move
pub fun group_scalar_mul<G,S>(element: &Element<G>, scalar: &Scalar<S>)...

// user_contract.move
**let k: Scalar<ScalarForBx> = somehow_get_k();**
let p1 = group_generator<GroupB1>();
let p2 = group_generator<GroupB2>();
let q1 = group_scalar_mul<GroupB1, ScalarForBx>(&p1, &k);
let q2 = group_scalar_mul<GroupB2, ScalarForBx>(&p2, &k);
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

#### Handling Incorrect Type Parameter(s)

The implementation should help mitigate the type safety problem.

If a group operations that takes 2+ type parameters is invoked with incompatible type parameters, it should abort.

E.g. `group_scalar_mul<GroupA, ScalarForBx>()` should abort with a “not implemented” error.

Invoking operation functions with user-defined types should also abort with a “not implemented” error.

### Implementation of BLS12-381 structures

The construction of BLS12-381 curves involve many groups/fields, some frequently interacted by applications (e.g., `Fq12`, `Fr`, `G1Affine`, `G2Affine`, `Gt`) while others rarely used. Marker types for using these structures with `aptos_std::algebra` APIs should be defined and exposed to developers, along with their widely-used serialization formats and hash-to-group suites, (ideally in its own module named `aptos_std::algebra_bls12381`).

Below are the full specification in pseudo-Move.

```rust
module aptos_std::algebra_bls12381 {
		/// The finite field $F_q$ used in BLS12-381 curves.
    /// It has a prime order $q$ equal to 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab.
    ///
    /// NOTE: currently information-only and no operations are implemented for this structure.
    struct Fq {}

    /// A serialization format for `Fq` elements,
    /// where an element is represented by a byte array `b[]` of size 48 with the least signature byte coming first.
    ///
    /// NOTE: currently information-only, not implemented.
    struct FqFormatLsb {}

    /// A serialization format for `Fq` elements,
    /// where an element is represented by a byte array `b[]` of size 48 with the most significant byte coming first.
    ///
    /// NOTE: currently information-only, not implemented.
    struct FqFormatMsb {}

    /// The finite field $F_{q^2}$ used in BLS12-381 curves.
    /// It is an extension field of `Fq`, constructed as $F_{q^2}=F_q[u]/(u^2+1)$.
    ///
    /// NOTE: currently information-only and no operations are implemented for this structure.
    struct Fq2 {}

    /// A serialization format for `Fq2` elements.
    /// where an element in the form $(c_0+c_1\cdot u)$ is represented by a byte array `b[]` of size 96
    /// with the following rules.
    /// - `b[0..48]` is $c_0$ serialized using `FqFormatLsb`.
    /// - `b[48..96]` is $c_1$ serialized using `FqFormatLsb`.
    ///
    /// NOTE: currently information-only, not implemented.
    struct Fq2FormatLscLsb {}

    /// A serialization format for `Fq2` elements,
    /// where an element in the form $(c_1\cdot u+c_0)$ is represented by a byte array `b[]` of size 96,
    /// with the following rules.
    /// - `b[0..48]` is $c_1$ serialized using `FqFormatMsb`.
    /// - `b[48..96]` is $c_0$ serialized using `FqFormatMsb`.
    ///
    /// NOTE: currently information-only, not implemented.
    struct Fq2FormatMscMsb {}

    /// The finite field $F_{q^6}$ used in BLS12-381 curves.
    /// It is an extension field of `Fq2`, constructed as $F_{q^6}=F_{q^2}[v]/(v^3-u-1)$.
    ///
    /// NOTE: currently information-only and no operations are implemented for this structure.
    struct Fq6 {}

    /// A serialization scheme for `Fq6` elements,
    /// where an element $(c_0+c_1\cdot v+c_2\cdot v^2)$ is represented by a byte array `b[]` of size 288,
    /// with the following rules.
    /// - `b[0..96]` is $c_0$ serialized using `Fq2FormatLscLsb`.
    /// - `b[96..192]` is $c_1$ serialized using `Fq2FormatLscLsb`.
    /// - `b[192..288]` is $c_2$ serialized using `Fq2FormatLscLsb`.
    ///
    /// NOTE: currently information-only, not implemented.
    struct Fq6FormatLscLsb {}

    /// The finite field $F_{q^12}$ used in BLS12-381 curves.
    /// It is an extension field of `Fq6`, constructed as $F_{q^12}=F_{q^6}[w]/(w^2-v)$.
    struct Fq12 {}

    /// A serialization scheme for `Fq12` elements,
    /// where an element $(c_0+c_1\cdot w)$ is represented by a byte array `b[]` of size 576.
    /// `b[0..288]` is $c_0$ serialized using `Fq6FormatLscLsb`.
    /// `b[288..576]` is $c_1$ serialized using `Fq6FormatLscLsb`.
    ///
    /// NOTE: the same scheme is also used in other implementations (e.g. ark-bls12-381-0.4.0).
    struct Fq12FormatLscLsb {}

    /// A group constructed by the points on the BLS12-381 curve $E(F_q): y^2=x^3+4$ and the point at inifinity,
    /// under the elliptic curve point addition.
    /// It contains the prime-order subgroup $G_1$ used in pairing.
    /// The identity is the point at infinity.
    ///
    /// NOTE: currently information-only and no operations are implemented for this structure.
    struct G1AffineParent {}

    /// A serialization scheme for `G1AffineParent` elements,
    /// where an element is represented by a byte array `b[]` of size 96,
    /// with the following rules deseribed from the perspective of deserialization.
    /// 1. Read `b[0] & 0x80` as the compression flag. Abort if it is 1.
    /// 1. Read `b[0] & 0x40` as the infinity flag.
    /// 1. Read `b[0] & 0x20` as the lexicographical flag. This is ignored.
    /// 1. If the infinity flag is 1, return the point at infinity.
    /// 1. Deserialize $x$ from `[b[0] & 0x1f, ..., b[47]]` using `FqFormatMsb`. Abort if this failed.
    /// 1. Deserialize $y$ from `[b[48], ..., b[95]]` using `FqFormatMsb`. Abort if this failed.
    /// 1. Abort if point $(x,y)$ is not on curve $E(F_q)$.
    /// 1. Return $(x,y)$.
    ///
    /// NOTE: currently information-only, not implemented.
    struct G1AffineParentFormatUncompressed {}

    /// A serialization scheme for `G1AffineParent` elements,
    /// where an element is represented by a byte array `b[]` of size 48,
    /// with the following rules deseribed from the perspective of deserialization.
    /// 1. Read `b[0] & 0x80` as the compression flag. Abort if it is 0.
    /// 1. Read `b[0] & 0x40` as the infinity flag.
    /// 1. Read `b[0] & 0x20` as the lexicographical flag.
    /// 1. If the infinity flag is 1, return the point at infinity.
    /// 1. Deserialize $x$ from `[b[0] & 0x1f, ..., b[47]]` using `FqFormatMsb`. Abort if this failed.
    /// 1. Try computing $y$ such that point $(x,y)$ is on the curve $E(F_q)$. Abort if there is no such $y$.
    /// 1. Let $\overline{y}=-y$.
    /// 1. Set $y$ as $\min(y,\overline{y})$ if the the lexicographical flag is 0, or $\max(y,\overline{y})$ otherwise.
    /// 1. Return $(x,y)$.
    ///
    /// NOTE: currently information-only, not implemented.
    struct G1AffineParentFormatCompressed {}

    /// The group $G_1$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
    /// It is subgroup of `G1AffineParent`.
    /// It has a prime order $r$ equal to 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001.
    /// (so `Fr` is the scalar field).
    struct G1Affine {}

    /// A serialization format for `G1Affine` elements,
    /// essentially the format represented by `G1AffineParentFormatUncompressed`
    /// but only applicable to `G1Affine` elements.
    ///
    /// NOTE: the same scheme is also used in other implementations (e.g. ark-bls12-381-0.4.0).
    struct G1AffineFormatUncompressed {}

    /// A serialization format for `G1Affine` elements,
    /// essentially the format represented by `G1AffineParentFormatCompressed`
    /// but only applicable to `G1Affine` elements.
    ///
    /// NOTE: the same scheme is also used in other implementations (e.g. ark-bls12-381-0.4.0).
    struct G1AffineFormatCompressed {}

    /// A group constructed by the points on a curve $E'(F_{q^2})$ and the point at inifinity under the elliptic curve point addition.
    /// $E'(F_{q^2})$ is an elliptic curve $y^2=x^3+4(u+1)$ defined over $F_{q^2}$.
    /// The identity of `G2Affine` is the point at infinity.
    ///
    /// NOTE: currently information-only and no operations are implemented for this structure.
    struct G2AffineParent {}

    /// A serialization scheme for `G2AffineParent` elements.
    /// where an element is represented by a byte array `b[]` of size 192,
    /// with the following rules deseribed from the perspective of deserialization.
    /// 1. Read `b[0] & 0x80` as the compression flag. Abort if it is 1.
    /// 1. Read `b[0] & 0x40` as the infinity flag.
    /// 1. Read `b[0] & 0x20` as the lexicographical flag. This is ignored.
    /// 1. If the infinity flag is 1, return the point at infinity.
    /// 1. Deserialize $x$ from `[b[0] & 0x1f, ..., b[95]]` using `Fq2FormatMscMsb`. Abort if this failed.
    /// 1. Deserialize $y$ from `[b[96], ..., b[191]]` using `Fq2FormatMscMsb`. Abort if this failed.
    /// 1. Abort if point $(x,y)$ is not on curve $E'(F_{q^2})$.
    /// 1. Return $(x,y)$.
    ///
    /// NOTE: currently information-only, not implemented.
    struct G2AffineParentFormatUncompressed {}

    /// A serialization scheme for `G1AffineParent` elements,
    /// where an element is represented by a byte array `b[]` of size 96,
    /// with the following rules deseribed from the perspective of deserialization.
    /// 1. Read `b[0] & 0x80` as the compression flag. Abort if it is 0.
    /// 1. Read `b[0] & 0x40` as the infinity flag.
    /// 1. Read `b[0] & 0x20` as the lexicographical flag.
    /// 1. If the infinity flag is 1, return the point at infinity.
    /// 1. Deserialize $x$ from `[b[0] & 0x1f, ..., b[96]]` using `Fq2FormatMscMsb`. Abort if this failed.
    /// 1. Try computing $y$ such that point $(x,y)$ is on the curve $E(F_{q^2})$. Abort if there is no such $y$.
    /// 1. Let $\overline{y}=-y$.
    /// 1. Set $y$ as $\min(y,\overline{y})$ if the the lexicographical flag is 0, or $\max(y,\overline{y})$ otherwise.
    /// 1. Return $(x,y)$.
    ///
    /// NOTE: currently information-only, not implemented.
    struct G2AffineParentFormatCompressed {}

    /// The group $G_2$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
    /// It is a subgroup of `G2AffineParent`.
    /// It has a prime order $r$ equal to 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001.
    /// (so `Fr` is the scalar field).
    struct G2Affine {}

    /// A serialization scheme for `G2Affine` elements,
    /// essentially `G2AffineParentFormatUncompressed` but only applicable to `G2Affine` elements.
    ///
    /// NOTE: currently information-only, not implemented.
    struct G2AffineFormatUncompressed {}

    /// A serialization scheme for `G2Affine` elements,
    /// essentially `G2AffineParentFormatCompressed` but only applicable to `G2Affine` elements.
    ///
    /// NOTE: currently information-only, not implemented.
    struct G2AffineFormatCompressed {}

    /// The group $G_t$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
    /// It is a multiplicative subgroup of `Fq12`.
    /// It has a prime order $r$ equal to 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001.
    /// (so `Fr` is the scalar field).
    /// The identity of `Gt` is 1.
    struct Gt {}

    /// A serialization scheme for `Gt` elements,
    /// essentially `Fq12FormatLscLsb` but only applicable to `Gt` elements.
    ///
    /// NOTE: the same scheme is also used in other implementations (e.g. ark-bls12-381-0.4.0).
    struct GtFormat {}

    /// The finite field $F_r$ that can be used as the scalar fields
    /// for the groups $G_1$, $G_2$, $G_t$ in BLS12-381-based pairing.
    struct Fr {}

    /// A serialization format for `Fr` elements,
    /// where an element is represented by a byte array `b[]` of size 32 with the least significant byte coming first.
    ///
    /// NOTE: the same scheme is also used in other implementations (e.g., ark-bls12-381-0.4.0, blst-0.3.7).
    struct FrFormatLsb {}

    /// A serialization scheme for `Fr` elements,
    /// where an element is represented by a byte array `b[]` of size 32 with the most significant byte coming first.
    ///
    /// NOTE: the same scheme is also used in other implementations (e.g., ark-bls12-381-0.4.0, blst-0.3.7).
    struct FrFormatMsb {}
}
```

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/6550/files](https://github.com/aptos-labs/aptos-core/pull/6550/files)

## Risks and Drawbacks

For move application developers, constructing cryptographic schemes manually with these building blocks can be error-prone, or even result in vulnerable applications.

## Future Potential

As cryptography research advances and Aptos ecosystem grows, more cryptographic schemes will be needed in stdlib. It is expected to see new groups/group operations supported and new cryptographic systems on chain implemented, which can be done with minimum work using the generic framework introduced by this change.

Once Move interface is available, use it to rewrite the move side specifications.

## Suggested implementation timeline

The change should be available on devnet in April 2023.
