---
aip: 20
title: Generic Cryptography Algebra and BLS12-381 Implementation
author: zhoujun-ma, alin
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/94
Status: Accepted
type: Standard (Framework)
created: 2023/03/15
---

# AIP-20 - Generic Cryptography Algebra and BLS12-381 Implementation
## Summary

This AIP proposes the support of generic cryptography algebra operations in Aptos standard library.

The initial list of the supported generic operations includes group/field element serialization/deserialization, basic arithmetic, pairing, hash-to-structure, casting.

The initial list of supported algebraic structures includes groups/fields used in BLS12-381, a popular pairing-friendly curve as described [here](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-pairing-friendly-curves-11#name-bls-curves-for-the-128-bit-).

Either the operation list or the structure list can be extended by future AIPs.

## Motivation

Algebraic structures are fundamental building blocks for many cryptographic schemes, but also hard to implement efficiently in pure Move.
This change should allow Move developers to implement generic constructions of those schemes, then get different instantiations by only switching the type parameter(s).

For example, if BLS12-381 groups and BN254 groups are supported, one can implement a generic Groth16 proof verifier construction, then be able to use both BLS12-381-based Groth16 proof verifier and BN254-based Groth16 proof verifier.

BLS12-381-based Groth16 proof verifier has been implemented this way as part of the reference implementation.

## Rationale

### Generic API

An alternative non-generic approach is to expose instantiated schemes directly in aptos_stdlib.
For example, we can define a Groth16 proof verification function
`0x1::groth16_<curve>::verify_proof(vk, proof, public_inputs): bool`
for every pairing-friendly elliptic curve `<curve>`.

For ECDSA signatures which require a hash function and a group, we can define
`0x1::ecdsa_<hash>_<group>::verify_signature(pk, msg, sig):bool`
for each pair of proper hash function `<hash>` and group `<group>`.

Compared with the proposed approach, the alternative approach saves the work of constructing the schemes for Move developers. However, the size of aptos_stdlib can multiply too fast in the future.
Furthermore, the non-generic approach is not scalable from a development standpoint: a new native is needed for every combination of cryptosystem and its underlying algebraic structure (e.g., elliptic curve).

To keep the Aptos stdlib concise while still covering as many use cases as possible, the proposed generic approach should be chosen over the alternative approach.

### Backend Dispatch Framework

On the backend, the native functions for the generic API implement dynamic dispatch:
they act based on the given marker types.
E.g., in the context of BLS12-381,
the native for `add<S>(x: &Element<S>, y:&Element<S>): Element<S>` will calculate `x*y`
if `S` is `Gt` that represents the multiplicative subgroup `Gt` in BLS12-381,
or `x+y` if `S` is the scalar field `Fr`.

This is required by the generic API design.

## Specifications

### Generic Operations

#### Structs and Functions

Module `aptos_std::crypto_algebra` is designed to have the following definitions.

- A generic struct `Element<S>` that represents an element of algebraic structure `S`.
- Generic functions that represent group/field operations.

Below is the full specification in pseudo-Move.

```rust
module aptos_std::crypto_algebra {
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
    /// Return none if `x` does not have a multiplicative inverse in the structure `S`
    /// (e.g., when `S` is a field, and `x` is zero).
    public fun inv<S>(x: &Element<S>): Option<Element<S>>;

    /// Compute `x * y` for elements `x` and `y` of a structure `S`.
    public fun mul<S>(x: &Element<S>, y: &Element<S>): Element<S>;

    /// Try computing `x / y` for elements `x` and `y` of a structure `S`.
    /// Return none if `y` does not have a multiplicative inverse in the structure `S`
    /// (e.g., when `S` is a field, and `y` is zero).
    public fun div<S>(x: &Element<S>, y: &Element<S>): Option<Element<S>>;

    /// Compute `x^2` for an element `x` of a structure `S`. Faster and cheaper than `mul(x, x)`.
    public fun sqr<S>(x: &Element<S>): Element<S>;

    /// Compute `2*P` for an element `P` of a structure `S`. Faster and cheaper than `add(P, P)`.
    public fun double<G>(element_p: &Element<G>): Element<G>;

    /// Compute `k*P`, where `P` is an element of a group `G` and `k` is an element of the scalar field `S` of group `G`.
    public fun scalar_mul<G, S>(element_p: &Element<G>, scalar_k: &Element<S>): Element<G>;

    /// Compute `k[0]*P[0]+...+k[n-1]*P[n-1]`, where
    /// `P[]` are `n` elements of group `G` represented by parameter `elements`, and
    /// `k[]` are `n` elements of the scalarfield `S` of group `G` represented by parameter `scalars`.
    ///
    /// Abort with code `std::error::invalid_argument(E_NON_EQUAL_LENGTHS)` if the sizes of `elements` and `scalars` do not match.
    public fun multi_scalar_mul<G, S>(elements: &vector<Element<G>>, scalars: &vector<Element<S>>): Element<G>;

    /// Efficiently compute `e(P[0],Q[0])+...+e(P[n-1],Q[n-1])`,
    /// where `e: (G1,G2) -> (Gt)` is a pre-compiled pairing function from groups `(G1,G2)` to group `Gt`,
    /// `P[]` are `n` elements of group `G1` represented by parameter `g1_elements`, and
    /// `Q[]` are `n` elements of group `G2` represented by parameter `g2_elements`.
    ///
    /// Abort with code `std::error::invalid_argument(E_NON_EQUAL_LENGTHS)` if the sizes of `g1_elements` and `g2_elements` do not match.
    public fun multi_pairing<G1,G2,Gt>(g1_elements: &vector<Element<G1>>, g2_elements: &vector<Element<G2>>): Element<Gt>;

    /// Compute a pre-compiled pairing function (a.k.a., bilinear map) on `element_1` and `element_2`.
    /// Return an element in the target group `Gt`.
    public fun pairing<G1,G2,Gt>(element_1: &Element<G1>, element_2: &Element<G2>): Element<Gt>;

    /// Try deserializing a byte array to an element of an algebraic structure `S` using a given serialization format `F`.
    /// Return none if the deserialization failed.
    public fun deserialize<S, F>(bytes: &vector<u8>): Option<Element<S>>;

    /// Serialize an element of an algebraic structure `S` to a byte array using a given serialization format `F`.
    public fun serialize<S, F>(element: &Element<S>): vector<u8>;

    /// Get the order of structure `S`, a big integer little-endian encoded as a byte array.
    public fun order<G>(): vector<u8>;

    /// Cast an element of a structure `S` to a super-structure `L`.
    public fun upcast<S,L>(element: &Element<S>): Element<L>;

    /// Try casting an element `x` of a structure `L` to a sub-structure `S`.
    /// Return none if `x` is not a member of `S`.
    ///
    /// NOTE: Membership check is performed inside, which can be expensive, depending on the structures `L` and `S`.
    public fun downcast<L,S>(element_x: &Element<L>): Option<Element<S>>;

    /// Hash an arbitrary-length byte array `msg` into structure `S` with a domain separation tag `dst`
    /// using the given hash-to-structure suite `H`.
    public fun hash_to<St, Su>(dst: &vector<u8>, msg: &vector<u8>): Element<St>;

    #[test_only]
    /// Generate a random element of an algebraic structure `S`.
    public fun rand_insecure<S>(): Element<S>;

```

In general, every structure implements basic operations like (de)serialization, equality check, random sampling.

For example, A group may also implement the following operations. (Additive notions are used.)
- `order()` for getting the group order.
- `zero()` for getting the group identity.
- `one()` for getting the group generator (if exists).
- `neg()` for group element inversion.
- `add()` for basic group operation.
- `sub()` for group element subtraction.
- `double()` for efficient group element doubling.
- `scalar_mul()` for group scalar multiplication.
- `multi_scalar_mul()` for efficient group multi-scalar multiplication.
- `hash_to()` for hash-to-group.

As another example, a field may also implement the following operations.
- `order()` for getting the field order.
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

Similarly, for 3 groups `G1`, `G2`, `Gt` that admit a bilinear map, `pairing<G1, G2, Gt>()` and `multi_pairing<G1, G2, Gt>()` may be implemented.

For a subset/superset relationship between 2 structures, `upcast()` and `downcast()` may be implemented.
E.g., in BLS12-381 `Gt` is a multiplicative subgroup from `Fq12` so upcasting from `Gt` to `Fq12` and downcasting from `Fq12` to `Gt` can be supported.

#### Shared Scalar Fields

Some groups share the same group order,
and an ergonomic design for this is to
allow multiple groups to share the same scalar field
(mainly for the purpose of scalar multiplication),
if they have the same order.

In other words, the following should be supported.

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
E.g., `pairing<A,B,C>(a,b,c)` can compile even if groups `A`, `B` and `C` do not admin a pairing.

Therefore, the backend should handle the type checks at runtime.
For example, if a group operation that takes 2+ type parameters is invoked with incompatible type parameters, it must abort.
For example, `scalar_mul<GroupA, ScalarB>()` where `GroupA` and `ScalarB` have different orders, will abort with a “not implemented” error.

Invoking operation functions with user-defined types should also abort with a “not implemented” error.
For example, `zero<std::option::Option<u64>>()` will abort.

### Implementation of BLS12-381 structures

To support a wide-enough variety of BLS12-381 operations using the `aptos_std::crypto_algebra` API,
we implement several marker types for the relevant groups of order `r` (for `G1`, `G2` and `Gt`) and fields (e.g., `Fr`, `Fq12`).

We also implement marker types for popular serialization formats and hash-to-group suites.

Below, we describe all *possible* marker types we *could* implement for BLS12-381
and mark the ones that we actually implement as "implemented".
These, we believe, should be sufficient to support most BLS12-381 applications.

#### `Fq`
The finite field $F_q$ used in BLS12-381 curves with a prime order $q$ equal to
0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab.

#### `FormatFqLsb`
A serialization format for `Fq` elements,
where an element is represented by a byte array `b[]` of size 48 with the least significant byte (LSB) coming first.

#### `FormatFqMsb`
A serialization format for `Fq` elements,
where an element is represented by a byte array `b[]` of size 48 with the most significant byte (MSB) coming first.

#### `Fq2`
The finite field $F_{q^2}$ used in BLS12-381 curves,
which is an extension field of `Fq`, constructed as $F_{q^2}=F_q[u]/(u^2+1)$.

#### `FormatFq2LscLsb`
A serialization format for `Fq2` elements,
where an element in the form $(c_0+c_1\cdot u)$ is represented by a byte array `b[]` of size 96,
which is a concatenation of its coefficients serialized, with the least significant coefficient (LSC) coming first:
- `b[0..48]` is $c_0$ serialized using `FormatFqLsb`.
- `b[48..96]` is $c_1$ serialized using `FormatFqLsb`.

#### `FormatFq2MscMsb`
A serialization format for `Fq2` elements,
where an element in the form $(c_0+c_1\cdot u)$ is represented by a byte array `b[]` of size 96,
which is a concatenation of its coefficients serialized, with the most significant coefficient (MSC) coming first:
- `b[0..48]` is $c_1$ serialized using `FormatFqLsb`.
- `b[48..96]` is $c_0$ serialized using `FormatFqLsb`.

#### `Fq6`
The finite field $F_{q^6}$ used in BLS12-381 curves,
which is an extension field of `Fq2`, constructed as $F_{q^6}=F_{q^2}[v]/(v^3-u-1)$.

#### `FormatFq6LscLsb`
A serialization scheme for `Fq6` elements,
where an element in the form $(c_0+c_1\cdot v+c_2\cdot v^2)$ is represented by a byte array `b[]` of size 288,
which is a concatenation of its coefficients serialized, with the least significant coefficient (LSC) coming first:
- `b[0..96]` is $c_0$ serialized using `FormatFq2LscLsb`.
- `b[96..192]` is $c_1$ serialized using `FormatFq2LscLsb`.
- `b[192..288]` is $c_2$ serialized using `FormatFq2LscLsb`.

#### `Fq12` (implemented)
The finite field $F_{q^12}$ used in BLS12-381 curves,
which is an extension field of `Fq6`, constructed as $F_{q^12}=F_{q^6}[w]/(w^2-v)$.

#### `FormatFq12LscLsb` (implemented)
A serialization scheme for `Fq12` elements,
where an element $(c_0+c_1\cdot w)$ is represented by a byte array `b[]` of size 576,
which is a concatenation of its coefficients serialized, with the least significant coefficient (LSC) coming first.
- `b[0..288]` is $c_0$ serialized using `FormatFq6LscLsb`.
- `b[288..576]` is $c_1$ serialized using `FormatFq6LscLsb`.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0.

#### `G1Full`
A group constructed by the points on the BLS12-381 curve $E(F_q): y^2=x^3+4$ and the point at infinity,
under the elliptic curve point addition.
It contains the prime-order subgroup $G_1$ used in pairing.

#### `G1` (implemented)
The group $G_1$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
It is a subgroup of `G1Full` with a prime order $r$
equal to 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001.
(so `Fr` is the associated scalar field).

#### `FormatG1Uncompr` (implemented)
A serialization scheme for `G1` elements derived from https://www.ietf.org/archive/id/draft-irtf-cfrg-pairing-friendly-curves-11.html#name-zcash-serialization-format-.

Below is the serialization procedure that takes a `G1` element `p` and outputs a byte array of size 96.
1. Let `(x,y)` be the coordinates of `p` if `p` is on the curve, or `(0,0)` otherwise.
1. Serialize `x` and `y` into `b_x[]` and `b_y[]` respectively using `FormatFqMsb`.
1. Concatenate `b_x[]` and `b_y[]` into `b[]`.
1. If `p` is the point at infinity, set the infinity bit: `b[0]: = b[0] | 0x40`.
1. Return `b[]`.

Below is the deserialization procedure that takes a byte array `b[]` and outputs either a `G1` element or none.
1. If the size of `b[]` is not 96, return none.
1. Compute the compression flag as `b[0] & 0x80 != 0`.
1. If the compression flag is true, return none.
1. Compute the infinity flag as `b[0] & 0x40 != 0`.
1. If the infinity flag is set, return the point at infinity.
1. Deserialize `[b[0] & 0x1f, b[1], ..., b[47]]` to `x` using `FormatFqMsb`. If `x` is none, return none.
1. Deserialize `[b[48], ..., b[95]]` to `y` using `FormatFqMsb`. If `y` is none, return none.
1. Check if `(x,y)` is on curve `E`. If not, return none.
1. Check if `(x,y)` is in the subgroup of order `r`. If not, return none.
1. Return `(x,y)`.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0.

#### `FormatG1Compr` (implemented)
A serialization scheme for `G1` elements derived from https://www.ietf.org/archive/id/draft-irtf-cfrg-pairing-friendly-curves-11.html#name-zcash-serialization-format-.

Below is the serialization procedure that takes a `G1` element `p` and outputs a byte array of size 48.
1. Let `(x,y)` be the coordinates of `p` if `p` is on the curve, or `(0,0)` otherwise.
1. Serialize `x` into `b[]` using `FormatFqMsb`.
1. Set the compression bit: `b[0] := b[0] | 0x80`.
1. If `p` is the point at infinity, set the infinity bit: `b[0]: = b[0] | 0x40`.
1. If `y > -y`, set the lexicographical flag: `b[0] := b[0] | 0x20`.
1. Return `b[]`.

Below is the deserialization procedure that takes a byte array `b[]` and outputs either a `G1` element or none.
1. If the size of `b[]` is not 48, return none.
1. Compute the compression flag as `b[0] & 0x80 != 0`.
1. If the compression flag is false, return none.
1. Compute the infinity flag as `b[0] & 0x40 != 0`.
1. If the infinity flag is set, return the point at infinity.
1. Compute the lexicographical flag as `b[0] & 0x20 != 0`.
1. Deserialize `[b[0] & 0x1f, b[1], ..., b[47]]` to `x` using `FormatFqMsb`. If `x` is none, return none.
1. Solve the curve equation with `x` for `y`. If no such `y` exists, return none.
1. Let `y'` be `max(y,-y)` if the lexicographical flag is set, or `min(y,-y)` otherwise.
1. Check if `(x,y')` is in the subgroup of order `r`. If not, return none.
1. Return `(x,y')`.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0.

#### `G2Full`
A group constructed by the points on a curve $E'(F_{q^2}): y^2=x^3+4(u+1)$ and the point at infinity,
under the elliptic curve point addition.
It contains the prime-order subgroup $G_2$ used in pairing.

#### `G2` (implemented)
The group $G_2$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
It is a subgroup of `G2Full` with a prime order $r$ equal to
0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001.
(so `Fr` is the scalar field).

#### `FormatG2Uncompr` (implemented)
A serialization scheme for `G2` elements derived from
https://www.ietf.org/archive/id/draft-irtf-cfrg-pairing-friendly-curves-11.html#name-zcash-serialization-format-.

Below is the serialization procedure that takes a `G2` element `p` and outputs a byte array of size 192.
1. Let `(x,y)` be the coordinates of `p` if `p` is on the curve, or `(0,0)` otherwise.
1. Serialize `x` and `y` into `b_x[]` and `b_y[]` respectively using `FormatFq2MscMsb`.
1. Concatenate `b_x[]` and `b_y[]` into `b[]`.
1. If `p` is the point at infinity, set the infinity bit in `b[]`: `b[0]: = b[0] | 0x40`.
1. Return `b[]`.

Below is the deserialization procedure that takes a byte array `b[]` and outputs either a `G2` element or none.
1. If the size of `b[]` is not 192, return none.
1. Compute the compression flag as `b[0] & 0x80 != 0`.
1. If the compression flag is true, return none.
1. Compute the infinity flag as `b[0] & 0x40 != 0`.
1. If the infinity flag is set, return the point at infinity.
1. Deserialize `[b[0] & 0x1f, ..., b[95]]` to `x` using `FormatFq2MscMsb`. If `x` is none, return none.
1. Deserialize `[b[96], ..., b[191]]` to `y` using `FormatFq2MscMsb`. If `y` is none, return none.
1. Check if `(x,y)` is on the curve `E'`. If not, return none.
1. Check if `(x,y)` is in the subgroup of order `r`. If not, return none.
1. Return `(x,y)`.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0.

#### `FormatG2Compr` (implemented)
A serialization scheme for `G2` elements derived from
https://www.ietf.org/archive/id/draft-irtf-cfrg-pairing-friendly-curves-11.html#name-zcash-serialization-format-.

Below is the serialization procedure that takes a `G2` element `p` and outputs a byte array of size 96.
1. Let `(x,y)` be the coordinates of `p` if `p` is on the curve, or `(0,0)` otherwise.
1. Serialize `x` into `b[]` using `FormatFq2MscMsb`.
1. Set the compression bit: `b[0] := b[0] | 0x80`.
1. If `p` is the point at infinity, set the infinity bit: `b[0]: = b[0] | 0x40`.
1. If `y > -y`, set the lexicographical flag: `b[0] := b[0] | 0x20`.
1. Return `b[]`.

Below is the deserialization procedure that takes a byte array `b[]` and outputs either a `G2` element or none.
1. If the size of `b[]` is not 96, return none.
1. Compute the compression flag as `b[0] & 0x80 != 0`.
1. If the compression flag is false, return none.
1. Compute the infinity flag as `b[0] & 0x40 != 0`.
1. If the infinity flag is set, return the point at infinity.
1. Compute the lexicographical flag as `b[0] & 0x20 != 0`.
1. Deserialize `[b[0] & 0x1f, b[1], ..., b[95]]` to `x` using `FormatFq2MscMsb`. If `x` is none, return none.
1. Solve the curve equation with `x` for `y`. If no such `y` exists, return none.
1. Let `y'` be `max(y,-y)` if the lexicographical flag is set, or `min(y,-y)` otherwise.
1. Check if `(x,y')` is in the subgroup of order `r`. If not, return none.
1. Return `(x,y')`.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0.

#### `Gt` (implemented)
The group $G_t$ in BLS12-381-based pairing $G_1 \times G_2 \rightarrow G_t$.
It is a multiplicative subgroup of `Fq12`,
with a prime order $r$ equal to 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001.
(so `Fr` is the scalar field).
The identity of `Gt` is 1.

#### `FormatGt` (implemented)
A serialization scheme for `Gt` elements.

To serialize, it treats a `Gt` element `p` as an `Fq12` element and serialize it using `FormatFq12LscLsb`.

To deserialize, it uses `FormatFq12LscLsb` to try deserializing to an `Fq12` element then test the membership in `Gt`.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0.

#### `Fr` (implemented)
The finite field $F_r$ that can be used as the scalar fields
associated with the groups $G_1$, $G_2$, $G_t$ in BLS12-381-based pairing.

#### `FormatFrLsb` (implemented)
A serialization format for `Fr` elements,
where an element is represented by a byte array `b[]` of size 32 with the least significant byte (LSB) coming first.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0, blst-0.3.7.

#### `FormatFrMsb` (implemented)
A serialization scheme for `Fr` elements,
where an element is represented by a byte array `b[]` of size 32 with the most significant byte (MSB) coming first.

NOTE: other implementation(s) using this format: ark-bls12-381-0.4.0, blst-0.3.7.

#### `HashG1XmdSha256SswuRo` (implemented)
The hash-to-curve suite `BLS12381G1_XMD:SHA-256_SSWU_RO_` that hashes a byte array into `G1` elements.
Full specification is defined in https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-hash-to-curve-16#name-bls12-381-g1.

#### `HashG2XmdSha256SswuRo` (implemented)
The hash-to-curve suite `BLS12381G2_XMD:SHA-256_SSWU_RO_` that hashes a byte array into `G2` elements.
Full specification is defined in https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-hash-to-curve-16#name-bls12-381-g2.

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/6550/files](https://github.com/aptos-labs/aptos-core/pull/6550/files)

## Risks and Drawbacks

Developing cryptographic schemes, whether in Move or in any other language, is very difficult due to the inherent mathematic complexity of such schemes, as well as the difficulty of using cryptographic libraries securely.

As a result, we caution Move application developers that
implementing cryptographic schemes using `crypto_algebra.move` and/or the `bls12381_algebra.move` modules will be error prone and could result in vulnerable applications.

That being said, the `crypto_algebra.move` and the `bls12381_algebra.move` Move modules have been designed with safety in mind.
First, we offer a minimal, hard-to-misuse abstraction for algebraic structures like groups and fields.
Second, our Move modules are type safe (e.g., inversion in a group G returns an Option<G>).
Third, our BLS12-381 implementation always performs prime-order subgroup checks when deserializing group elements, to avoid serious implementation bugs.

## Future Potential

The `crypto_algebra.move` Move module can be extended to support more structures (e.g., new elliptic curves) and operations (e.g., batch inversion of field elements), This will:
1. Allow porting existing generic cryptosystems built on top of this module to new, potentially-faster-or-smaller curves.
2. Allow building more complicated cryptographic applications that leverage new operations or new algebraic structures (e.g., rings, hidden-order groups, etc.)

Once the Move language is upgraded with support for some kind of interfaces,
it can be use to rewrite the Move side specifications to ensure type safety at compile time.

## Suggested implementation timeline

The change should be available on devnet in April 2023.
