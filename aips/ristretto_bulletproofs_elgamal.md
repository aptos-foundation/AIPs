---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Bulletproofs, Pedersen and ElGamal Move Stdlib Modules Over Ristretto255
author: Michael Straka (michael@aptoslabs.com)
Status: Draft
type: Standard (Framework)
created: <07/21/2023>
---

# AIP-X - Bulletproofs, Pedersen, and ElGamal Move Stdlib Modules Over Ristretto255
  
(Please give a temporary file name to your AIP when first drafting it, AIP manager will assign a number to it after reviewing)
## Summary

This AIP proposes three new Move standard library cryptography modules, one implementing the [Bulletproofs](https://crypto.stanford.edu/bulletproofs/) range proof verifier, another implementing [ElGamal encryption](https://en.wikipedia.org/wiki/ElGamal_encryption), and a third implementing [Pedersen commitments](https://crypto.stackexchange.com/questions/64437/what-is-a-pedersen-commitment). All three modules can be used for various applications. Bulletproofs is implementing using underlying native functions written in Rust. In addition, this AIP also proposes additional functions to be added to the already existing Ristretto255 elliptic curve module. These functions include natives for point cloning and double scalar multiplications, in addition to non-natives for creating scalars from u32 values, serializing compressed points, and getting the hash-to-point value of the Ristretto255 basepoint. 

## Motivation

This AIP provides a more robust suite of cryptography tools for Move developers. Bulletproofs in particular may be useful for confidential transactions, such as those done on Monero.  ElGamal can also be useful for confidential transactions, or any other application needing private homomorphically additive values. Pedersen commitments also have applications for confidential transactions. Ristretto255 may be useful to any developer needing a relatively efficient and secure curve without pairing functionality - the new functions added make its module easier to use. 

## Impact

The above benefits aside, this will marginally increase the Move standard library size. 

## Rationale

Bulletproofs is a simple and efficient protocol for range proofs over private values. It has also been well-studied and adapted in the literature, making it likely to be secure. 

ElGamal encryption done in the exponent allows for homomorphic addition of ciphertexts, i.e. encrypted values can be added together without revealing them. 

Ristretto255 combines the efficiency of non-prime order curves with the ease of implementation at the protocol level of prime order curves. This makes it ideal for many applications. Adding functions for point cloning and double scalar multiplications makes the pre-existing module easier to use. 


## Specification

Both the new modules and the additions to the Ristretto255 module have already been implemented:

[Ristretto255](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255.move)

[Bulletproofs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_bulletproofs.move)

[ElGamal Encryption](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_elgamal.move)

[Pedersen Commitments](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_pedersen.move)

The Ristretto255 module is implemented using the dalek cryptography [curve25519 crate](https://github.com/dalek-cryptography/curve25519-dalek).

The Bulletproofs module is implemented using the dalek cryptography [bulletproofs crate](https://github.com/dalek-cryptography/bulletproofs).

The ElGamal encryption and Pedersen commitment modules are implemented without Move natives over the Ristretto255 Move module referenced above. 

The original academic papers for each scheme can be found below:

[Bulletproofs](https://eprint.iacr.org/2017/1066.pdf)

[ElGamal Encryption](https://caislab.kaist.ac.kr/lecture/2010/spring/cs548/basic/B02.pdf)

[Pedersen Commitments](https://link.springer.com/content/pdf/10.1007/3-540-46766-1_9.pdf)

Further information on Ristretto255 can be found [here](https://ristretto.group/).

## Risks and Drawbacks

Future obsolescence is often a risk when implementing cryptography primitives. As of writing this, both Ristretto255 and Bulletproofs have been in use for several years, making their continued used in the immediate future more likely than not. ElGamal encryption and Pedersen commitments have been in use for multiple decades.
## Timeline

### Suggested deployment timeline

When should community expect to see this deployed on devnet?

Reasonably soon.

On testnet?

After devnet.

On mainnet?

After testnet.

## Security Considerations

The Move module implementations have not been audited directly. The dalek-cryptography Ristretto255 and Bulletproofs Rust libraries they leverage, however, have been audited by QuarksLabs [here](https://blog.quarkslab.com/resources/2019-08-26-audit-dalek-libraries/19-06-594-REP.pdf).

## Testing

Multiple unit tests have been written in the Ristretto255 and Bulletproofs implementations linked above. The ElGamal and Pedersen modules are exercised in unit tests in the [veiled coin](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/veiled_coin/sources/veiled_coin.move) Move example module.
