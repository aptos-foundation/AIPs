---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Ristretto255, Bulletproofs, and ElGamal Move Stdlib Modules
author: Michael Straka (michael@aptoslabs.com)
Status: Draft
type: Standard (Framework)
created: <07/21/2023>
---

# AIP-X - Ristretto255, Bulletproofs, and ElGamal Move Stdlib Modules
  
(Please give a temporary file name to your AIP when first drafting it, AIP manager will assign a number to it after reviewing)

## Summary

This AIP proposes three new Move standard library cryptography modules, one implementing the [Ristretto255](https://ristretto.group/) elliptic curve (technically the Curve25519 curve with additional techniques applied on top), another implementing a [Bulletproofs](https://eprint.iacr.org/2017/1066.pdf) range proof verifier, and a third implementing ElGamal encryption. All three modules can be used for various applications, and are implemented with underlying native functions written in Rust.

## Motivation

This AIP provides a more robust suite of cryptography tools for Move developers. Bulletproofs in particular may be useful for confidential transactions, such as those done on Monero. Ristretto255 mayb e useful to any developer needing a relatively efficient and secure curve without pairing functionality. ElGamal can also be useful for confidential transactions, or any other application needing private homomorphically additive values. 

## Impact

The above benefits aside, this will marginally increase the Move standard library size. 

## Rationale

Ristretto255 combines the efficiency of non-prime order curves with the ease of implementation at the protocol level of prime order curves. This makes it ideal for many applications. 

Bulletproofs is a simple and efficient protocol for range proofs over private values. It has also been well-studied and adapted in the literature, making it likely to be secure. 

ElGamal encryption done in the exponent allows for homomorphic addition of ciphertexts, i.e. encrypted values can be added together without revealing them. 

## Specification

All three modules have already been implemented:

[Ristretto255](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255.move)

[Bulletproofs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_bulletproofs.move)

[ElGamal](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_elgamal.move)

The Ristretto255 module is implemented using the dalek cryptography [curve25519 crate](https://github.com/dalek-cryptography/curve25519-dalek).

The Bulletproofs module is implemented using the dalek cryptography [bulletproofs crate](https://github.com/dalek-cryptography/bulletproofs).

The ElGamal module is implemented without Move natives over the Ristretto255 Move module referenced above. 

## Risks and Drawbacks

Future obsolescence is often a risk when implementing cryptography primitives. As of writing this, both Ristretto255 and Bulletproofs have been in use for several years, making their continued used in the immediate future more likely than not. ElGamal encryption has been in use for nearly four decades.  
## Timeline

### Suggested developer platform support timeline

Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

### Suggested deployment timeline

When should community expect to see this deployed on devnet?

On testnet?

On mainnet?

## Security Considerations

The Move module implementations have not been audited directly. The dalek-cryptography Rust libraries they leverage, however, have been audited by QuarksLabs [here](https://blog.quarkslab.com/resources/2019-08-26-audit-dalek-libraries/19-06-594-REP.pdf).

## Testing

Multiple unit tests have been written in the Ristretto255 and Bulletproofs implementations linked above. The ElGamal module is exercised in unit tests in the [veiled coin](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/veiled_coin/sources/veiled_coin.move) Move example module.
