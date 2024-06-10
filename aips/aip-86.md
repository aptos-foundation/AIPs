---
aip: 86
title: BN254 elliptic curve arithmetic in Move
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/437
Status: Draft # <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 05/31/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): 20

---

# AIP-86: BN254 elliptic curve arithmetic in Move

## Summary

This feature allows Move smart contract developers to efficiently implement BN254[^bn-curves]$^,$[^bn-blog] elliptic curve arithemetic operations via the `crypto_algebra` Move module from AIP-20[^aip-20].

BN254 is a popular elliptic curve, partly due to its Ethereum precompile support[^eth-bn254] and efficiency. For example, many zero-knowledge (ZK) projects are building on top of BN254[^gnark-crypto]$^,$[^barretenberg]$^,$[^keyless].

## High-level Overview

The BN254 Move module is implemented in `aptos_std::bn254_algebra`[^bn254-move] on top of the `aptos_std::crypto_algebra` Move module.

## Impact

Move developers who are interested in developing (zero-knowledge) cryptography applications on top of BN254 should familiarize themselves with the proposed `bn254_algebra` module (and the underlying `crypto_algebra` module from AIP-20[^aip-20]).

## Alternative solutions

The alternative solution is to manually implement the BN254 elliptic curve arithmetic in Move, without natives, which is too expensive in terms of gas.

## Specification and Implementation Details

The BN254 Move module is efficiently implemented in `aptos_std::bn254_algebra`[^bn254-move] via native functions, in the same fashion as the BLS12-381 Move module in AIP-20[^aip-20].

## Reference Implementation

The implementation abides by the `crypto_algebra` paradigm: we define BN254-specific types in `bn254_algebra` and implement native support for them.

The new relevant Move types defined in `bn254_algebra` are:

```rust
/// The finite field $F_r$ that can be used as the scalar fields
/// associated with the groups $G_1$, $G_2$, $G_t$ in BN254-based pairing.
struct Fr {}

/// A serialization format for `Fr` elements.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatFrLsb {}

/// A serialization scheme for `Fr` elements.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatFrMsb {}

/// The finite field $F_q$ that can be used as the base field of $G_1$
struct Fq {}

/// A serialization format for `Fq` elements.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatFqLsb {}

/// A serialization scheme for `Fq` elements.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatFqMsb {}

/// The finite field $F_{q^12}$ used in BN254 curves,
/// which is an extension field of `Fq6`, constructed as $F_{q^12}=F_{q^6}[w]/(w^2-v)$.
/// The field can downcast to `Gt` if it's an element of the multiplicative subgroup `Gt` of `Fq12`.
struct Fq12 {}

/// A serialization scheme for `Fq12` elements.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatFq12LscLsb {}

/// The group $G_1$ in BN254-based pairing $G_1 \times G_2 \rightarrow G_t$.
/// It is a subgroup of `G1Full`.
struct G1 {}

/// A serialization scheme for `G1` elements derived from arkworks.rs.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatG1Uncompr {}

/// A serialization scheme for `G1` elements derived from arkworks.rs
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatG1Compr {}

/// The group $G_2$ in BN254-based pairing $G_1 \times G_2 \rightarrow G_t$.
/// It is a subgroup of `G2Full`.
struct G2 {}

/// A serialization scheme for `G2` elements derived from arkworks.rs.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatG2Uncompr {}

/// A serialization scheme for `G1` elements derived from arkworks.rs
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatG2Compr {}

/// The group $G_t$ in BN254-based pairing $G_1 \times G_2 \rightarrow G_t$.
/// It is a multiplicative subgroup of `Fq12`, so it  can upcast to `Fq12`.
/// The identity of `Gt` is 1.
struct Gt {}

/// A serialization scheme for `Gt` elements.
///
/// NOTE: other implementation(s) using this format: ark-bn254-0.4.0.
struct FormatGt {}
```



## Testing

We have tests for:

- (de)serialization of these types
- (multi) scalar multiplications
- (multi) pairings
- other group and field operations (addition, subtraction, negation, etc.)
- in-memory limits

## Risks and Drawbacks

One risk could be that the gas costs might not be well calibrated. This could either make this Module too expensive or too cheap to use. Future work on automatic gas calibration will mitigate against this.

## Security Considerations

The Move module is implemented using the `arkworks` library. Bugs in this library would yield bugs in our Move module. Additional bugs could be present in our own use of `arkworks`.

Such bugs could break the soundness and/or correctness of the Move applications built on top of this BN254 module.

To mitigate against this, we have [thoroughly tested our implementation](#Testing).

## Future Potential

BN254 elliptic curves should expand the set of cryptography applications built in Move on Aptos.

## Timeline

### Suggested implementation timeline

Done.

### Suggested developer platform support timeline

There is no such support needed.

### Suggested deployment timeline

This is already deployed on devnet.

Enabled on testnet in the v1.12 release.

Enabled on mainnet in the v1.14 release.

## Open Questions (Optional)

None.

## References

[^aip-20]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-20.md ↩
[^barretenberg]: https://github.com/AztecProtocol/barretenberg
[^bn254-move]: https://github.com/aptos-labs/aptos-core/blob/aptos-release-v1.12/aptos-move/framework/aptos-stdlib/sources/cryptography/bn254_algebra.move
[^bn-curves]: https://eprint.iacr.org/2005/133
[^bn-blog]: https://hackmd.io/@jpw/bn254
[^eth-bn254]: https://eips.ethereum.org/EIPS/eip-196
[^gnark-crypto]: https://github.com/Consensys/gnark-crypto
[^keyless]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md
