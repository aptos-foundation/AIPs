---
aip: 46
title: New modules for ElGamal, Pedersen and Bulletproofs over Ristretto255
author: Michael Straka (michael@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/185
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 07/21/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-46 - New modules for ElGamal, Pedersen and Bulletproofs over Ristretto255

## Summary

> Include a brief description summarizing the intended change. This should be no more than a couple of sentences. Discuss the business impact and business value this change would impact.

This AIP proposes three **new Move modules** for cryptographic operations as part of the Aptos framework.

- A [Bulletproofs](https://crypto.stanford.edu/bulletproofs/) ZK range proof verifier (over Ristretto255), in `aptos_std::ristretto255_bulletproofs`
- [ElGamal encryption](https://en.wikipedia.org/wiki/ElGamal_encryption) (over Ristretto255), in `aptos_std::ristretto255_elgamal`
- [Pedersen commitments](https://crypto.stackexchange.com/questions/64437/what-is-a-pedersen-commitment) (over Ristretto255), in `aptos_std::ristretto255_pedersen`

All three modules can be used for various cryptographic applications. The Bulletproofs verifier is implemented as a native function, which could be slightly cheaper in terms of gas as opposed to implementing it on top of the [`ristretto255` module](https://aptos.dev/reference/move/?branch=mainnet&page=aptos-stdlib/doc/ristretto255.md#0x1_ristretto255).

In addition, this AIP also proposes **adding new functions** to the [`ristretto255` elliptic curve module](https://aptos.dev/reference/move/?branch=mainnet&page=aptos-stdlib/doc/ristretto255.md#0x1_ristretto255) to support:

1. A native function point cloning, called `point_clone`

2. A native function for double scalar multiplications, called `double_scalar_mul`
3. A non-native function for creating scalars from u32 values, called `new_scalar_from_u32`
4. A non-native function for converting a [`CompressedRistretto`](https://aptos.dev/reference/move/?branch=mainnet&page=aptos-stdlib/doc/ristretto255.md#0x1_ristretto255_CompressedRistretto) to a sequence of bytes, called `compressed_point_to_bytes`
5. A non-native function for return a point by hashing the Ristretto255 basepoint, called `hash_to_point_base`

Lastly, this AIP proposes **deprecating** two previous functions by renaming them to be more clear:

1. Deprecate `new_point_from_sha512` for  `new_point_from_sha2_512`
2. Deprecate `new_scalar_from_sha512` for  `new_scalar_from_sha2_512`

## Motivation

> Describe the impetus for this change. What does it accomplish? What might occur if we do not accept this proposal?

This AIP provides a more robust suite of cryptography tools for Move developers. Bulletproofs in particular may be useful for confidential transactions, such as those done on Monero.  ElGamal can also be useful for confidential transactions, or any other application needing private homomorphically additive values. Pedersen commitments also have applications for confidential transactions. Ristretto255 may be useful to any developer needing a relatively efficient and secure curve without pairing functionality - the new functions added make its module easier to use. 

## Impact

> Which audiences are impacted by this change? What type of action does the audience need to take?

The above benefits aside, this will marginally increase the Move standard library size. 

## Rationale

> Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

Bulletproofs is a simple and efficient protocol for range proofs over private values. It has also been well-studied and adapted in the literature, making it likely to be secure. 

ElGamal encryption done in the exponent allows for homomorphic addition of ciphertexts, i.e. encrypted values can be added together without revealing them. 

Ristretto255 combines the efficiency of non-prime order curves with the ease of implementation at the protocol level of prime order curves. This makes it ideal for many applications. Adding functions for point cloning and double scalar multiplications makes the pre-existing module easier to use. 


## Specification

> Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

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

## Reference Implementation

> This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. IDeally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

**TODO:** include links to PR

## Risks and Drawbacks

> Express here the potential negative ramifications of taking on this proposal. What are the hazards?

Future obsolescence is often a risk when implementing cryptography primitives. As of writing this, both Ristretto255 and Bulletproofs have been in use for several years, making their continued used in the immediate future more likely than not. ElGamal encryption and Pedersen commitments have been in use for multiple decades.

## Future Potential

> Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

**TODO:** answer

## Timeline

### Suggested implementation timeline

> Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

The implementation effort has already finished; see [PR 3444]().

### Suggested developer platform support timeline

> Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

### Suggested deployment timeline

>  When should community expect to see this deployed on devnet?

It should be avaiable now: e.g., see the devnet explorer view of [the Bulletproofs module](https://explorer.aptoslabs.com/account/0x1/modules/code/ristretto255_bulletproofs?network=devnet).

> On testnet?

Release 1.7

> On mainnet?

Release 1.7

## Security Considerations

> Has this change being audited by any auditing firm? 
> Any potential scams? What are the mitigation strategies?
> Any security implications/considerations?
> Any security design docs or auditing materials that can be shared?

The Move module implementations have not been audited directly. The dalek-cryptography Ristretto255 and Bulletproofs Rust libraries they leverage, however, have been audited by QuarksLabs [here](https://blog.quarkslab.com/resources/2019-08-26-audit-dalek-libraries/19-06-594-REP.pdf).

## Testing

> What is the testing plan? How is this being tested?

Multiple unit tests have been written in the Ristretto255 and Bulletproofs implementations linked above. The ElGamal and Pedersen modules are exercised in unit tests in the [veiled coin](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/veiled_coin/sources/veiled_coin.move) Move example module.
