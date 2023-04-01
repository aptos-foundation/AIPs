---
aip: 20
title: Generic Operations of Algebraic Structures
author: zhoujun-ma, alin
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/94
Status: Draft
type: Standard (Framework)
created: 2023/03/15
---

# AIP-14 - Generic Operations of Algebraic Structures
## Summary

This AIP proposes some generic functions and structs for performing operations on cryptographic algebraic structures in Move.

The initial list of supported generic operations includes group/field element serialization/deserialization, basic arithmetic, pairing, hash-to-structure, casting.

The list of supported groups starts with groups/fields used in BLS12-381, a popular pairing-friendly curve as described [here](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-pairing-friendly-curves-11#name-bls-curves-for-the-128-bit-).

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

    /// Return the additive identity of field `S`, or the identity of group `S`.
    public fun zero<S>(): Element<S>;

    /// Return the multiplicative identity of field `S`, or a fixed generator of group `S`.
    public fun one<S>(): Element<S>;

    /// Compute `-x` for an element `x` of a structure `S`.
    public fun neg<S>(x: &Element<S>): Element<S>;

    /// Compute `x + y` for elements `x` and `y` of a structure `S`.
    public fun add<S>(x: &Element<S>, y: &Element<S>): Element<S>;

    /// Compute `x - y` for elements `x` and `y` of a structure `S`.
    public fun sub<S>(x: &Element<S>, y: &Element<S>): Element<S>;

    /// Try computing `x^(-1)` for an element `x` of a structure `S`.
    /// Return none if `x` is the additive identity of structure `S`.
    public fun inv<S>(x: &Element<S>): Option<Element<S>>;

    /// Compute `x * y` for elements `x` and `y` of a structure `S`.
    public fun mul<S>(x: &Element<S>, y: &Element<S>): Element<S>;

    /// Try computing `x / y` for elements `x` and `y` of a structure `S`.
    /// Return none if y is the additive identity of structure `S`.
    public fun div<S>(x: &Element<S>, y: &Element<S>): Option<Element<S>>;

    /// Compute `x^2` for an element `x` of a structure `S`.
    public fun sqr<S>(x: &Element<S>): Element<S>;

    /// Compute `2*P` for an element `P` of a structure `G`. Faster and cheaper than `P + P`.
    public fun double<G>(element_p: &Element<G>): Element<G>;

    /// Compute `k*P`, where `P` is an element of a group `G` and `k` is an element of the scalar field `S` of group `G`.
    public fun scalar_mul<G, S>(element_p: &Element<G>, scalar_k: &Element<S>): Element<G>;

    /// Compute `k[0]*P[0]+...+k[n-1]*P[n-1]`, where
    /// `P[]` are `n` elements of group `G` represented by parameter `elements`, and
    /// `k[]` are `n` elements of the scalar field `S` of group `G` represented by parameter `scalars`.
    ///
    /// Abort with code 0x010000 if the sizes of `elements` and `scalars` do not match.
    public fun multi_scalar_mul<G, S>(elements: &vector<Element<G>>, scalars: &vector<Element<S>>): Element<G>;

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
    public fun order<G>(): vector<u8>;

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

    #[test_only]
    /// Generate a random element of an algebraic structure `S`.
    public fun rand_insecure<S>(): Element<S>;

```

In general, every structure implements basic operations like (de)serialization, equality check, random sampling.

A group may also implement the following operations. (Additive notions are used.)
- `order()` for group order.
- `zero()` for group identity.
- `one()` for group generator (if exists).
- `neg()` for inverse.
- `add()` for a basic group operation.
- `sub()` for group element subtraction.
- `double()` for efficient doubling.
- `scalar_mul()` for group scalar multiplication.
- `multi_scalar_mul()` for efficient group multi-scalar multiplication.
- `hash_to()` for hash-to-group.

A field may also implement the following operations.
- `zero()` for the field additive identity.
- `one()` for the field multiplicative identity.
- `add()` for field addition.
- `sub()` for field subtraction.
- `mul()` for field multiplication.
- `div()` for field division.
- `neg()` for field negation.
- `inv()` for field inversion.
- `sqr()` for efficient field element squaring.
- `from_u64()` for quick conversion from u64 to field element.

For 3 groups that form a bilinear map, `pairing()` and `multi_pairing()` may be implemented.

For a subset/superset relationship between 2 structures, `upcast()` and `downcast()` may be implemented.

#### Shared Scalar Fields

Some groups share the same group order,
and an ergonomic design from this is to
allow multiple groups to share the same scalar field
(mainly for the purpose scalar multiplication),
if they have the same order.

E.g. the following should be supported.

```rust
// algebra.move
pub fun scalar_mul<G,S>(element: &Element<G>, scalar: &Scalar<S>)...

// user_contract.move
**let k: Scalar<ScalarForBx> = somehow_get_k();**
let p1 = one<GroupB1>();
let p2 = one<GroupB2>();
let q1 = scalar_mul<GroupB1, ScalarForBx>(&p1, &k);
let q2 = scalar_mul<GroupB2, ScalarForBx>(&p2, &k);
```

#### Handling Incorrect Type Parameter(s)

There is currently no easy way to ensure type safety for the generic operations.
E.g., `pairing<A,B,C>(a,b,c)` can compile even there is no pairing between `A,B,C` existing/implemented.

Therefore the backend should handle the type checks at runtime.

If a group operations that takes 2+ type parameters is invoked with incompatible type parameters, it should abort.
E.g. `scalar_mul<GroupA, ScalarForBx>()` should abort with a “not implemented” error.

Invoking operation functions with user-defined types should also abort with a “not implemented” error.

### Implementation of BLS12-381 structures

The construction of BLS12-381 curves involve many groups/fields, some frequently interacted by applications (e.g., `Fq12`, `Fr`, `G1Affine`, `G2Affine`, `Gt`) while others rarely used. Marker types for using these structures with `aptos_std::algebra` APIs should be defined and exposed to developers, along with their widely-used serialization formats and hash-to-group suites, (ideally in its own module named `aptos_std::algebra_bls12381`).

Below are the full specification in pseudo-Move.

NOTE: some items below are marked "not implemented" but still presented here to facilitate the definition of some other items.

```rust
module aptos_std::algebra_bls12381 {
    /// The finite field $F_q$ used in BLS12-381 curves.
    ///
    /// NOTE: not implemented.
    struct Fq {}

    /// A serialization format for `Fq` elements,
    /// where an element is represented by a byte array `b[]` of size 48 with the least signature byte coming first.
    ///
    /// NOTE: not implemented.
    struct FqFormatLsb {}

    /// A serialization format for `Fq` elements,
    /// where an element is represented by a byte array `b[]` of size 48 with the most significant byte coming first.
    ///
    /// NOTE: not implemented.
    struct FqFormatMsb {}

    /// The finite field $F_{q^2}$ used in BLS12-381 curves.
    /// It is an extension field of `Fq`, constructed as $F_{q^2}=F_q[u]/(u^2+1)$.
    ///
    /// NOTE: not implemented.
    struct Fq2 {}

    /// A serialization format for `Fq2` elements.
    /// where an element in the form $(c_0+c_1\cdot u)$ is represented by a byte array `b[]` of size 96
    /// with the following rules.
    /// - `b[0..48]` is $c_0$ serialized using `FqFormatLsb`.
    /// - `b[48..96]` is $c_1$ serialized using `FqFormatLsb`.
    ///
    /// NOTE: not implemented.
    struct Fq2FormatLscLsb {}

    /// A serialization format for `Fq2` elements,
    /// where an element in the form $(c_1\cdot u+c_0)$ is represented by a byte array `b[]` of size 96,
    /// with the following rules.
    /// - `b[0..48]` is $c_1$ serialized using `FqFormatMsb`.
    /// - `b[48..96]` is $c_0$ serialized using `FqFormatMsb`.
    ///
    /// NOTE: not implemented.
    struct Fq2FormatMscMsb {}

    /// The finite field $F_{q^6}$ used in BLS12-381 curves.
    /// It is an extension field of `Fq2`, constructed as $F_{q^6}=F_{q^2}[v]/(v^3-u-1)$.
    ///
    /// NOTE: not implemented.
    struct Fq6 {}

    /// A serialization scheme for `Fq6` elements,
    /// where an element $(c_0+c_1\cdot v+c_2\cdot v^2)$ is represented by a byte array `b[]` of size 288,
    /// with the following rules.
    /// - `b[0..96]` is $c_0$ serialized using `Fq2FormatLscLsb`.
    /// - `b[96..192]` is $c_1$ serialized using `Fq2FormatLscLsb`.
    /// - `b[192..288]` is $c_2$ serialized using `Fq2FormatLscLsb`.
    ///
    /// NOTE: not implemented.
    struct Fq6FormatLscLsb {}

    /// The finite field $F_{q^12}$ used in BLS12-381 curves.
    /// It is an extension field of `Fq6`, constructed as $F_{q^12}=F_{q^6}[w]/(w^2-v)$.
    struct Fq12 {}

    /// A serialization scheme for `Fq12` elements,
    /// where an element $(c_0+c_1\cdot w)$ is represented by a byte array `b[]` of size 576.
    /// `b[0..288]` is $c_0$ serialized using `Fq6FormatLscLsb`.
    /// `b[288..576]` is $c_1$ serialized using `Fq6FormatLscLsb`.
    struct Fq12FormatLscLsb {}

    /// A group constructed by the points on the BLS12-381 curve $E(F_q): y^2=x^3+4$ and the point at inifinity,
    /// under the elliptic curve point addition.
    ///
    /// NOTE: not implemented.
    struct G1AffineParent {}

    /// An uncompressed serialization scheme for `G1AffineParent` elements specified in
    /// https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-pairing-friendly-curves-11#name-zcash-serialization-format-.
    ///
    /// NOTE: not implemented.
    struct G1AffineParentFormatUncompressed {}

    /// A compressed serialization scheme for `G1AffineParent` elements specified in
    /// https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-pairing-friendly-curves-11#name-zcash-serialization-format-.
    ///
    /// NOTE: not implemented.
    struct G1AffineParentFormatCompressed {}

    /// The group $G_1$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
    /// It is subgroup of `G1AffineParent`.
    struct G1Affine {}

    /// A serialization format for `G1Affine` elements,
    /// essentially the format represented by `G1AffineParentFormatUncompressed`
    /// but only applicable to `G1Affine` elements.
    struct G1AffineFormatUncompressed {}

    /// A serialization format for `G1Affine` elements,
    /// essentially the format represented by `G1AffineParentFormatCompressed`
    /// but only applicable to `G1Affine` elements.
    struct G1AffineFormatCompressed {}

    /// A group constructed by the points on a curve $E'(F_{q^2}): y^2=x^3+4(u+1)$
    /// and the point at inifinity, under the elliptic curve point addition.
    ///
    /// NOTE: not implemented.
    struct G2AffineParent {}

    /// An uncompressed serialization scheme for `G2AffineParent` elements specified in
    /// https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-pairing-friendly-curves-11#name-zcash-serialization-format-.
    ///
    /// NOTE: not implemented.
    struct G2AffineParentFormatUncompressed {}

    /// A compressed serialization scheme for `G2AffineParent` elements specified in
    /// https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-pairing-friendly-curves-11#name-zcash-serialization-format-.
    ///
    /// NOTE: not implemented.
    struct G2AffineParentFormatCompressed {}

    /// The group $G_2$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
    /// It is a subgroup of `G2AffineParent`.
    struct G2Affine {}

    /// A serialization scheme for `G2Affine` elements,
    /// essentially `G2AffineParentFormatUncompressed` but only applicable to `G2Affine` elements.
    ///
    /// NOTE: not implemented.
    struct G2AffineFormatUncompressed {}

    /// A serialization scheme for `G2Affine` elements,
    /// essentially `G2AffineParentFormatCompressed` but only applicable to `G2Affine` elements.
    ///
    /// NOTE: not implemented.
    struct G2AffineFormatCompressed {}

    /// The group $G_t$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
    /// It is a multiplicative subgroup of `Fq12`.
    struct Gt {}

    /// A serialization scheme for `Gt` elements,
    /// essentially `Fq12FormatLscLsb` but only applicable to `Gt` elements.
    struct GtFormat {}

    /// The finite field $F_r$ that can be used as the scalar fields
    /// for the groups $G_1$, $G_2$, $G_t$ in BLS12-381-based pairing.
    struct Fr {}

    /// A serialization format for `Fr` elements,
    /// where an element is represented by a byte array `b[]` of size 32 with the least significant byte coming first.
    struct FrFormatLsb {}

    /// A serialization scheme for `Fr` elements,
    /// where an element is represented by a byte array `b[]` of size 32 with the most significant byte coming first.
    struct FrFormatMsb {}
}
```

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/6550/files](https://github.com/aptos-labs/aptos-core/pull/6550/files)

## Risks and Drawbacks

For move application developers, constructing cryptographic schemes manually with these building blocks can be error-prone, or even result in vulnerable applications.

## Future Potential

The module can be extended to support more structures and operations, allowing more complicated cryptographic applications to be built.

Once Move interface is available, it can be use to rewrite the move side specifications to ensure type safety at compile time.

## Suggested implementation timeline

The change should be available on devnet in April 2023.
