---
aip: 46
title: New modules for ElGamal, Pedersen and Bulletproofs over Ristretto255
author: Michael Straka (michael@aptoslabs.com), Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/222
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 07/21/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-46 - New modules for ElGamal, Pedersen and Bulletproofs over Ristretto255

## Summary

> Include a brief description summarizing the intended change. This should be no more than a couple of sentences. Discuss the business impact and business value this change would impact.

This AIP proposes extending the suite of cryptographic operations in Move with three **new Move modules**:

- [ElGamal encryption](https://en.wikipedia.org/wiki/ElGamal_encryption)[^elgamal] (over Ristretto255)
- [Pedersen commitments](https://crypto.stackexchange.com/questions/64437/what-is-a-pedersen-commitment)[^pedersen] (over Ristretto255)
- A **Bulletproofs**[^bulletproofs] ZK range proof verifier (for Pedersen commitments over Ristretto255)

In addition, this AIP also proposes **adding several new functions** to the existing [`ristretto255`](https://github.com/aptos-labs/aptos-core/blob/aptos-release-v1.6/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255.move) module[^ristretto255]:

1. A native function point cloning, called `point_clone`
2. A native function for double scalar multiplications, called `double_scalar_mul`
3. A <u>non</u>-native function for creating scalars from u32 values, called `new_scalar_from_u32`
4. A <u>non</u>-native function for converting a [`CompressedRistretto`](https://aptos.dev/reference/move/?branch=mainnet&page=aptos-stdlib/doc/ristretto255.md#0x1_ristretto255_CompressedRistretto) to a sequence of bytes, called `compressed_point_to_bytes`
5. A <u>non</u>-native function for return a point by hashing the Ristretto255 basepoint, called `hash_to_point_base`

Lastly, this AIP proposes **deprecating** two previous functions by renaming them to be more clear:

1. Deprecate `new_point_from_sha512` for  `new_point_from_sha2_512`
2. Deprecate `new_scalar_from_sha512` for  `new_scalar_from_sha2_512`

## Motivation

> Describe the impetus for this change. What does it accomplish?

The impetus for this change is to provide a **more extensive suite of cryptographic tools** for Move developers. Specifically: 

- **ElGamal** is an additively-homomorphic, rerandomizable encryption scheme for “small” field elements (e.g. 40-bit wide - larger elements can be used but will not be easily decryptable).
- **Pedersen commitments** are information-theoretic hiding, computationally-binding, homomorphic commitments to field elements.
- **Bulletproofs** is a **zero-knowledge range proofs (ZKRP)**: i.e., a zero-knowledge proof that a secret value $v$ in a Pedersen commitment $g^v h^r$ is in specific range $v\in [0, 2^n]$.

These new modules will enable a wider-variety of cryptographic dapps:

- **Bulletproofs** are useful for [confidential transactions](https://en.bitcoin.it/wiki/Confidential_transactions), digital identity systems (e.g., proving you are below 18 years old), proofs of solvency[^provisions], reputation systems (e.g., proving your reputation is high enough), etc.
- **ElGamal encyption** is useful for confidential transactions, or for applications needing private, homomorphically-additive values, such as randomized shuffles in card-based games.
- **Pedersen commitments** are useful for confidential transactions, for auctioning protocols, for RANDAO-like protocols to generate randomness, etc.
- Lastly, the new functions added to the Ristretto255 module fix a few limitations in the code.

>  What might occur if we do not accept this proposal?

Not accepting this proposal, will preclude gas-efficient dapps that rely on ZK range proofs. It will also prevent the `ristretto255` module from being efficiently usable due to the lack of point cloning, as well as some other missing functionality.

## Impact

> Which audiences are impacted by this change? What type of action does the audience need to take?

This AIP affects Move developers:

- **Compilation times** will increase due to the new modules added to the Move standard library
- Developers must familiarize themselves with the new functions as well as the deprecated functions introduced in this AIP.

## Rationale

> Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

This is proposal for **new features** rather than a solution to a problem. Nonetheless, we believe these new features will lead to good outcomes because:

- Bulletproofs[^bulletproofs] has been **well-studied** in the academic literature and **deployed** in production-grade systems such as [Monero](https://web.getmonero.org/resources/moneropedia/bulletproofs.html). 
- Bulletproofs offers **small proofs** that are **fast-to-verify**.
- Bulletproofs will enable a new class of **privacy-preserving applications**.

- The modules for ElGamal encryption and Pedersen commitments over `ristretto255` will help Move developers by (1) **decreasing developement time** and (2) **precluding implementation mistakes**.
- Adding new functions for point cloning and double scalar multiplications in `ristretto255` makes this module **easier-to-use and cheaper**.


## Specification

> Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature.

Our guiding principles have been:

- Type-safety for the cryptographic Move modules
- Gas-efficiency of the native function implementing the Bulletproofs ZK range proof verifier
- Hard-to-misuse Move API design

> Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

At a high-level, the proposal is to:

- Provide a type-safe implementation of ElGamal encryption on top of the `ristretto255` module
- Provide a type-safe implementation of Pedersen commitments on top of the `ristretto255` module
- Provide a type-safe implementation of a gas-efficient ZK range proof verifier for the Pedersen commitments module from above

## Reference Implementation

> This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

[PR 3444](https://github.com/aptos-labs/aptos-core/pull/3444) summarizes our reference implementation. For ease-of-reference, the proposed changes are linked below:

- The changes to the `ristretto255` module can be seen by expanding the changes to `ristretto255.move` in the [PR here](https://github.com/aptos-labs/aptos-core/pull/3444/files#diff-24a99571d84934515c6da4d0b6ab75451b1286a3d88126afb92305e2181a5408)
- The final [`aptos_std::ristretto255_bulletproofs`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_bulletproofs.move) module
- The final [`aptos_std::ristretto255_elgamal`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_elgamal.move) module
- The final [`aptos_std::ristretto255_pedersen`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ristretto255_pedersen.move) module

### Implementation Details

- The changes to the `ristretto255` module continue to rely on the [`dalek-cryptography/curve25519`](https://github.com/dalek-cryptography/curve25519-dalek) crate.

- The Bulletproofs module is implemented using the [`zkcrypto/bulletproofs`](https://github.com/zkcrypto/bulletproofs) fork of the [`dalek-cryptography/bulletproofs`](https://github.com/dalek-cryptography/bulletproofs) crate. (Unfortunately, the `dalek-cryptography/bulletproofs` crate relies on a much older version of the `curve25519-dalek` library and could not be used.)
  - The Bulletproof ZK range proof verification is implemented as a **Move native function**

- The ElGamal encryption and Pedersen commitment modules are implemented directly in Move, **without native functions**, over the `ristretto255` Move module, showcasing its power.

## Risks and Drawbacks

> Express here the potential negative ramifications of taking on this proposal. What are the hazards?

### Obsolescence

Future obsolescence is often a risk when implementing cryptography primitives. As of writing this, both the **Ristretto255** group and the **Bulletproofs** proof system have been in use for several years, making their continued use in the immediate future more likely than not. Similarly, ElGamal encryption and Pedersen commitments are extremely-versatile, popular cryptosystems that have been in use for multiple decades.

## Future Potential

> Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

The [“Motivation”](#motivation) and [“Rationale”](#rationale) sections already summarize the many applications that could be developed on top of these modules in the future.

## Timeline

### Suggested implementation timeline

> Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

The implementation effort has already finished; see [PR 3444]().

### Suggested developer platform support timeline

> Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

Not applicable.

### Suggested deployment timeline

>  When should community expect to see this deployed on devnet?

It should be available now: e.g., see the devnet explorer view of [the Bulletproofs module](https://explorer.aptoslabs.com/account/0x1/modules/code/ristretto255_bulletproofs?network=devnet).

> On testnet?

Release 1.7.

> On mainnet?

Release 1.7.

## Security Considerations

> Has this change being audited by any auditing firm? 

No, since the proposed changes are either:

- New natives that wrap existing **audited** cryptographic libraries. 
- New modules for **simple** cryptographic primitives: i.e., Pedersen comitments and ElGamal encryption are straightforward to implement.

> Any potential scams? What are the mitigation strategies?

No potential for scams.

> Any security implications/considerations?

The security of the Bulletproofs ZK range proof system is worth clarifying. 

Bulletproofs security can be proved under the hardness of computing **discrete logarithms** in certain prime-order groups and the **random oracle model (ROM)** due to its use of the Fiat-Shamir transform[^fiatshamir].

These are the same assumptions used to prove the security of the **Ed25519 signature scheme** used in Aptos and many other blockchains. Therefore, this AIP does not introduce additional cryptographic assumptions.

That being said, this does not account for cryptographic bugs in the underlying libraries we use in [“Implementation details”](#implementation-details). Here, we can be more assured by the fact that the `dalek-cryptography` libraries [have been audited in the past](https://blog.quarkslab.com/security-audit-of-dalek-libraries.html) (see full report [here](https://blog.quarkslab.com/resources/2019-08-26-audit-dalek-libraries/19-06-594-REP.pdf)).

> Any security design docs or auditing materials that can be shared?

No.

## Testing

> What is the testing plan? How is this being tested?

- Multiple unit tests have been written in the `ristretto255` and `bulletproofs` implementations linked above.

- The ElGamal and Pedersen modules are implicitly tested in the [veiled coin](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/veiled_coin/sources/veiled_coin.move) Move example module.

## References

[^bulletproofs]: **Bulletproofs: Short Proofs for Confidential Transactions and More**, by B. Bünz and J. Bootle and D. Boneh and A. Poelstra and P. Wuille and G. Maxwell, *in 2018 IEEE Symposium on Security and Privacy (SP)*, 2018, [[URL]](https://ieeexplore.ieee.org/document/8418611)
[^elgamal]: **A public key cryptosystem and a signature scheme based on discrete logarithms**, by ElGamal, T., *in IEEE Transactions on Information Theory*, 1985
[^fiatshamir]: **How To Prove Yourself: Practical Solutions to Identification and Signature Problems**, by Fiat, Amos and Shamir, Adi, *in Advances in Cryptology --- CRYPTO' 86*, 1987
[^pedersen]: **Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing**, by Pedersen, Torben Pryds, *in Proceedings on Advances in Cryptology*, 1992
[^provisions]: **Provisions**, by Gaby G. Dagher and Benedikt Bünz and Joseph Bonneau and Jeremy Clark and Dan Boneh, *in Proceedings of the 22nd ACM SIGSAC Conference on Computer and Communications Security*, 2015, [[URL]](https://doi.org/10.1145%2F2810103.2813674)
[^ristretto255]: [https://ristretto.group](https://ristretto.group)
