# Aptos Improvement Proposals (AIPs)

Aptos Improvement Proposals (AIP) describe standards for the Aptos Network including the core blockchain protocol and the development platform (Move), smart contracts and systems for smart contract verification, standards for the deployment and operation of the Aptos Network, APIs for accessing the Aptos Network and processing information from the Aptos Network.

## How to submit an AIP

 1. Fork this repo into your own GitHub
 2. Copy `TEMPLATE.md` into your new AIP file in `aips/<your-feature-name-NO-AIP-#-here>.md`
    + Name your AIP file based on your feature, not the AIP number, which will be picked for your later.
    + e.g., `new-zero-knowledge-range-proof-verifiers.md` is a good name.
    - ...but `aip-14.md` or `14.md` is **NOT** a good name.
 3. Edit your AIP file
    - Fill in the YAML header (see instructions there)
    - Follow the template guidelines to the best of your ability
 4. Commit these changes to your repo
 5. Submit a pull request on GitHub to this repo.

## AIP Overview

This table contains an overview of all created and tracked AIPs. It should be updated with each new AIP.

| AIP Number | AIP Title |
|--|--|
| AIP 0 | [Aptos Improvement Proposals](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-0.md) |
| AIP 1 | [Proposer selection improvements](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-1.md) |
| AIP 2 | [Multiple Token Changes](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-2.md) |
| AIP 3 | [Multi-step Governance Proposal](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-3.md) |
| AIP 4 | [Update Simple Map To Save Gas](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-4.md) |
| AIP 5 | N/A |
| AIP 6 | [Delegation pool for node operators](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-6.md) |
| AIP 7 | [Transaction fee distribution](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-7.md) |
| AIP 8 | [Higher-Order Inline Functions for Collections](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-8.md) |
| AIP 9 | [Resource Groups](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-9.md) |
| AIP 10 | [Move Objects](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-10.md) |
| AIP 11 | [Tokens as Objects](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-11.md) |
| AIP 12 | [Multisig Accounts v2](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-12.md) |
| AIP 13 | [Coin Standard Improvements](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-13.md) |
| AIP 14 | [Update vesting contract](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-14.md) |
| AIP 15 | [Update and rename token_standard_reserved_properties](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-15.md) |
| AIP 16 | [New cryptography natives for hashing and MultiEd25519 PK validation](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-16.md) |
| AIP 17 | [Reducing Execution Costs by Decoupling Transaction Storage and Execution Charges](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-17.md) |
| AIP 18 | [Introducing SmartVector and SmartTable to apto_std](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-18.md) |
| AIP 19 | [Enable updating commission_percentage in staking_contract module](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-19.md) |
| AIP 20 | [Generic Cryptography Algebra and BLS12-381 Implementation](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-20.md) |
| AIP 21 | [Fungible Assets](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md) |
| AIP 22 | [No-Code Token Objects](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-22.md) |
| AIP 23 | [Make Ed25519 public key validation native return `false` if key has the wrong length](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-23.md) |
| AIP 24 | [Move Library Updates](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-24.md) |
| AIP 25 | [Transaction Argument Support for Structs](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-25.md) |
| AIP 26 | [Quorum Store](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-26.md) |
| AIP 27 | [Sender Aware Transaction Shuffling](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-27.md) |
| ... | ... |
